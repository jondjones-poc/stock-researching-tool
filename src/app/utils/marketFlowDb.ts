import { query } from './db';
import {
  MARKET_FLOW_PERIODS,
  MARKET_FLOW_SEED,
  type MarketFlowCapType,
  type MarketFlowPeriod,
} from '../config/marketFlow';

export interface MarketFlowMarketRow {
  id: number;
  slug: string;
  name: string;
  region: string;
  sort_order: number;
}

export interface MarketFlowFundRow {
  id: number;
  market_id: number;
  cap_type: MarketFlowCapType;
  symbol: string;
  name: string;
  description: string;
  is_active: boolean;
  market_slug?: string;
  market_name?: string;
}

export interface MarketFlowPriceBar {
  date: string;
  close: number;
}

export interface MarketFlowReturnRow {
  fund_id: number;
  period: MarketFlowPeriod;
  return_pct: number | null;
  as_of_date: string | null;
  start_date: string | null;
  start_close: number | null;
  end_close: number | null;
  computed_at: string | null;
}

export interface MarketFlowFundMetaRow {
  fund_id: number;
  last_fetched_at: string | null;
  last_price_date: string | null;
  last_error: string | null;
  status: string;
}

/** Postgres timestamps arrive as Date objects; normalize to ISO so clients can parse them. */
function toIsoTimestamp(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function seedMarketFlowUniverse(): Promise<{ markets: number; funds: number }> {
  let markets = 0;
  let funds = 0;

  for (const m of MARKET_FLOW_SEED) {
    const marketRes = await query(
      `INSERT INTO market_flow_markets (slug, name, region, sort_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET
         name = EXCLUDED.name,
         region = EXCLUDED.region,
         sort_order = EXCLUDED.sort_order
       RETURNING id`,
      [m.slug, m.name, m.region, m.sortOrder]
    );
    const marketId = Number(marketRes.rows[0].id);
    markets += 1;

    for (const f of m.funds) {
      const fundRes = await query(
        `INSERT INTO market_flow_funds (market_id, cap_type, symbol, name, description, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (market_id, cap_type) DO UPDATE SET
           symbol = EXCLUDED.symbol,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = true
         RETURNING id`,
        [marketId, f.capType, f.symbol.toUpperCase(), f.name, f.description]
      );
      const fundId = Number(fundRes.rows[0].id);
      await query(
        `INSERT INTO market_flow_fund_meta (fund_id, status)
         VALUES ($1, 'pending')
         ON CONFLICT (fund_id) DO NOTHING`,
        [fundId]
      );
      funds += 1;
    }
  }

  return { markets, funds };
}

export async function listMarketFlowMarkets(): Promise<MarketFlowMarketRow[]> {
  const result = await query(
    `SELECT id, slug, name, region, sort_order
     FROM market_flow_markets
     ORDER BY sort_order ASC, name ASC`
  );
  return result.rows.map((r) => ({
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    region: String(r.region ?? ''),
    sort_order: Number(r.sort_order),
  }));
}

export async function getMarketFlowMarketBySlug(slug: string): Promise<MarketFlowMarketRow | null> {
  const result = await query(
    `SELECT id, slug, name, region, sort_order
     FROM market_flow_markets WHERE slug = $1`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    slug: String(r.slug),
    name: String(r.name),
    region: String(r.region ?? ''),
    sort_order: Number(r.sort_order),
  };
}

export async function listActiveMarketFlowFunds(): Promise<MarketFlowFundRow[]> {
  const result = await query(
    `SELECT f.id, f.market_id, f.cap_type, f.symbol, f.name, f.description, f.is_active,
            m.slug AS market_slug, m.name AS market_name
     FROM market_flow_funds f
     JOIN market_flow_markets m ON m.id = f.market_id
     WHERE f.is_active = true
     ORDER BY m.sort_order ASC, f.cap_type ASC`
  );
  return result.rows.map(mapFundRow);
}

export async function listFundsForMarket(marketId: number): Promise<MarketFlowFundRow[]> {
  const result = await query(
    `SELECT f.id, f.market_id, f.cap_type, f.symbol, f.name, f.description, f.is_active,
            m.slug AS market_slug, m.name AS market_name
     FROM market_flow_funds f
     JOIN market_flow_markets m ON m.id = f.market_id
     WHERE f.market_id = $1 AND f.is_active = true
     ORDER BY f.cap_type ASC`,
    [marketId]
  );
  return result.rows.map(mapFundRow);
}

function mapFundRow(r: Record<string, unknown>): MarketFlowFundRow {
  return {
    id: Number(r.id),
    market_id: Number(r.market_id),
    cap_type: r.cap_type as MarketFlowCapType,
    symbol: String(r.symbol),
    name: String(r.name),
    description: String(r.description ?? ''),
    is_active: r.is_active === true || r.is_active === 't',
    market_slug: r.market_slug != null ? String(r.market_slug) : undefined,
    market_name: r.market_name != null ? String(r.market_name) : undefined,
  };
}

export async function getLatestPriceDate(fundId: number): Promise<string | null> {
  const result = await query(
    `SELECT MAX(price_date)::text AS d FROM market_flow_prices WHERE fund_id = $1`,
    [fundId]
  );
  return result.rows[0]?.d ? String(result.rows[0].d) : null;
}

/** Insert prices in batches; ON CONFLICT DO NOTHING prevents duplicates. Returns inserted count. */
export async function upsertMarketFlowPrices(
  fundId: number,
  bars: MarketFlowPriceBar[]
): Promise<number> {
  const valid = bars.filter((b) => b.date && Number.isFinite(b.close));
  if (valid.length === 0) return 0;

  let inserted = 0;
  const chunkSize = 100;
  for (let i = 0; i < valid.length; i += chunkSize) {
    const chunk = valid.slice(i, i + chunkSize);
    const values: unknown[] = [];
    const placeholders: string[] = [];
    chunk.forEach((bar, idx) => {
      const base = idx * 3;
      placeholders.push(`($${base + 1}, $${base + 2}::date, $${base + 3})`);
      values.push(fundId, bar.date, bar.close);
    });
    const result = await query(
      `INSERT INTO market_flow_prices (fund_id, price_date, close)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (fund_id, price_date) DO NOTHING`,
      values
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
}

export async function updateFundMeta(
  fundId: number,
  patch: {
    lastFetchedAt?: Date;
    lastPriceDate?: string | null;
    lastError?: string | null;
    status: string;
  }
): Promise<void> {
  await query(
    `INSERT INTO market_flow_fund_meta (fund_id, last_fetched_at, last_price_date, last_error, status)
     VALUES ($1, $2, $3::date, $4, $5)
     ON CONFLICT (fund_id) DO UPDATE SET
       last_fetched_at = COALESCE(EXCLUDED.last_fetched_at, market_flow_fund_meta.last_fetched_at),
       last_price_date = COALESCE(EXCLUDED.last_price_date, market_flow_fund_meta.last_price_date),
       last_error = EXCLUDED.last_error,
       status = EXCLUDED.status`,
    [
      fundId,
      patch.lastFetchedAt ?? new Date(),
      patch.lastPriceDate ?? null,
      patch.lastError ?? null,
      patch.status,
    ]
  );
}

export async function listFundMeta(): Promise<MarketFlowFundMetaRow[]> {
  const result = await query(
    `SELECT fund_id, last_fetched_at, last_price_date::text AS last_price_date, last_error, status
     FROM market_flow_fund_meta`
  );
  return result.rows.map((r) => ({
    fund_id: Number(r.fund_id),
    last_fetched_at: toIsoTimestamp(r.last_fetched_at),
    last_price_date: r.last_price_date ? String(r.last_price_date) : null,
    last_error: r.last_error != null ? String(r.last_error) : null,
    status: String(r.status),
  }));
}

export async function upsertReturns(
  fundId: number,
  period: MarketFlowPeriod,
  data: {
    returnPct: number | null;
    asOfDate: string | null;
    startDate: string | null;
    startClose: number | null;
    endClose: number | null;
  }
): Promise<void> {
  await query(
    `INSERT INTO market_flow_returns
       (fund_id, period, return_pct, as_of_date, start_date, start_close, end_close, computed_at)
     VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, CURRENT_TIMESTAMP)
     ON CONFLICT (fund_id, period) DO UPDATE SET
       return_pct = EXCLUDED.return_pct,
       as_of_date = EXCLUDED.as_of_date,
       start_date = EXCLUDED.start_date,
       start_close = EXCLUDED.start_close,
       end_close = EXCLUDED.end_close,
       computed_at = CURRENT_TIMESTAMP`,
    [
      fundId,
      period,
      data.returnPct,
      data.asOfDate,
      data.startDate,
      data.startClose,
      data.endClose,
    ]
  );
}

export async function listAllReturns(): Promise<MarketFlowReturnRow[]> {
  const result = await query(
    `SELECT fund_id, period, return_pct, as_of_date::text, start_date::text,
            start_close, end_close, computed_at
     FROM market_flow_returns`
  );
  return result.rows.map(mapReturnRow);
}

export async function listReturnsForFunds(fundIds: number[]): Promise<MarketFlowReturnRow[]> {
  if (fundIds.length === 0) return [];
  const placeholders = fundIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await query(
    `SELECT fund_id, period, return_pct, as_of_date::text, start_date::text,
            start_close, end_close, computed_at
     FROM market_flow_returns
     WHERE fund_id IN (${placeholders})`,
    fundIds
  );
  return result.rows.map(mapReturnRow);
}

function mapReturnRow(r: Record<string, unknown>): MarketFlowReturnRow {
  return {
    fund_id: Number(r.fund_id),
    period: r.period as MarketFlowPeriod,
    return_pct: r.return_pct != null ? Number(r.return_pct) : null,
    as_of_date: r.as_of_date != null ? String(r.as_of_date) : null,
    start_date: r.start_date != null ? String(r.start_date) : null,
    start_close: r.start_close != null ? Number(r.start_close) : null,
    end_close: r.end_close != null ? Number(r.end_close) : null,
    computed_at: r.computed_at != null ? String(r.computed_at) : null,
  };
}

export async function getPricesForFund(
  fundId: number,
  fromDate?: string
): Promise<MarketFlowPriceBar[]> {
  const result = fromDate
    ? await query(
        `SELECT price_date::text AS date, close
         FROM market_flow_prices
         WHERE fund_id = $1 AND price_date >= $2::date
         ORDER BY price_date ASC`,
        [fundId, fromDate]
      )
    : await query(
        `SELECT price_date::text AS date, close
         FROM market_flow_prices
         WHERE fund_id = $1
         ORDER BY price_date ASC`,
        [fundId]
      );

  return result.rows.map((r) => ({
    date: String(r.date),
    close: Number(r.close),
  }));
}

export async function getLatestClose(fundId: number): Promise<{ date: string; close: number } | null> {
  const result = await query(
    `SELECT price_date::text AS date, close
     FROM market_flow_prices
     WHERE fund_id = $1
     ORDER BY price_date DESC
     LIMIT 1`,
    [fundId]
  );
  if (result.rows.length === 0) return null;
  return { date: String(result.rows[0].date), close: Number(result.rows[0].close) };
}

/** Close on or before target date (handles weekends/holidays). */
export async function getCloseOnOrBefore(
  fundId: number,
  targetDate: string
): Promise<{ date: string; close: number } | null> {
  const result = await query(
    `SELECT price_date::text AS date, close
     FROM market_flow_prices
     WHERE fund_id = $1 AND price_date <= $2::date
     ORDER BY price_date DESC
     LIMIT 1`,
    [fundId, targetDate]
  );
  if (result.rows.length === 0) return null;
  return { date: String(result.rows[0].date), close: Number(result.rows[0].close) };
}

export async function startMarketFlowRun(mode: 'live' | 'mock'): Promise<number> {
  const result = await query(
    `INSERT INTO market_flow_runs (mode, status) VALUES ($1, 'running') RETURNING id`,
    [mode]
  );
  return Number(result.rows[0].id);
}

export async function finishMarketFlowRun(
  runId: number,
  status: 'ok' | 'partial' | 'error',
  fundsOk: number,
  fundsFailed: number,
  details: Record<string, unknown>
): Promise<void> {
  await query(
    `UPDATE market_flow_runs
     SET finished_at = CURRENT_TIMESTAMP, status = $2, funds_ok = $3, funds_failed = $4, details = $5::jsonb
     WHERE id = $1`,
    [runId, status, fundsOk, fundsFailed, JSON.stringify(details)]
  );
}

export async function getLatestMarketFlowRun(): Promise<{
  id: number;
  started_at: string;
  finished_at: string | null;
  mode: string;
  status: string;
  funds_ok: number;
  funds_failed: number;
} | null> {
  const result = await query(
    `SELECT id, started_at, finished_at, mode, status, funds_ok, funds_failed
     FROM market_flow_runs
     ORDER BY id DESC
     LIMIT 1`
  );
  if (result.rows.length === 0) return null;
  const r = result.rows[0];
  return {
    id: Number(r.id),
    started_at: toIsoTimestamp(r.started_at) ?? '',
    finished_at: toIsoTimestamp(r.finished_at),
    mode: String(r.mode),
    status: String(r.status),
    funds_ok: Number(r.funds_ok),
    funds_failed: Number(r.funds_failed),
  };
}

export { MARKET_FLOW_PERIODS };
