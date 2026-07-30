import axios from 'axios';
import { query } from './db';

export const FEAR_GREED_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const FEAR_GREED_CACHE_KEY = 'cnn';
export const FEAR_GREED_MIGRATION_HINT =
  'Run scripts/migrations/029_fear_greed_cache.sql';

export interface FearGreedPoint {
  date: string;
  value: number;
}

export interface FearGreedCachePayload {
  points: FearGreedPoint[];
  latestValue: number | null;
  latestDate: string | null;
  fetchedAt: string | null;
  fromCache: boolean;
  stale: boolean;
}

function isMissingRelation(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && (err as { code?: string }).code === '42P01');
}

function parseCnnPoints(data: unknown): FearGreedPoint[] {
  if (!data || typeof data !== 'object') return [];
  const root = data as Record<string, unknown>;
  let points: FearGreedPoint[] = [];

  const fngHist = root.fear_and_greed_historical as
    | { data?: Array<{ x?: unknown; y?: unknown }> }
    | undefined;
  if (fngHist && Array.isArray(fngHist.data)) {
    points = fngHist.data
      .filter((p) => typeof p?.x !== 'undefined' && typeof p?.y !== 'undefined')
      .map((p) => ({
        date: new Date(Number(p.x)).toISOString().split('T')[0],
        value: Number(p.y),
      }))
      .filter((p) => Boolean(p.date) && Number.isFinite(p.value));
  }

  if (!points.length) {
    const historical = (root.historical ?? root.data) as unknown;
    if (Array.isArray(historical)) {
      points = historical
        .filter(
          (p): p is { x: unknown; y: unknown } =>
            Boolean(p) &&
            typeof p === 'object' &&
            typeof (p as { x?: unknown }).x !== 'undefined' &&
            typeof (p as { y?: unknown }).y !== 'undefined'
        )
        .map((p) => ({
          date: new Date(Number(p.x)).toISOString().split('T')[0],
          value: Number(p.y),
        }))
        .filter((p) => Boolean(p.date) && Number.isFinite(p.value));
    } else if (
      historical &&
      typeof historical === 'object' &&
      Array.isArray((historical as { x?: unknown[] }).x) &&
      Array.isArray((historical as { y?: unknown[] }).y)
    ) {
      const xs = (historical as { x: unknown[] }).x;
      const ys = (historical as { y: unknown[] }).y;
      points = xs.map((x, idx) => ({
        date: new Date(Number(x)).toISOString().split('T')[0],
        value: Number(ys[idx]),
      }));
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

function latestFromPoints(points: FearGreedPoint[]): {
  latestValue: number | null;
  latestDate: string | null;
} {
  if (!points.length) return { latestValue: null, latestDate: null };
  const latest = points.reduce((a, p) => (p.date >= a.date ? p : a));
  return { latestValue: latest.value, latestDate: latest.date };
}

export async function fetchFearGreedLive(): Promise<FearGreedPoint[]> {
  const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  const response = await axios.get(url, {
    timeout: 15000,
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://edition.cnn.com',
      Referer: 'https://edition.cnn.com/markets/fear-and-greed',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
    validateStatus: () => true,
  });

  if (response.status === 429) {
    throw new Error('CNN Fear & Greed rate limit (429). Use cached data or retry later.');
  }
  if (response.status === 418) {
    throw new Error(
      'CNN Fear & Greed blocked server fetch (418). Open the site once in-browser after cache is empty, or retry later.'
    );
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`CNN Fear & Greed fetch failed (${response.status})`);
  }

  return parseCnnPoints(response.data);
}

export async function readFearGreedCache(): Promise<{
  points: FearGreedPoint[];
  latestValue: number | null;
  latestDate: string | null;
  fetchedAt: Date | null;
} | null> {
  try {
    const result = await query(
      `SELECT points, latest_value, latest_date::text AS latest_date, fetched_at
       FROM fear_greed_cache
       WHERE cache_key = $1
       LIMIT 1`,
      [FEAR_GREED_CACHE_KEY]
    );
    if (!result.rows.length) return null;
    const row = result.rows[0] as {
      points: FearGreedPoint[] | string;
      latest_value: number | string | null;
      latest_date: string | null;
      fetched_at: Date | string | null;
    };
    const points = Array.isArray(row.points)
      ? row.points
      : typeof row.points === 'string'
        ? (JSON.parse(row.points) as FearGreedPoint[])
        : [];
    const fetchedAt =
      row.fetched_at instanceof Date
        ? row.fetched_at
        : row.fetched_at
          ? new Date(row.fetched_at)
          : null;
    return {
      points,
      latestValue:
        row.latest_value == null || row.latest_value === ''
          ? null
          : Number(row.latest_value),
      latestDate: row.latest_date,
      fetchedAt,
    };
  } catch (err) {
    if (isMissingRelation(err)) return null;
    throw err;
  }
}

export async function writeFearGreedCache(points: FearGreedPoint[]): Promise<Date> {
  const { latestValue, latestDate } = latestFromPoints(points);
  const result = await query(
    `INSERT INTO fear_greed_cache (cache_key, points, latest_value, latest_date, fetched_at)
     VALUES ($1, $2::jsonb, $3, $4::date, CURRENT_TIMESTAMP)
     ON CONFLICT (cache_key) DO UPDATE SET
       points = EXCLUDED.points,
       latest_value = EXCLUDED.latest_value,
       latest_date = EXCLUDED.latest_date,
       fetched_at = CURRENT_TIMESTAMP
     RETURNING fetched_at`,
    [FEAR_GREED_CACHE_KEY, JSON.stringify(points), latestValue, latestDate]
  );
  const fetchedAt = result.rows[0]?.fetched_at;
  return fetchedAt instanceof Date ? fetchedAt : new Date(fetchedAt);
}

export async function clearFearGreedCache(): Promise<void> {
  try {
    await query(`DELETE FROM fear_greed_cache WHERE cache_key = $1`, [FEAR_GREED_CACHE_KEY]);
  } catch (err) {
    if (isMissingRelation(err)) {
      const e = new Error(`Fear & Greed cache table missing. ${FEAR_GREED_MIGRATION_HINT}`);
      (e as { code?: string }).code = '42P01';
      throw e;
    }
    throw err;
  }
}

function isFresh(fetchedAt: Date | null): boolean {
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return false;
  return Date.now() - fetchedAt.getTime() < FEAR_GREED_CACHE_TTL_MS;
}

/**
 * Return Fear & Greed points from DB cache when fresher than 24h.
 * Otherwise fetch live from CNN, store, and return.
 * When forceRefresh is true, clear cache first then fetch live.
 */
export async function getFearGreedCached(options?: {
  forceRefresh?: boolean;
}): Promise<FearGreedCachePayload> {
  const forceRefresh = options?.forceRefresh === true;

  if (forceRefresh) {
    await clearFearGreedCache();
  } else {
    const cached = await readFearGreedCache();
    if (cached && cached.points.length > 0 && isFresh(cached.fetchedAt)) {
      return {
        points: cached.points,
        latestValue: cached.latestValue,
        latestDate: cached.latestDate,
        fetchedAt: cached.fetchedAt?.toISOString() ?? null,
        fromCache: true,
        stale: false,
      };
    }
  }

  try {
    const points = await fetchFearGreedLive();
    if (!points.length) {
      const cached = await readFearGreedCache();
      if (cached?.points.length) {
        return {
          points: cached.points,
          latestValue: cached.latestValue,
          latestDate: cached.latestDate,
          fetchedAt: cached.fetchedAt?.toISOString() ?? null,
          fromCache: true,
          stale: true,
        };
      }
      return {
        points: [],
        latestValue: null,
        latestDate: null,
        fetchedAt: null,
        fromCache: false,
        stale: false,
      };
    }

    let fetchedAt: Date;
    try {
      fetchedAt = await writeFearGreedCache(points);
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      fetchedAt = new Date();
    }

    const { latestValue, latestDate } = latestFromPoints(points);
    return {
      points,
      latestValue,
      latestDate,
      fetchedAt: fetchedAt.toISOString(),
      fromCache: false,
      stale: false,
    };
  } catch (liveErr) {
    const cached = await readFearGreedCache();
    if (cached?.points.length) {
      return {
        points: cached.points,
        latestValue: cached.latestValue,
        latestDate: cached.latestDate,
        fetchedAt: cached.fetchedAt?.toISOString() ?? null,
        fromCache: true,
        stale: true,
      };
    }
    throw liveErr;
  }
}
