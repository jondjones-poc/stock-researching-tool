import axios from 'axios';
import { query } from './db';

export const STOCK_RESEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const STOCK_RESEARCH_MIGRATION_HINT =
  'Run: node scripts/apply-stock-research-cache.mjs';

export interface StockResearchPayload {
  symbol: string;
  name: string | null;
  pe: number | null;
  forwardPe: number | null;
  marketCap: number | null;
  freeCashFlow: number | null;
  sector: string | null;
  industry: string | null;
  eps: number | null;
  dividendYield: number | null;
  price: number | null;
  changePercent: number | null;
}

function isFresh(fetchedAt: Date): boolean {
  return Date.now() - fetchedAt.getTime() < STOCK_RESEARCH_CACHE_TTL_MS;
}

export async function readStockResearchCache(
  symbol: string,
  opts?: { allowStale?: boolean }
): Promise<{
  payload: StockResearchPayload;
  source: string;
  fetchedAt: Date;
  fresh: boolean;
} | null> {
  try {
    const result = await query(
      `SELECT payload, source, fetched_at
       FROM stock_research_cache
       WHERE symbol = $1`,
      [symbol.toUpperCase()]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    const fetchedAt = new Date(row.fetched_at);
    const fresh = isFresh(fetchedAt);
    if (!fresh && !opts?.allowStale) return null;
    const payload = row.payload as StockResearchPayload;
    if (!payload || typeof payload !== 'object') return null;
    return {
      payload: { ...payload, symbol: symbol.toUpperCase() },
      source: String(row.source || 'CACHE'),
      fetchedAt,
      fresh,
    };
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '42P01') {
      console.warn(`stock_research_cache missing — ${STOCK_RESEARCH_MIGRATION_HINT}`);
      return null;
    }
    throw err;
  }
}

export async function writeStockResearchCache(
  symbol: string,
  payload: StockResearchPayload,
  source = 'LIVE'
): Promise<void> {
  try {
    await query(
      `INSERT INTO stock_research_cache (symbol, payload, source, fetched_at)
       VALUES ($1, $2::jsonb, $3, NOW())
       ON CONFLICT (symbol) DO UPDATE
       SET payload = EXCLUDED.payload,
           source = EXCLUDED.source,
           fetched_at = NOW()`,
      [symbol.toUpperCase(), JSON.stringify(payload), source]
    );
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === '42P01') {
      console.warn(`stock_research_cache missing — ${STOCK_RESEARCH_MIGRATION_HINT}`);
      return;
    }
    console.warn('Failed to write stock_research_cache:', (err as Error).message);
  }
}

async function fetchLiveStockResearch(
  symbol: string
): Promise<StockResearchPayload> {
  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
  const FMP_API_KEY = process.env.FMP_API_KEY;
  const sym = symbol.toUpperCase();

  if (!FINNHUB_API_KEY) {
    throw new Error('FINNHUB_API_KEY is not configured');
  }

  const [quoteRes, metricsRes, profileRes, keyMetricsRes, cashFlowRes] =
    await Promise.allSettled([
      axios.get(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_API_KEY}`, {
        timeout: 10000,
      }),
      axios.get(
        `https://finnhub.io/api/v1/stock/metric?symbol=${sym}&metric=all&token=${FINNHUB_API_KEY}`,
        { timeout: 10000 }
      ),
      axios.get(
        `https://finnhub.io/api/v1/stock/profile2?symbol=${sym}&token=${FINNHUB_API_KEY}`,
        { timeout: 10000 }
      ),
      FMP_API_KEY
        ? axios.get(
            `https://financialmodelingprep.com/stable/key-metrics?symbol=${sym}&limit=1&apikey=${FMP_API_KEY}`,
            { timeout: 10000 }
          )
        : Promise.resolve({ data: null }),
      FMP_API_KEY
        ? axios.get(
            `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${sym}&limit=1&apikey=${FMP_API_KEY}`,
            { timeout: 10000 }
          )
        : Promise.resolve({ data: null }),
    ]);

  const payload: StockResearchPayload = {
    symbol: sym,
    name: null,
    pe: null,
    forwardPe: null,
    marketCap: null,
    freeCashFlow: null,
    sector: null,
    industry: null,
    eps: null,
    dividendYield: null,
    price: null,
    changePercent: null,
  };

  if (quoteRes.status === 'fulfilled' && quoteRes.value.data) {
    const quote = quoteRes.value.data;
    payload.price = quote.c ?? null;
    payload.changePercent = quote.dp ?? null;
    payload.marketCap = quote.mc ?? null;
  }

  if (metricsRes.status === 'fulfilled' && metricsRes.value.data?.metric) {
    const metric = metricsRes.value.data.metric;
    payload.eps = metric.epsTTM ?? null;
    if (payload.price && payload.eps && payload.eps > 0) {
      payload.pe = payload.price / payload.eps;
    } else if (metric.peTTM) {
      payload.pe = metric.peTTM;
    }
    payload.forwardPe = metric.forwardPE ?? null;
    payload.dividendYield = metric.currentDividendYieldTTM ?? null;
  }

  if (
    !payload.marketCap &&
    keyMetricsRes.status === 'fulfilled' &&
    Array.isArray(keyMetricsRes.value.data) &&
    keyMetricsRes.value.data[0]?.marketCap
  ) {
    payload.marketCap = keyMetricsRes.value.data[0].marketCap;
  }

  if (
    cashFlowRes.status === 'fulfilled' &&
    Array.isArray(cashFlowRes.value.data) &&
    cashFlowRes.value.data[0]
  ) {
    const cf = cashFlowRes.value.data[0];
    const ocf = cf.netCashProvidedByOperatingActivities || 0;
    const capex = Math.abs(cf.capitalExpenditure || 0);
    const fcf = ocf - capex;
    if (fcf !== 0) payload.freeCashFlow = fcf;
  }

  if (profileRes.status === 'fulfilled' && profileRes.value.data) {
    const profile = profileRes.value.data;
    payload.name = profile.name ?? null;
    payload.sector = profile.finnhubIndustry ?? null;
    payload.industry = profile.finnhubIndustry ?? null;
  }

  return payload;
}

/**
 * Return stock-search fundamentals from DB when fresher than 24h.
 * Otherwise fetch live, write cache, and return.
 */
export async function resolveStockResearch(
  symbol: string,
  opts?: { forceRefresh?: boolean }
): Promise<{
  payload: StockResearchPayload;
  source: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
}> {
  const sym = symbol.toUpperCase();

  if (!opts?.forceRefresh) {
    const cached = await readStockResearchCache(sym, { allowStale: true });
    if (cached?.fresh) {
      return {
        payload: cached.payload,
        source: `${cached.source}_CACHE`,
        fetchedAt: cached.fetchedAt.toISOString(),
        cached: true,
        stale: false,
      };
    }
  }

  try {
    const payload = await fetchLiveStockResearch(sym);
    await writeStockResearchCache(sym, payload, 'LIVE');
    return {
      payload,
      source: 'LIVE',
      fetchedAt: new Date().toISOString(),
      cached: false,
      stale: false,
    };
  } catch (err) {
    const stale = await readStockResearchCache(sym, { allowStale: true });
    if (stale) {
      return {
        payload: stale.payload,
        source: `${stale.source}_STALE_CACHE`,
        fetchedAt: stale.fetchedAt.toISOString(),
        cached: true,
        stale: true,
      };
    }
    throw err;
  }
}
