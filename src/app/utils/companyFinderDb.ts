import { query } from './db';
import {
  computeConfidenceFromFlags,
  confidenceToStars,
  type ConfidenceFinding,
  type ConfidenceFlags,
} from './companyFinderConfidence';

export interface CompanyFinderRow {
  ticker: string;
  cik: string;
  name: string | null;
  exchange: string | null;
  sector: string | null;
  country: string | null;
  price: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  cash: number | null;
  cashAsOf: string | null;
  totalDebt: number | null;
  totalDebtAsOf: string | null;
  totalDebtSource: string | null;
  netCash: number | null;
  ocfYtd: number | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  fcfYtd: number | null;
  fcfAsOf: string | null;
  fcfPeriod: string | null;
  fcfSource: string | null;
  score: number | null;
  ocfPerWeek: number | null;
  estPerSharePerWeek: number | null;
  weeklyOcfYieldPct: number | null;
  /** Data reliability 0–100 (recomputed from cached flags + filing age on read). */
  confidenceScore: number | null;
  confidenceStars: number | null;
  confidenceReasons: ConfidenceFinding[];
  confidenceLatestFilingDate: string | null;
  dataQuality: 'ok' | 'partial' | 'missing';
  errorMessage: string | null;
  factsFetchedAt: string | null;
  quoteFetchedAt: string | null;
  computedAt: string | null;
  updatedAt: string | null;
}

export interface CompanyFinderListFilters {
  /** Minimum cash / marketCap percentage (e.g. 90). */
  minCashToMarketPct?: number | null;
  /**
   * Minimum net_cash / marketCap percentage (e.g. 20).
   * When 0 or unset, no percentage threshold is applied.
   */
  minNetCashToMarketPct?: number | null;
  /** Keep rows where SEC Total Debt was missing (net_cash IS NULL). Off by default. */
  includeMissingNetCash?: boolean;
  q?: string;
  sector?: string | null;
  country?: string | null;
  minMarketCap?: number | null;
  maxMarketCap?: number | null;
  minCash?: number | null;
  minOcfYtd?: number | null;
  minFcfYtd?: number | null;
  /** Minimum free cash flow / marketCap percentage (e.g. 20). */
  minFcfToMarketPct?: number | null;
  /** Minimum confidence stars (1–5). Uses stored confidence_score bands. */
  minConfidenceStars?: number | null;
  maxScore?: number | null;
  limit?: number;
  offset?: number;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseReasons(raw: unknown): ConfidenceFinding[] {
  if (!raw) return [];
  let value = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const code = row.code != null ? String(row.code) : '';
      const message = row.message != null ? String(row.message) : '';
      const points = Number(row.points);
      if (!code || !message || !Number.isFinite(points)) return null;
      return { code, message, points };
    })
    .filter((x): x is ConfidenceFinding => x != null);
}

function mapRow(row: Record<string, unknown>): CompanyFinderRow {
  const filingDate =
    row.confidence_latest_filing_date != null
      ? String(row.confidence_latest_filing_date).slice(0, 10)
      : null;
  const hasConfidenceCache =
    row.confidence_latest_accession != null ||
    row.confidence_flag_going_concern != null ||
    row.confidence_is_foreign != null;

  let confidenceScore: number | null = num(row.confidence_score);
  let confidenceReasons = parseReasons(row.confidence_reasons);

  // Recompute from cached flags so staleness stays current between scrapes.
  if (hasConfidenceCache) {
    const flags: ConfidenceFlags = {
      isForeignIssuer: Boolean(row.confidence_is_foreign),
      goingConcern: Boolean(row.confidence_flag_going_concern),
      reverseSplit: Boolean(row.confidence_flag_reverse_split),
      discontinued: Boolean(row.confidence_flag_discontinued),
    };
    const live = computeConfidenceFromFlags({
      latestFilingDate: filingDate,
      latestForm: row.confidence_latest_form != null ? String(row.confidence_latest_form) : null,
      latestAccession:
        row.confidence_latest_accession != null ? String(row.confidence_latest_accession) : null,
      flags,
    });
    confidenceScore = live.score;
    confidenceReasons = live.findings;
  }

  return {
    ticker: String(row.ticker),
    cik: String(row.cik),
    name: row.name != null ? String(row.name) : null,
    exchange: row.exchange != null ? String(row.exchange) : null,
    sector: row.sector != null ? String(row.sector) : null,
    country: row.country != null ? String(row.country) : null,
    price: num(row.price),
    sharesOutstanding: num(row.shares_outstanding),
    marketCap: num(row.market_cap),
    cash: num(row.cash),
    cashAsOf: row.cash_as_of != null ? String(row.cash_as_of).slice(0, 10) : null,
    totalDebt: num(row.total_debt),
    totalDebtAsOf: row.total_debt_as_of != null ? String(row.total_debt_as_of).slice(0, 10) : null,
    totalDebtSource: row.total_debt_source != null ? String(row.total_debt_source) : null,
    netCash: num(row.net_cash),
    ocfYtd: num(row.ocf_ytd),
    ocfAsOf: row.ocf_as_of != null ? String(row.ocf_as_of).slice(0, 10) : null,
    ocfPeriod: row.ocf_period != null ? String(row.ocf_period) : null,
    fcfYtd: num(row.fcf_ytd),
    fcfAsOf: row.fcf_as_of != null ? String(row.fcf_as_of).slice(0, 10) : null,
    fcfPeriod: row.fcf_period != null ? String(row.fcf_period) : null,
    fcfSource: row.fcf_source != null ? String(row.fcf_source) : null,
    score: num(row.score),
    ocfPerWeek: num(row.ocf_per_week),
    estPerSharePerWeek: num(row.est_per_share_per_week),
    weeklyOcfYieldPct: num(row.weekly_ocf_yield_pct),
    confidenceScore,
    confidenceStars: confidenceToStars(confidenceScore),
    confidenceReasons,
    confidenceLatestFilingDate: filingDate,
    dataQuality: (row.data_quality as CompanyFinderRow['dataQuality']) || 'partial',
    errorMessage: row.error_message != null ? String(row.error_message) : null,
    factsFetchedAt: row.facts_fetched_at != null ? String(row.facts_fetched_at) : null,
    quoteFetchedAt: row.quote_fetched_at != null ? String(row.quote_fetched_at) : null,
    computedAt: row.computed_at != null ? String(row.computed_at) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };
}

export async function getCompanyFinderConfidenceCache(ticker: string): Promise<{
  latestAccession: string | null;
  latestFilingDate: string | null;
  latestForm: string | null;
  flags: ConfidenceFlags;
} | null> {
  const res = await query(
    `SELECT confidence_latest_accession, confidence_latest_filing_date, confidence_latest_form,
            confidence_is_foreign, confidence_flag_going_concern,
            confidence_flag_reverse_split, confidence_flag_discontinued
     FROM company_finder_companies
     WHERE ticker = $1
     LIMIT 1`,
    [ticker.toUpperCase()]
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row || row.confidence_latest_accession == null) return null;
  return {
    latestAccession: String(row.confidence_latest_accession),
    latestFilingDate:
      row.confidence_latest_filing_date != null
        ? String(row.confidence_latest_filing_date).slice(0, 10)
        : null,
    latestForm: row.confidence_latest_form != null ? String(row.confidence_latest_form) : null,
    flags: {
      isForeignIssuer: Boolean(row.confidence_is_foreign),
      goingConcern: Boolean(row.confidence_flag_going_concern),
      reverseSplit: Boolean(row.confidence_flag_reverse_split),
      discontinued: Boolean(row.confidence_flag_discontinued),
    },
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
    sector: string | null;
    country: string | null;
    price: number | null;
    sharesOutstanding: number | null;
    marketCap: number | null;
    cash: number | null;
    cashAsOf: string | null;
    totalDebt: number | null;
    totalDebtAsOf: string | null;
    totalDebtSource: string | null;
    netCash: number | null;
    ocfYtd: number | null;
    ocfAsOf: string | null;
    ocfPeriod: string | null;
    fcfYtd: number | null;
    fcfAsOf: string | null;
    fcfPeriod: string | null;
    fcfSource: string | null;
    score: number | null;
    ocfPerWeek: number | null;
    estPerSharePerWeek: number | null;
    weeklyOcfYieldPct: number | null;
    confidenceScore?: number | null;
    confidenceReasons?: ConfidenceFinding[] | null;
    confidenceLatestFilingDate?: string | null;
    confidenceLatestAccession?: string | null;
    confidenceLatestForm?: string | null;
    confidenceIsForeign?: boolean | null;
    confidenceFlagGoingConcern?: boolean | null;
    confidenceFlagReverseSplit?: boolean | null;
    confidenceFlagDiscontinued?: boolean | null;
    dataQuality: 'ok' | 'partial' | 'missing';
    errorMessage: string | null;
    factsFetchedAt: string | null;
    quoteFetchedAt: string | null;
  }>
): Promise<void> {
  for (const row of rows) {
    await query(
      `INSERT INTO company_finder_companies (
         ticker, cik, name, exchange, sector, country, price, shares_outstanding, market_cap,
         cash, cash_as_of, total_debt, total_debt_as_of, total_debt_source, net_cash,
         ocf_ytd, ocf_as_of, ocf_period,
         fcf_ytd, fcf_as_of, fcf_period, fcf_source,
         score, ocf_per_week, est_per_share_per_week, weekly_ocf_yield_pct,
         confidence_score, confidence_reasons, confidence_latest_filing_date,
         confidence_latest_accession, confidence_latest_form, confidence_is_foreign,
         confidence_flag_going_concern, confidence_flag_reverse_split, confidence_flag_discontinued,
         confidence_computed_at,
         data_quality, error_message, facts_fetched_at, quote_fetched_at,
         computed_at, updated_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,
         $10,$11::date,$12,$13::date,$14,$15,
         $16,$17::date,$18,
         $19,$20::date,$21,$22,
         $23,$24,$25,$26,
         $27::int,$28::jsonb,$29::date,
         $30,$31,$32,
         $33,$34,$35,
         CASE WHEN $27::int IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END,
         $36,$37,$38::timestamptz,$39::timestamptz,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       ON CONFLICT (ticker) DO UPDATE SET
         cik = EXCLUDED.cik,
         name = COALESCE(EXCLUDED.name, company_finder_companies.name),
         exchange = COALESCE(EXCLUDED.exchange, company_finder_companies.exchange),
         sector = COALESCE(EXCLUDED.sector, company_finder_companies.sector),
         country = COALESCE(EXCLUDED.country, company_finder_companies.country),
         price = COALESCE(EXCLUDED.price, company_finder_companies.price),
         shares_outstanding = COALESCE(EXCLUDED.shares_outstanding, company_finder_companies.shares_outstanding),
         market_cap = COALESCE(EXCLUDED.market_cap, company_finder_companies.market_cap),
         cash = COALESCE(EXCLUDED.cash, company_finder_companies.cash),
         cash_as_of = COALESCE(EXCLUDED.cash_as_of, company_finder_companies.cash_as_of),
         total_debt = CASE
           WHEN EXCLUDED.facts_fetched_at IS NOT NULL THEN EXCLUDED.total_debt
           ELSE company_finder_companies.total_debt
         END,
         total_debt_as_of = CASE
           WHEN EXCLUDED.facts_fetched_at IS NOT NULL THEN EXCLUDED.total_debt_as_of
           ELSE company_finder_companies.total_debt_as_of
         END,
         total_debt_source = CASE
           WHEN EXCLUDED.facts_fetched_at IS NOT NULL THEN EXCLUDED.total_debt_source
           ELSE company_finder_companies.total_debt_source
         END,
         net_cash = CASE
           WHEN EXCLUDED.facts_fetched_at IS NOT NULL THEN EXCLUDED.net_cash
           ELSE company_finder_companies.net_cash
         END,
         ocf_ytd = COALESCE(EXCLUDED.ocf_ytd, company_finder_companies.ocf_ytd),
         ocf_as_of = COALESCE(EXCLUDED.ocf_as_of, company_finder_companies.ocf_as_of),
         ocf_period = COALESCE(EXCLUDED.ocf_period, company_finder_companies.ocf_period),
         fcf_ytd = COALESCE(EXCLUDED.fcf_ytd, company_finder_companies.fcf_ytd),
         fcf_as_of = COALESCE(EXCLUDED.fcf_as_of, company_finder_companies.fcf_as_of),
         fcf_period = COALESCE(EXCLUDED.fcf_period, company_finder_companies.fcf_period),
         fcf_source = COALESCE(EXCLUDED.fcf_source, company_finder_companies.fcf_source),
         score = EXCLUDED.score,
         ocf_per_week = EXCLUDED.ocf_per_week,
         est_per_share_per_week = EXCLUDED.est_per_share_per_week,
         weekly_ocf_yield_pct = EXCLUDED.weekly_ocf_yield_pct,
         confidence_score = COALESCE(EXCLUDED.confidence_score, company_finder_companies.confidence_score),
         confidence_reasons = COALESCE(EXCLUDED.confidence_reasons, company_finder_companies.confidence_reasons),
         confidence_latest_filing_date = COALESCE(EXCLUDED.confidence_latest_filing_date, company_finder_companies.confidence_latest_filing_date),
         confidence_latest_accession = COALESCE(EXCLUDED.confidence_latest_accession, company_finder_companies.confidence_latest_accession),
         confidence_latest_form = COALESCE(EXCLUDED.confidence_latest_form, company_finder_companies.confidence_latest_form),
         confidence_is_foreign = COALESCE(EXCLUDED.confidence_is_foreign, company_finder_companies.confidence_is_foreign),
         confidence_flag_going_concern = COALESCE(EXCLUDED.confidence_flag_going_concern, company_finder_companies.confidence_flag_going_concern),
         confidence_flag_reverse_split = COALESCE(EXCLUDED.confidence_flag_reverse_split, company_finder_companies.confidence_flag_reverse_split),
         confidence_flag_discontinued = COALESCE(EXCLUDED.confidence_flag_discontinued, company_finder_companies.confidence_flag_discontinued),
         confidence_computed_at = CASE
           WHEN EXCLUDED.confidence_score IS NOT NULL THEN CURRENT_TIMESTAMP
           ELSE company_finder_companies.confidence_computed_at
         END,
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
        row.sector,
        row.country,
        row.price,
        row.sharesOutstanding,
        row.marketCap,
        row.cash,
        row.cashAsOf,
        row.totalDebt,
        row.totalDebtAsOf,
        row.totalDebtSource,
        row.netCash,
        row.ocfYtd,
        row.ocfAsOf,
        row.ocfPeriod,
        row.fcfYtd,
        row.fcfAsOf,
        row.fcfPeriod,
        row.fcfSource,
        row.score,
        row.ocfPerWeek,
        row.estPerSharePerWeek,
        row.weeklyOcfYieldPct,
        row.confidenceScore ?? null,
        row.confidenceReasons != null ? JSON.stringify(row.confidenceReasons) : null,
        row.confidenceLatestFilingDate ?? null,
        row.confidenceLatestAccession ?? null,
        row.confidenceLatestForm ?? null,
        row.confidenceIsForeign ?? null,
        row.confidenceFlagGoingConcern ?? null,
        row.confidenceFlagReverseSplit ?? null,
        row.confidenceFlagDiscontinued ?? null,
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
  const where: string[] = [
    // Hide warrants/units/rights when the common share for the *same CIK* is also cached
    // (e.g. ABLVW when ABLV exists). Do not match unrelated shorter tickers (ACIW vs ACI).
    `NOT EXISTS (
       SELECT 1
       FROM company_finder_companies parent
       WHERE parent.cik = company_finder_companies.cik
         AND parent.ticker = regexp_replace(company_finder_companies.ticker, '(WS|WT|WW|W|U|R|Z)$', '')
         AND parent.ticker <> company_finder_companies.ticker
         AND company_finder_companies.ticker ~ '(WS|WT|WW|W|U|R|Z)$'
     )`,
  ];
  const params: unknown[] = [];
  let i = 1;

  if (filters.minCashToMarketPct != null && Number.isFinite(filters.minCashToMarketPct)) {
    where.push(`market_cap IS NOT NULL AND market_cap > 0`);
    where.push(`cash IS NOT NULL`);
    where.push(`(cash / market_cap) * 100 >= $${i}`);
    params.push(filters.minCashToMarketPct);
    i += 1;
  }
  if (!filters.includeMissingNetCash) {
    where.push(`net_cash IS NOT NULL`);
  }
  if (
    filters.minNetCashToMarketPct != null &&
    Number.isFinite(filters.minNetCashToMarketPct) &&
    filters.minNetCashToMarketPct > 0
  ) {
    where.push(`net_cash IS NOT NULL`);
    where.push(`market_cap IS NOT NULL AND market_cap > 0`);
    where.push(`(net_cash / market_cap) * 100 >= $${i}`);
    params.push(filters.minNetCashToMarketPct);
    i += 1;
  }
  if (filters.q?.trim()) {
    where.push(`(ticker ILIKE $${i} OR name ILIKE $${i})`);
    params.push(`%${filters.q.trim()}%`);
    i += 1;
  }
  if (filters.sector?.trim()) {
    where.push(`sector = $${i}`);
    params.push(filters.sector.trim());
    i += 1;
  }
  if (filters.country?.trim()) {
    where.push(`country = $${i}`);
    params.push(filters.country.trim());
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
  if (filters.minFcfYtd != null && Number.isFinite(filters.minFcfYtd)) {
    where.push(`fcf_ytd >= $${i}`);
    params.push(filters.minFcfYtd);
    i += 1;
  }
  if (filters.minFcfToMarketPct != null && Number.isFinite(filters.minFcfToMarketPct) && filters.minFcfToMarketPct > 0) {
    where.push(`fcf_ytd IS NOT NULL`);
    where.push(`market_cap IS NOT NULL AND market_cap > 0`);
    where.push(`(fcf_ytd / market_cap) * 100 >= $${i}`);
    params.push(filters.minFcfToMarketPct);
    i += 1;
  }
  if (
    filters.minConfidenceStars != null &&
    Number.isFinite(filters.minConfidenceStars) &&
    filters.minConfidenceStars > 0
  ) {
    const stars = Math.min(5, Math.max(1, Math.floor(filters.minConfidenceStars)));
    // Match confidenceToStars bands: 5→≥90, 4→≥70, 3→≥50, 2→≥30, 1→≥10
    const minScore = stars === 5 ? 90 : stars === 4 ? 70 : stars === 3 ? 50 : stars === 2 ? 30 : 10;
    where.push(`confidence_score IS NOT NULL`);
    where.push(`confidence_score >= $${i}`);
    params.push(minScore);
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
     ORDER BY
       CASE WHEN market_cap > 0 AND cash IS NOT NULL THEN cash / market_cap ELSE NULL END DESC NULLS LAST,
       score ASC NULLS LAST,
       market_cap DESC NULLS LAST,
       ticker ASC
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
       COUNT(*) FILTER (
         WHERE cash IS NOT NULL
           AND market_cap IS NOT NULL
           AND market_cap > 0
           AND (cash / market_cap) * 100 >= 90
       )::int AS candidates,
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

/** Distinct sector / country values currently in the cache (for UI filter dropdowns). */
export async function getCompanyFinderFacets(): Promise<{
  sectors: string[];
  countries: string[];
}> {
  const [sectorsRes, countriesRes] = await Promise.all([
    query(
      `SELECT sector AS value
       FROM company_finder_companies
       WHERE sector IS NOT NULL AND TRIM(sector) <> ''
       GROUP BY sector
       ORDER BY sector ASC`
    ),
    query(
      `SELECT country AS value
       FROM company_finder_companies
       WHERE country IS NOT NULL AND TRIM(country) <> ''
       GROUP BY country
       ORDER BY country ASC`
    ),
  ]);
  return {
    sectors: sectorsRes.rows.map((r) => String(r.value)),
    countries: countriesRes.rows.map((r) => String(r.value)),
  };
}
