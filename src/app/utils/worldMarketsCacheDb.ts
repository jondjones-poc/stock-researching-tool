import { query } from './db';
import type { WorldMarketPeriod, WorldMarketRegionResult } from '../config/worldMarkets';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface WorldMarketsCachePayload {
  period: WorldMarketPeriod;
  regions: WorldMarketRegionResult[];
  fetchedAt: string;
}

interface CacheRow {
  payload: WorldMarketsCachePayload;
  fetched_at: string;
  expires_at: string;
}

export async function loadWorldMarketsCache(
  period: WorldMarketPeriod
): Promise<(WorldMarketsCachePayload & { cached: true }) | null> {
  try {
    const result = await query(
      `SELECT payload, fetched_at, expires_at
       FROM world_markets_cache
       WHERE period = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [period]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as CacheRow;
    const payload = row.payload;
    return {
      period: payload.period,
      regions: payload.regions,
      fetchedAt: payload.fetchedAt ?? row.fetched_at,
      cached: true,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      console.warn('[world_markets_cache] Table missing — skipping cache read');
      return null;
    }
    console.warn('[world_markets_cache] Load failed:', err.message);
    return null;
  }
}

/** Return most recent cache even if expired (fallback when live fetch fails). */
export async function loadStaleWorldMarketsCache(
  period: WorldMarketPeriod
): Promise<(WorldMarketsCachePayload & { cached: true; stale: true }) | null> {
  try {
    const result = await query(
      `SELECT payload, fetched_at
       FROM world_markets_cache
       WHERE period = $1
       ORDER BY fetched_at DESC
       LIMIT 1`,
      [period]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0] as { payload: WorldMarketsCachePayload; fetched_at: string };
    return {
      period: row.payload.period,
      regions: row.payload.regions,
      fetchedAt: row.payload.fetchedAt ?? row.fetched_at,
      cached: true,
      stale: true,
    };
  } catch {
    return null;
  }
}

export async function saveWorldMarketsCache(data: WorldMarketsCachePayload): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString();

  try {
    await query(
      `INSERT INTO world_markets_cache (period, payload, fetched_at, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (period) DO UPDATE SET
         payload = EXCLUDED.payload,
         fetched_at = EXCLUDED.fetched_at,
         expires_at = EXCLUDED.expires_at`,
      [data.period, JSON.stringify(data), data.fetchedAt, expiresAt]
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      console.warn('[world_markets_cache] Table missing — skipping cache write');
      return;
    }
    console.warn('[world_markets_cache] Save failed:', err.message);
  }
}
