import type { RawPost } from '../types/social';

const ENABLE_TWITTER_SOCIAL = process.env.ENABLE_TWITTER_SOCIAL === 'true';
const TWITTER_BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN;
const TWITTER_SEARCH_QUERY = process.env.TWITTER_SEARCH_QUERY || 'tsunami OR flood OR storm OR surge OR oil spill OR coastal flood OR cyclone';
const SOCIAL_SOURCE_URL = process.env.SOCIAL_SOURCE_URL;

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers, method: 'GET' });
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTwitterPosts(region?: string): Promise<RawPost[]> {
  if (!ENABLE_TWITTER_SOCIAL || !TWITTER_BEARER_TOKEN) {
    return [];
  }

  const queryParams = new URLSearchParams({
    query: TWITTER_SEARCH_QUERY + (region ? ` place:${region}` : ''),
    'tweet.fields': 'created_at,text,geo,lang',
    'max_results': '20',
    expansions: 'geo.place_id',
    'place.fields': 'full_name,geo'
  });

  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?${queryParams.toString()}`, {
      headers: {
        Authorization: `Bearer ${TWITTER_BEARER_TOKEN}`
      }
    });

    if (!response.ok) {
      console.warn('Twitter fetch failed:', response.status, response.statusText);
      return [];
    }

    const result: any = await response.json();
    const placesById = new Map<string, any>();
    if (Array.isArray(result?.includes?.places)) {
      result.includes.places.forEach((place: any) => {
        if (place.id) placesById.set(place.id, place);
      });
    }

    return (Array.isArray(result?.data) ? result.data : []).map((tweet: any): RawPost => {
      const place = tweet.geo?.place_id ? placesById.get(tweet.geo.place_id) : undefined;
      const [lng, lat] = place?.geo?.bbox ? [place.geo.bbox[0], place.geo.bbox[1]] : [0, 0];

      return {
        platform: 'twitter',
        postText: tweet.text,
        region: place?.full_name || region || 'India',
        geoTag: { lat: Number(lat) || 0, lng: Number(lng) || 0 },
        postedAt: tweet.created_at || new Date().toISOString(),
        severity: 'medium',
        confirmations: 0,
        hazardType: 'unknown'
      };
    }).filter((post: RawPost) => post.geoTag.lat !== 0 && post.geoTag.lng !== 0);
  } catch (error: any) {
    console.warn('fetchTwitterPosts error:', error.message);
    return [];
  }
}

export async function fetchCustomSocialSource(): Promise<RawPost[]> {
  if (!SOCIAL_SOURCE_URL) return [];

  try {
    const payload = await fetchJson(SOCIAL_SOURCE_URL, {
      'User-Agent': 'CoastAlertServer/1.0',
      Accept: 'application/json'
    });

    if (Array.isArray(payload)) {
      return payload.map((item: any): RawPost => ({
        platform: item.platform || 'external_source',
        postText: item.postText || item.text || item.description || '',
        region: item.region || item.location?.region || 'India',
        geoTag: {
          lat: Number(item.geoTag?.lat ?? item.location?.lat ?? 0),
          lng: Number(item.geoTag?.lng ?? item.location?.lng ?? 0)
        },
        postedAt: item.postedAt || item.createdAt || new Date().toISOString(),
        severity: item.severity || 'medium',
        confirmations: Number(item.confirmations ?? 0),
        hazardType: item.hazardType || 'unknown'
      })).filter((post: RawPost) => post.postText && post.geoTag.lat && post.geoTag.lng);
    }

    if (Array.isArray(payload.data)) {
      return payload.data.map((item: any): RawPost => ({
        platform: item.platform || 'external_source',
        postText: item.postText || item.text || item.description || '',
        region: item.region || item.location?.region || 'India',
        geoTag: {
          lat: Number(item.geoTag?.lat ?? item.location?.lat ?? 0),
          lng: Number(item.geoTag?.lng ?? item.location?.lng ?? 0)
        },
        postedAt: item.postedAt || item.createdAt || new Date().toISOString(),
        severity: item.severity || 'medium',
        confirmations: Number(item.confirmations ?? 0),
        hazardType: item.hazardType || 'unknown'
      })).filter((post: RawPost) => post.postText && post.geoTag.lat && post.geoTag.lng);
    }

    return [];
  } catch (error: any) {
    console.warn('fetchCustomSocialSource error:', error.message);
    return [];
  }
}

export async function getLiveSocialPosts(region?: string): Promise<RawPost[]> {
  const externalPosts: RawPost[] = [];
  const twitterPosts = await fetchTwitterPosts(region);
  externalPosts.push(...twitterPosts);

  const customPosts = await fetchCustomSocialSource();
  externalPosts.push(...customPosts);

  return externalPosts;
}
