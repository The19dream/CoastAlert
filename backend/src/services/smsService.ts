import User from '../models/User';
import { IOfficialAlert } from '../models/OfficialAlert';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const TWILIO_SEND_BACKUP_SMS = process.env.TWILIO_SEND_BACKUP_SMS === 'true';
const TWILIO_WHATSAPP_ENABLED = process.env.TWILIO_WHATSAPP_ENABLED === 'true';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || '';
const TWILIO_WHATSAPP_CONTENT_SID = process.env.TWILIO_WHATSAPP_CONTENT_SID;
const TWILIO_WHATSAPP_CONTENT_VARIABLES = process.env.TWILIO_WHATSAPP_CONTENT_VARIABLES;
const TWILIO_WHATSAPP_STATUS_CALLBACK_URL = process.env.TWILIO_WHATSAPP_STATUS_CALLBACK_URL;

async function postForm(url: string, form: URLSearchParams) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: form.toString()
  });
  return res.json();
}

async function sendTwilioMessage(form: URLSearchParams) {
  return postForm(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`, form);
}

export async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_ENABLED || !TWILIO_WHATSAPP_FROM) {
    console.warn('WhatsApp not configured or disabled; skipping sendWhatsApp.');
    return;
  }

  try {
    const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
    const form = new URLSearchParams({
      To: toNumber,
      From: TWILIO_WHATSAPP_FROM
    });

    if (TWILIO_WHATSAPP_CONTENT_SID) {
      form.append('ContentSid', TWILIO_WHATSAPP_CONTENT_SID);
      if (TWILIO_WHATSAPP_CONTENT_VARIABLES) {
        try {
          const parsed = JSON.parse(TWILIO_WHATSAPP_CONTENT_VARIABLES);
          form.append('ContentVariables', JSON.stringify(parsed));
        } catch {
          form.append('ContentVariables', TWILIO_WHATSAPP_CONTENT_VARIABLES);
        }
      }
      console.log('Sending WhatsApp via template ContentSid', TWILIO_WHATSAPP_CONTENT_SID, 'to', toNumber);
    } else {
      form.append('Body', body);
      console.log('Sending WhatsApp raw message to', toNumber);
    }

    if (TWILIO_WHATSAPP_STATUS_CALLBACK_URL) {
      form.append('StatusCallback', TWILIO_WHATSAPP_STATUS_CALLBACK_URL);
    }

    const result: any = await sendTwilioMessage(form);
    if (result?.error_code) {
      console.warn('Twilio WhatsApp send error:', result);
    } else {
      console.log('Twilio WhatsApp message queued:', result?.sid, result?.status, 'to', result?.to);
    }
  } catch (error: any) {
    console.warn('sendWhatsApp failed:', error.message);
  }
}

export async function sendSms(to: string, body: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || (!TWILIO_FROM_NUMBER && !TWILIO_MESSAGING_SERVICE_SID)) {
    console.warn('SMS not configured; skipping sendSms call.');
    return;
  }

  try {
    const form = new URLSearchParams({
      To: to,
      Body: body
    });

    if (TWILIO_MESSAGING_SERVICE_SID) {
      form.append('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
    } else {
      form.append('From', TWILIO_FROM_NUMBER!);
    }

    const result: any = await sendTwilioMessage(form);
    if (result?.error_code) {
      console.warn('Twilio sendSms API error:', result);
      if (TWILIO_SEND_BACKUP_SMS && TWILIO_FROM_NUMBER) {
        const fallback = new URLSearchParams({
          To: to,
          From: TWILIO_FROM_NUMBER,
          Body: body
        });
        const fallbackResult: any = await sendTwilioMessage(fallback);
        if (fallbackResult?.error_code) {
          console.warn('Twilio backup direct send failed:', fallbackResult);
        }
      }
    }
  } catch (error: any) {
    console.warn('sendSms failed:', error.message);
  }
}

export async function sendSmsAlertToSubscribedUsers(alerts: IOfficialAlert[]): Promise<void> {
  if (alerts.length === 0) return;

  const users = await User.find({ alertRadiusKm: { $gte: 0 }, phone: { $exists: true, $ne: '' } }).limit(200);
  if (users.length === 0) return;

  const latest = alerts[alerts.length - 1];
  const body = `${latest.issuedBy} Alert: ${latest.hazardType.toUpperCase()} in ${latest.region}. ${latest.message}`;

  await Promise.all(users.map(async (user) => {
    if (!user.phone) return;
    const phone = user.phone.trim();
    await sendSms(phone, body);
    await sendWhatsApp(phone, body);
  }));
}
