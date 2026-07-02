import { query } from './db';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP';
/** Refresh live rate at most once per 24 hours. */
export const FX_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface FxRateResult {
  rate: number;
  base: 'USD';
  quote: 'GBP';
  rateDate: string | null;
  fetchedAt: string;
  fromCache: boolean;
  stale: boolean;
  source: 'frankfurter';
}

interface CachedFxRow {
  rate: number;
  rateDate: string | null;
  fetchedAt: Date;
}

function isMissingTableError(error: unknown): boolean {
  return (error as { code?: string }).code === '42P01';
}

async function readCachedUsdToGbp(): Promise<CachedFxRow | null> {
  try {
    const result = await query(
      `SELECT rate, rate_date::text AS rate_date, fetched_at
       FROM fx_rate_cache
       WHERE base_currency = 'USD' AND quote_currency = 'GBP'`
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const rate = parseFloat(String(row.rate));
    if (!Number.isFinite(rate) || rate <= 0) return null;

    return {
      rate,
      rateDate: row.rate_date ?? null,
      fetchedAt: new Date(row.fetched_at),
    };
  } catch (error: unknown) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
}

async function fetchLiveUsdToGbp(): Promise<{ rate: number; rateDate: string | null }> {
  const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Frankfurter API ${res.status}: ${text}`);
  }

  const data = (await res.json()) as { rates?: { GBP?: number }; date?: string };
  const rate = data?.rates?.GBP;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error('Invalid USD→GBP rate in Frankfurter response');
  }

  return { rate, rateDate: data.date ?? null };
}

async function upsertUsdToGbpCache(rate: number, rateDate: string | null): Promise<void> {
  try {
    await query(
      `INSERT INTO fx_rate_cache (base_currency, quote_currency, rate, rate_date, source, fetched_at)
       VALUES ('USD', 'GBP', $1, $2, 'frankfurter', NOW())
       ON CONFLICT (base_currency, quote_currency)
       DO UPDATE SET
         rate = EXCLUDED.rate,
         rate_date = EXCLUDED.rate_date,
         source = EXCLUDED.source,
         fetched_at = NOW()`,
      [rate, rateDate]
    );
  } catch (error: unknown) {
    if (!isMissingTableError(error)) throw error;
  }
}

function toResult(
  row: CachedFxRow,
  options: { fromCache: boolean; stale: boolean }
): FxRateResult {
  return {
    rate: row.rate,
    base: 'USD',
    quote: 'GBP',
    rateDate: row.rateDate,
    fetchedAt: row.fetchedAt.toISOString(),
    fromCache: options.fromCache,
    stale: options.stale,
    source: 'frankfurter',
  };
}

/** USD→GBP from DB cache (24h TTL) with Frankfurter fallback. */
export async function getUsdToGbpRate(): Promise<FxRateResult> {
  const cached = await readCachedUsdToGbp();
  const needsRefresh =
    !cached || Date.now() - cached.fetchedAt.getTime() > FX_CACHE_TTL_MS;

  if (!needsRefresh && cached) {
    return toResult(cached, { fromCache: true, stale: false });
  }

  try {
    const live = await fetchLiveUsdToGbp();
    await upsertUsdToGbpCache(live.rate, live.rateDate);
    return {
      rate: live.rate,
      base: 'USD',
      quote: 'GBP',
      rateDate: live.rateDate,
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      stale: false,
      source: 'frankfurter',
    };
  } catch (error) {
    if (cached) {
      return toResult(cached, { fromCache: true, stale: true });
    }
    throw error;
  }
}

export function convertUsdToGbp(usd: number, rate: number): number {
  return usd * rate;
}
