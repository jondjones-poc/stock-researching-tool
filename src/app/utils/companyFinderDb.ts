import { query } from './db';

export interface CompanyFinderRow {
  ticker: string;
  cik: string;
  name: string | null;
  exchange: string | null;
  price: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  cash: number | null;
  cashAsOf: string | null;
  ocfYtd: number | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  score: number | null;
  ocfPerWeek: number | null;
  estPerSharePerWeek: number | null;
  weeklyOcfYieldPct: number | null;
  dataQuality: 'ok' | 'partial' | 'missing';
  errorMessage: string | null;
  factsFetchedAt: string | null;
  quoteFetchedAt: string | null;
  computedAt: string | null;
  updatedAt: string | null;
}

export interface CompanyFinderListFilters {
  candidatesOnly?: boolean;
  q?: string;
  minMarketCap?: number | null;
  maxMarketCap?: number | null;
  minCash?: number | null;
  minOcfYtd?: number | null;
  maxScore?: number | null;
  limit?: number;
  offset?: number;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapRow(row: Record<string, unknown>): CompanyFinderRow {
  return {
    ticker: String(row.ticker),
    cik: String(row.cik),
    name: row.name != null ? String(row.name) : null,
    exchange: row.exchange != null ? String(row.exchange) : null,
    price: num(row.price),
    sharesOutstanding: num(row.shares_outstanding),
    marketCap: num(row.market_cap),
    cash: num(row.cash),
    cashAsOf: row.cash_as_of != null ? String(row.cash_as_of).slice(0, 10) : null,
    ocfYtd: num(row.ocf_ytd),
    ocfAsOf: row.ocf_as_of != null ? String(row.ocf_as_of).slice(0, 10) : null,
    ocfPeriod: row.ocf_period != null ? String(row.ocf_period) : null,
    score: num(row.score),
    ocfPerWeek: num(row.ocf_per_week),
    estPerSharePerWeek: num(row.est_per_share_per_week),
    weeklyOcfYieldPct: num(row.weekly_ocf_yield_pct),
    dataQuality: (row.data_quality as CompanyFinderRow['dataQuality']) || 'partial',
    errorMessage: row.error_message != null ? String(row.error_message) : null,
    factsFetchedAt: row.facts_fetched_at != null ? String(row.facts_fetched_at) : null,
    quoteFetchedAt: row.quote_fetched_at != null ? String(row.quote_fetched_at) : null,
    computedAt: row.computed_at != null ? String(row.computed_at) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };
}

export async function startCompanyFinderRun(mode: string, cursorOffset: number): Promise<number> {
  const res = await query(
    `INSERT INTO company_finder_runs (status, mode, cursor_offset)
     VALUES ('running', $1, $2)
     RETURNING id`,
    [mode, cursorOffset]
  );
  return Number(res.rows[0].id);
}

export async function finishCompanyFinderRun(
  id: number,
  patch: {
    status: 'ok' | 'error' | 'partial';
    processed: number;
    upserted: number;
    failed: number;
    candidates: number;
    cursorOffset: number;
    errorMessage?: string | null;
  }
): Promise<void> {
  await query(
    `UPDATE company_finder_runs SET
       status = $2,
       processed = $3,
       upserted = $4,
       failed = $5,
       candidates = $6,
       cursor_offset = $7,
       error_message = $8,
       finished_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      id,
      patch.status,
      patch.processed,
      patch.upserted,
      patch.failed,
      patch.candidates,
      patch.cursorOffset,
      patch.errorMessage ?? null,
    ]
  );
}

export async function getLatestCompanyFinderRun(): Promise<{
  id: number;
  status: string;
  mode: string;
  cursorOffset: number;
  processed: number;
  upserted: number;
  failed: number;
  candidates: number;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
} | null> {
  const res = await query(
    `SELECT id, status, mode, cursor_offset, processed, upserted, failed, candidates,
            error_message, started_at, finished_at
     FROM company_finder_runs
     ORDER BY id DESC
     LIMIT 1`
  );
  if (!res.rows.length) return null;
  const row = res.rows[0];
  return {
    id: Number(row.id),
    status: String(row.status),
    mode: String(row.mode),
    cursorOffset: Number(row.cursor_offset) || 0,
    processed: Number(row.processed) || 0,
    upserted: Number(row.upserted) || 0,
    failed: Number(row.failed) || 0,
    candidates: Number(row.candidates) || 0,
    errorMessage: row.error_message != null ? String(row.error_message) : null,
    startedAt: String(row.started_at),
    finishedAt: row.finished_at != null ? String(row.finished_at) : null,
  };
}

export async function upsertCompanyFinderRows(
  rows: Array<{
    ticker: string;
    cik: string;
    name: string | null;
    exchange: string | null;
    price: number | null;
    sharesOutstanding: number | null;
    marketCap: number | null;
    cash: number | null;
    cashAsOf: string | null;
    ocfYtd: number | null;
    ocfAsOf: string | null;
    ocfPeriod: string | null;
    score: number | null;
    ocfPerWeek: number | null;
    estPerSharePerWeek: number | null;
    weeklyOcfYieldPct: number | null;
    dataQuality: 'ok' | 'partial' | 'missing';
    errorMessage: string | null;
    factsFetchedAt: string | null;
    quoteFetchedAt: string | null;
  }>
): Promise<void> {
  for (const row of rows) {
    await query(
      `INSERT INTO company_finder_companies (
         ticker, cik, name, exchange, price, shares_outstanding, market_cap,
         cash, cash_as_of, ocf_ytd, ocf_as_of, ocf_period,
         score, ocf_per_week, est_per_share_per_week, weekly_ocf_yield_pct,
         data_quality, error_message, facts_fetched_at, quote_fetched_at,
         computed_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,
         $8,$9::date,$10,$11::date,$12,
         $13,$14,$15,$16,
         $17,$18,$19::timestamptz,$20::timestamptz,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       ON CONFLICT (ticker) DO UPDATE SET
         cik = EXCLUDED.cik,
         name = COALESCE(EXCLUDED.name, company_finder_companies.name),
         exchange = COALESCE(EXCLUDED.exchange, company_finder_companies.exchange),
         price = COALESCE(EXCLUDED.price, company_finder_companies.price),
         shares_outstanding = COALESCE(EXCLUDED.shares_outstanding, company_finder_companies.shares_outstanding),
         market_cap = COALESCE(EXCLUDED.market_cap, company_finder_companies.market_cap),
         cash = COALESCE(EXCLUDED.cash, company_finder_companies.cash),
         cash_as_of = COALESCE(EXCLUDED.cash_as_of, company_finder_companies.cash_as_of),
         ocf_ytd = COALESCE(EXCLUDED.ocf_ytd, company_finder_companies.ocf_ytd),
         ocf_as_of = COALESCE(EXCLUDED.ocf_as_of, company_finder_companies.ocf_as_of),
         ocf_period = COALESCE(EXCLUDED.ocf_period, company_finder_companies.ocf_period),
         score = EXCLUDED.score,
         ocf_per_week = EXCLUDED.ocf_per_week,
         est_per_share_per_week = EXCLUDED.est_per_share_per_week,
         weekly_ocf_yield_pct = EXCLUDED.weekly_ocf_yield_pct,
         data_quality = EXCLUDED.data_quality,
         error_message = EXCLUDED.error_message,
         facts_fetched_at = COALESCE(EXCLUDED.facts_fetched_at, company_finder_companies.facts_fetched_at),
         quote_fetched_at = COALESCE(EXCLUDED.quote_fetched_at, company_finder_companies.quote_fetched_at),
         computed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [
        row.ticker,
        row.cik,
        row.name,
        row.exchange,
        row.price,
        row.sharesOutstanding,
        row.marketCap,
        row.cash,
        row.cashAsOf,
        row.ocfYtd,
        row.ocfAsOf,
        row.ocfPeriod,
        row.score,
        row.ocfPerWeek,
        row.estPerSharePerWeek,
        row.weeklyOcfYieldPct,
        row.dataQuality,
        row.errorMessage,
        row.factsFetchedAt,
        row.quoteFetchedAt,
      ]
    );
  }
}

export async function listCompanyFinder(filters: CompanyFinderListFilters = {}): Promise<{
  rows: CompanyFinderRow[];
  total: number;
}> {
  const where: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (filters.candidatesOnly !== false) {
    where.push(`score < 0`);
    where.push(`market_cap IS NOT NULL`);
    where.push(`cash IS NOT NULL`);
  }
  if (filters.q?.trim()) {
    where.push(`(ticker ILIKE $${i} OR name ILIKE $${i})`);
    params.push(`%${filters.q.trim()}%`);
    i += 1;
  }
  if (filters.minMarketCap != null && Number.isFinite(filters.minMarketCap)) {
    where.push(`market_cap >= $${i}`);
    params.push(filters.minMarketCap);
    i += 1;
  }
  if (filters.maxMarketCap != null && Number.isFinite(filters.maxMarketCap)) {
    where.push(`market_cap <= $${i}`);
    params.push(filters.maxMarketCap);
    i += 1;
  }
  if (filters.minCash != null && Number.isFinite(filters.minCash)) {
    where.push(`cash >= $${i}`);
    params.push(filters.minCash);
    i += 1;
  }
  if (filters.minOcfYtd != null && Number.isFinite(filters.minOcfYtd)) {
    where.push(`ocf_ytd >= $${i}`);
    params.push(filters.minOcfYtd);
    i += 1;
  }
  if (filters.maxScore != null && Number.isFinite(filters.maxScore)) {
    where.push(`score <= $${i}`);
    params.push(filters.maxScore);
    i += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const offset = Math.max(filters.offset ?? 0, 0);

  const countRes = await query(
    `SELECT COUNT(*)::int AS n FROM company_finder_companies ${whereSql}`,
    params
  );
  const listRes = await query(
    `SELECT *
     FROM company_finder_companies
     ${whereSql}
     ORDER BY score ASC NULLS LAST, market_cap DESC NULLS LAST, ticker ASC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...params, limit, offset]
  );

  return {
    total: Number(countRes.rows[0]?.n) || 0,
    rows: listRes.rows.map((r) => mapRow(r as Record<string, unknown>)),
  };
}

export async function getCompanyFinderStats(): Promise<{
  total: number;
  candidates: number;
  withMarketCap: number;
}> {
  const res = await query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE score < 0 AND market_cap IS NOT NULL AND cash IS NOT NULL)::int AS candidates,
       COUNT(*) FILTER (WHERE market_cap IS NOT NULL)::int AS with_market_cap
     FROM company_finder_companies`
  );
  const row = res.rows[0] || {};
  return {
    total: Number(row.total) || 0,
    candidates: Number(row.candidates) || 0,
    withMarketCap: Number(row.with_market_cap) || 0,
  };
}
