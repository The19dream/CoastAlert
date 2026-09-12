import OfficialAlert, { IOfficialAlert } from '../models/OfficialAlert';
import { INDIA_CITY_MAP, haversineKm } from '../utils/indiaRegions';
import { sendSmsAlertToSubscribedUsers } from './smsService';
import { sendPushAlertToSubscribedUsers } from './pushService';

interface OfficialSourceConfig {
  url: string;
  issuer: string;
  defaultHazard?: string;
  defaultSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

const SOURCES: OfficialSourceConfig[] = [
  { url: process.env.NDMA_ALERT_URL || 'https://sachet.ndma.gov.in/cap_public_website/rss/rss_india.xml', issuer: 'NDMA', defaultHazard: 'general_alert', defaultSeverity: 'high' },
  { url: process.env.IMD_ALERT_URL || 'https://cap-sources.s3.amazonaws.com/in-imd-en/rss.xml', issuer: 'IMD', defaultHazard: 'storm_surge', defaultSeverity: 'high' },
  { url: process.env.NDRF_ALERT_URL || '', issuer: 'NDRF', defaultHazard: 'coastal_flooding', defaultSeverity: 'medium' },
  { url: process.env.INCOIS_ALERT_URL || '', issuer: 'INCOIS', defaultHazard: 'tsunami', defaultSeverity: 'high' },
  { url: process.env.CPCB_ALERT_URL || '', issuer: 'CPCB', defaultHazard: 'oil_spill', defaultSeverity: 'medium' }
];

async function fetchSourceData(url: string): Promise<any> {
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'CoastAlertServer/1.0',
      Accept: 'application/json, application/rss+xml, application/xml, text/xml, */*'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  const contentType = (res.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('xml') || /<\?xml/i.test(text) || /<rss[\s>]/i.test(text) || /<feed[\s>]/i.test(text)) {
    return parseRssFeed(text);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return text;
  }
}

function parseTagValue(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function parseRssFeed(xmlText: string): any[] {
  const items: any[] = [];
  const itemMatches = Array.from(xmlText.matchAll(/<item[\s\S]*?<\/item>/gi));

  itemMatches.forEach((match) => {
    const itemXml = match[0];
    const title = parseTagValue(itemXml, 'title');
    const description = parseTagValue(itemXml, 'description');
    const pubDate = parseTagValue(itemXml, 'pubDate');
    const link = parseTagValue(itemXml, 'link');

    items.push({
      title,
      description,
      pubDate,
      link,
      source: 'rss'
    });
  });

  return items;
}

function findNearestRegion(lat: number, lng: number): string {
  let bestRegion = 'India';
  let bestDistance = Infinity;

  for (const [regionName, regionInfo] of Object.entries(INDIA_CITY_MAP)) {
    const distance = haversineKm(lat, lng, regionInfo.lat, regionInfo.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRegion = regionName;
    }
  }

  return bestRegion;
}

function normalizeOfficialPayload(item: any, issuer: string, defaultHazard: string, defaultSeverity: 'low' | 'medium' | 'high' | 'critical') {
  const message = item.message || item.description || item.advisory || item.title || 'Official warning in India.';
  const hazardType = item.hazardType || item.hazard || defaultHazard;
  const severity = ['critical', 'high', 'medium', 'low'].includes((item.severity || '').toLowerCase())
    ? (item.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical')
    : defaultSeverity;

  let region = item.region || item.state || item.district || 'India';
  let issuedAt = item.issuedAt ? new Date(item.issuedAt) : item.pubDate ? new Date(item.pubDate) : new Date();
  let expiresAt = item.expiresAt ? new Date(item.expiresAt) : new Date(Date.now() + 6 * 60 * 60 * 1000);

  let lat = Number(item.lat ?? item.latitude ?? item.location?.lat ?? 0);
  let lng = Number(item.lng ?? item.longitude ?? item.location?.lng ?? 0);

  if ((!lat || !lng) && typeof item.geo === 'object') {
    lat = Number(item.geo.lat ?? item.geo.latitude ?? 0);
    lng = Number(item.geo.lng ?? item.geo.longitude ?? 0);
  }

  if ((!lat || !lng) && typeof item.coordinates === 'string') {
    const parts = item.coordinates.split(',').map((s: string) => parseFloat(s.trim()));
    if (parts.length >= 2) {
      lat = parts[0];
      lng = parts[1];
    }
  }

  if (!region || region === 'India') {
    if (lat && lng) {
      region = findNearestRegion(lat, lng);
    } else {
      region = 'India';
    }
  }

  return {
    hazardType,
    severity,
    region,
    message,
    issuedBy: issuer,
    issuedAt,
    expiresAt
  };
}

export async function syncOfficialAlerts(): Promise<IOfficialAlert[]> {
  const syncedAlerts: IOfficialAlert[] = [];

  for (const source of SOURCES) {
    if (!source.url) continue;

    try {
      const payload = await fetchSourceData(source.url);
      const items: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.alerts)
        ? payload.alerts
        : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload)
        ? payload
        : [];

      for (const item of items) {
        const rawAlert = normalizeOfficialPayload(item, source.issuer, source.defaultHazard ?? 'other', source.defaultSeverity ?? 'medium');

        const updated = await OfficialAlert.findOneAndUpdate(
          {
            issuedBy: rawAlert.issuedBy,
            region: rawAlert.region,
            message: rawAlert.message,
            issuedAt: rawAlert.issuedAt
          },
          rawAlert,
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        syncedAlerts.push(updated);
      }
    } catch (error: any) {
      console.warn(`Official alert source sync failed for ${source.issuer}:`, error.message);
    }
  }

  if (syncedAlerts.length > 0) {
    await sendSmsAlertToSubscribedUsers(syncedAlerts);
    await sendPushAlertToSubscribedUsers(syncedAlerts);
  }

  return syncedAlerts;
}
