import User from '../models/User';
import { IOfficialAlert } from '../models/OfficialAlert';

const EXPO_PUSH_ENABLED = process.env.EXPO_PUSH_ENABLED !== 'false';
const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

async function sendExpoPushMessages(messages: any[]) {
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Expo push send failed (${response.status}): ${err}`);
  }

  return response.json();
}

export async function registerExpoPushToken(userId: string, token: string): Promise<void> {
  if (!token) return;

  const normalized = token.trim();
  if (!normalized) return;

  const user = await User.findById(userId);
  if (!user) return;

  if (!Array.isArray(user.expoPushTokens)) {
    user.expoPushTokens = [];
  }

  if (user.expoPushTokens.includes(normalized)) {
    return;
  }

  user.expoPushTokens.push(normalized);
  await user.save();
}

export async function sendPushAlertToSubscribedUsers(alerts: IOfficialAlert[]): Promise<void> {
  if (!EXPO_PUSH_ENABLED || alerts.length === 0) return;

  const latest = alerts[alerts.length - 1];
  const body = `${latest.issuedBy} Alert: ${latest.hazardType.toUpperCase()} in ${latest.region}. ${latest.message}`;
  const title = `${latest.issuedBy} Official Alert`;

  const users = await User.find({ expoPushTokens: { $exists: true, $ne: [] } }).limit(200);
  if (users.length === 0) return;

  const pushTokens = users.flatMap((user) => user.expoPushTokens || []);
  const uniqueTokens = Array.from(new Set(pushTokens)).filter((token) => token.startsWith('Expo')); 

  if (uniqueTokens.length === 0) return;

  const messageChunks = chunkArray(uniqueTokens, 100);
  for (const chunk of messageChunks) {
    const messages = chunk.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: { alertId: latest._id?.toString?.() ?? '', type: 'official_alert' }
    }));

    try {
      await sendExpoPushMessages(messages);
    } catch (error: any) {
      console.warn('Failed to send Expo push messages:', error.message);
    }
  }
}
