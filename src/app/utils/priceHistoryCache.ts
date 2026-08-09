import { query } from './db';
import type { HistoricalPriceBar } from './yahooHistoricalPrices';

export const PRICE_HISTORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Prefer cache for 24 hours — daily bars don't need intraday refresh. */
function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < PRICE_HISTORY_CACHE_TTL_MS;
}

export async function readPriceHistoryCache(
  symbol: string,
  opts?: { allowStale?: boolean }
): Promise<{ bars: HistoricalPriceBar[]; source: string; fetchedAt: Date; fresh: boolean } | null> {
  try {
    const result = await query(
      `SELECT source, bars, fetched_at
       FROM price_history_cache
       WHERE symbol = $1`,
      [symbol.toUpperCase()]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const fetchedAt = new Date(row.fetched_at);
    const fresh = isFresh(fetchedAt);
    if (!fresh && !opts?.allowStale) return null;
    const bars = Array.isArray(row.bars) ? (row.bars as HistoricalPriceBar[]) : null;
    if (!bars || bars.length === 0) return null;
    return { bars, source: String(row.source || 'CACHE'), fetchedAt, fresh };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '42P01') {
      console.warn(
        'price_history_cache missing — run scripts/apply-price-history-cache.mjs'
      );
      return null;
    }
    throw err;
  }
}

export async function writePriceHistoryCache(
  symbol: string,
  source: string,
  bars: HistoricalPriceBar[]
): Promise<void> {
  try {
    await query(
      `INSERT INTO price_history_cache (symbol, source, bars, fetched_at)
       VALUES ($1, $2, $3::jsonb, NOW())
       ON CONFLICT (symbol) DO UPDATE
       SET source = EXCLUDED.source,
           bars = EXCLUDED.bars,
           fetched_at = NOW()`,
      [symbol.toUpperCase(), source, JSON.stringify(bars)]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '42P01') {
      console.warn(
        'price_history_cache missing — run scripts/apply-price-history-cache.mjs'
      );
      return;
    }
    console.warn('Failed to write price_history_cache:', (err as Error).message);
  }
}
