import axios from 'axios';

export interface YouTubeFeedVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  watchUrl: string;
  channelId: string;
  channelName: string;
}

const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/;
const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
};

const feedCache = new Map<string, { at: number; channelTitle: string; videos: YouTubeFeedVideo[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(re);
  return match ? decodeXml(match[1].trim()) : null;
}

function extractAttr(block: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`, 'i');
  const match = block.match(re);
  return match ? match[1] : null;
}

export function parseYouTubeChannelId(input: string): string | null {
  const trimmed = input.trim();
  if (CHANNEL_ID_RE.test(trimmed)) return trimmed;

  try {
    const url = trimmed.startsWith('http') ? new URL(trimmed) : new URL(`https://${trimmed}`);
    const path = url.pathname;

    const channelMatch = path.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/i);
    if (channelMatch) return channelMatch[1];

    const idParam = url.searchParams.get('channel_id');
    if (idParam && CHANNEL_ID_RE.test(idParam)) return idParam;
  } catch {
    // not a URL
  }

  return null;
}

export async function resolveYouTubeChannelId(input: string): Promise<{
  channelId: string;
  channelUrl: string;
  displayName?: string;
}> {
  const direct = parseYouTubeChannelId(input);
  if (direct) {
    return {
      channelId: direct,
      channelUrl: `https://www.youtube.com/channel/${direct}`,
    };
  }

  let url = input.trim();
  if (!url.startsWith('http')) {
    url = url.startsWith('@') ? `https://www.youtube.com/${url}` : `https://www.youtube.com/@${url}`;
  }

  const response = await axios.get(url, {
    timeout: 15000,
    headers: FETCH_HEADERS,
    validateStatus: () => true,
    maxRedirects: 5,
  });

  if (response.status !== 200 || typeof response.data !== 'string') {
    throw new Error('Could not resolve YouTube channel — check the URL or paste a channel ID (UC…)');
  }

  const html = response.data as string;

  const patterns = [
    /"channelId":"(UC[A-Za-z0-9_-]{22})"/,
    /"externalId":"(UC[A-Za-z0-9_-]{22})"/,
    /\/channel\/(UC[A-Za-z0-9_-]{22})/,
    /itemprop="identifier" content="(UC[A-Za-z0-9_-]{22})"/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1] && CHANNEL_ID_RE.test(match[1])) {
      const channelId = match[1];
      const nameMatch = html.match(/"name":"([^"]+)","(?:avatar|description)/);
      return {
        channelId,
        channelUrl: `https://www.youtube.com/channel/${channelId}`,
        displayName: nameMatch?.[1]?.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
          String.fromCharCode(parseInt(hex, 16))
        ),
      };
    }
  }

  throw new Error('Could not find channel ID on that YouTube page');
}

export function parseChannelRss(xml: string, channelId: string): {
  channelTitle: string;
  videos: YouTubeFeedVideo[];
} {
  const channelTitle = extractTag(xml, 'title') ?? 'YouTube Channel';
  const entries = xml.split('<entry>').slice(1);
  const videos: YouTubeFeedVideo[] = [];

  for (const rawEntry of entries) {
    const entry = `<entry>${rawEntry}`;
    const videoId =
      extractTag(entry, 'yt:videoId') ??
      extractTag(entry, 'id')?.replace(/^yt:video:/, '') ??
      null;
    const title = extractTag(entry, 'title');
    const publishedAt = extractTag(entry, 'published');
    if (!videoId || !title || !publishedAt) continue;

    const channelName = extractTag(entry, 'name') ?? channelTitle;
    const thumbnailUrl =
      extractAttr(entry, 'media:thumbnail', 'url') ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    videos.push({
      videoId,
      title,
      publishedAt,
      thumbnailUrl,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
      channelId,
      channelName,
    });
  }

  return { channelTitle, videos };
}

export async function fetchChannelVideos(
  channelId: string,
  channelNameHint?: string
): Promise<{ channelTitle: string; videos: YouTubeFeedVideo[] }> {
  const cached = feedCache.get(channelId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { channelTitle: cached.channelTitle, videos: cached.videos };
  }

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const response = await axios.get(rssUrl, {
    timeout: 15000,
    headers: FETCH_HEADERS,
    validateStatus: () => true,
  });

  if (response.status !== 200 || typeof response.data !== 'string') {
    throw new Error(`Failed to load RSS feed for ${channelNameHint ?? channelId}`);
  }

  const parsed = parseChannelRss(response.data, channelId);
  feedCache.set(channelId, { at: Date.now(), ...parsed });
  return parsed;
}

export async function fetchMergedYouTubeFeed(
  channels: { channelId: string; displayName: string }[],
  limit = 60
): Promise<YouTubeFeedVideo[]> {
  if (channels.length === 0) return [];

  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      const { videos } = await fetchChannelVideos(channel.channelId, channel.displayName);
      return videos.map((video) => ({
        ...video,
        channelName: channel.displayName || video.channelName,
      }));
    })
  );

  const merged: YouTubeFeedVideo[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      merged.push(...result.value);
    }
  }

  merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  return merged.slice(0, limit);
}
