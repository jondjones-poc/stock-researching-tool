import axios from 'axios';
import { query } from './db';
import { loadEtoroHoldingSymbols } from './etoroLiveHoldings';
import { isUsableEtoroTicker } from './etoroTicker';

export interface DashboardStockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  dataSource: 'FINNHUB' | 'FMP' | 'CACHE';
  fetchedAt?: string;
}

const SPECIAL_NON_STOCK = new Set(['GREED', 'AII']);

export function isDashboardStockSymbol(row: {
  symbol: string;
  data_source?: string | null;
  dataSource?: string | null;
  fred_series_id?: string | null;
  fredSeriesId?: string | null;
}): boolean {
  const symbol = String(row.symbol || '').toUpperCase();
  if (!symbol || SPECIAL_NON_STOCK.has(symbol)) return false;
  const source = (row.data_source || row.dataSource || '').toUpperCase();
  if (source === 'FRED') return false;
  if (row.fred_series_id || row.fredSeriesId) return false;
  return true;
}

/** Active homepage stock/ETF symbols from dashboard_watchlist (excludes FRED / GREED / AII). */
export async function loadDashboardStockSymbols(): Promise<
  { symbol: string; name: string }[]
> {
  const result = await query(
    `SELECT symbol, name, data_source, fred_series_id
     FROM dashboard_watchlist
     WHERE is_active = TRUE
     ORDER BY category, display_order, symbol`
  );

  const out: { symbol: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const row of result.rows) {
    if (!isDashboardStockSymbol(row)) continue;
    const symbol = String(row.symbol).toUpperCase();
    if (seen.has(symbol)) continue;
    seen.add(symbol);
    out.push({ symbol, name: row.name || symbol });
  }

  try {
    const { symbols } = await loadEtoroHoldingSymbols();
    for (const holding of symbols) {
      const symbol = String(holding.symbol || '').trim().toUpperCase();
      if (!symbol || seen.has(symbol) || !isUsableEtoroTicker(symbol)) continue;
      seen.add(symbol);
      out.push({ symbol, name: holding.name || symbol });
    }
  } catch (error) {
    console.warn('dashboard quotes: skipped eToro holdings', error);
  }

  return out;
}

export async function loadCachedDashboardStockQuotes(
  symbols: string[]
): Promise<Map<string, DashboardStockQuote>> {
  const result = new Map<string, DashboardStockQuote>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return result;

  try {
    const rows = await query(
      `SELECT symbol, name, price, change_abs, change_pct, volume, market_cap, data_source, fetched_at
       FROM dashboard_stock_quotes
       WHERE symbol = ANY($1::text[])`,
      [unique]
    );
    for (const row of rows.rows) {
      result.set(String(row.symbol).toUpperCase(), {
        symbol: String(row.symbol).toUpperCase(),
        name: row.name || row.symbol,
        price: Number(row.price) || 0,
        change: Number(row.change_abs) || 0,
        changePercent: Number(row.change_pct) || 0,
        volume: Number(row.volume) || 0,
        marketCap: Number(row.market_cap) || 0,
        dataSource: 'CACHE',
        fetchedAt:
          row.fetched_at instanceof Date
            ? row.fetched_at.toISOString()
            : String(row.fetched_at),
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  return result;
}

async function upsertDashboardStockQuotes(
  quotes: Map<string, DashboardStockQuote>
): Promise<void> {
  for (const q of quotes.values()) {
    if (q.dataSource === 'CACHE') continue;
    await query(
      `INSERT INTO dashboard_stock_quotes
         (symbol, name, price, change_abs, change_pct, volume, market_cap, data_source, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (symbol) DO UPDATE SET
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         change_abs = EXCLUDED.change_abs,
         change_pct = EXCLUDED.change_pct,
         volume = EXCLUDED.volume,
         market_cap = EXCLUDED.market_cap,
         data_source = EXCLUDED.data_source,
         fetched_at = NOW()`,
      [
        q.symbol,
        q.name,
        q.price,
        q.change,
        q.changePercent,
        q.volume || null,
        q.marketCap || null,
        q.dataSource === 'FMP' ? 'FMP' : 'FINNHUB',
      ]
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch homepage stock quotes: Finnhub first (one symbol at a time),
 * then a single FMP batch only for symbols Finnhub cannot quote (e.g. GCUSD / SIUSD).
 */
export async function fetchFinnhubQuotesForDashboard(
  items: { symbol: string; name: string }[]
): Promise<{
  quotes: Map<string, DashboardStockQuote>;
  fetched: number;
  failed: string[];
  warning?: string;
}> {
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
  const quotes = new Map<string, DashboardStockQuote>();
  const failed: string[] = [];

  if (!finnhubKey) {
    return {
      quotes,
      fetched: 0,
      failed: items.map((i) => i.symbol),
      warning: 'FINNHUB_API_KEY not set',
    };
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const response = await axios.get('https://finnhub.io/api/v1/quote', {
        params: { symbol: item.symbol, token: finnhubKey },
        timeout: 8000,
      });
      const q = response.data;
      if (q && typeof q.c === 'number' && Number.isFinite(q.c) && q.c > 0) {
        quotes.set(item.symbol, {
          symbol: item.symbol,
          name: item.name,
          price: q.c,
          change: Number(q.d) || 0,
          changePercent: Number(q.dp) || 0,
          volume: 0,
          marketCap: 0,
          dataSource: 'FINNHUB',
        });
      } else {
        failed.push(item.symbol);
      }
    } catch {
      failed.push(item.symbol);
    }
    if (i < items.length - 1) await sleep(200);
  }

  // FMP only for symbols Finnhub cannot quote (precious-metal futures tickers, etc.).
  const stillMissing = failed.filter((s) => !quotes.has(s));
  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (stillMissing.length > 0 && fmpKey) {
    try {
      const response = await axios.get(
        `https://financialmodelingprep.com/stable/quote?symbol=${stillMissing.join(',')}&apikey=${fmpKey}`,
        { timeout: 15000 }
      );
      if (Array.isArray(response.data)) {
        const nameBySymbol = new Map(items.map((i) => [i.symbol, i.name]));
        for (const quote of response.data) {
          if (!quote?.symbol || !(Number(quote.price) > 0)) continue;
          const symbol = String(quote.symbol).toUpperCase();
          quotes.set(symbol, {
            symbol,
            name: quote.name || nameBySymbol.get(symbol) || symbol,
            price: Number(quote.price) || 0,
            change: Number(quote.change) || 0,
            changePercent: Number(quote.changesPercentage) || 0,
            volume: Number(quote.volume) || 0,
            marketCap: Number(quote.marketCap) || 0,
            dataSource: 'FMP',
          });
        }
      }
    } catch {
      /* leave missing */
    }
  }

  const failedFinal = items.map((i) => i.symbol).filter((s) => !quotes.has(s));

  return {
    quotes,
    fetched: quotes.size,
    failed: failedFinal,
    warning:
      failedFinal.length > 0
        ? `Missed ${failedFinal.length} symbol(s): ${failedFinal.slice(0, 8).join(', ')}${failedFinal.length > 8 ? '…' : ''}`
        : undefined,
  };
}

/** Latest fetched_at across the homepage stock quote cache (null if empty). */
export async function getDashboardStockQuotesCacheUpdatedAt(): Promise<string | null> {
  try {
    const rows = await query(
      `SELECT MAX(fetched_at) AS latest FROM dashboard_stock_quotes`
    );
    const latest = rows.rows[0]?.latest;
    if (!latest) return null;
    return latest instanceof Date ? latest.toISOString() : String(latest);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === '42P01') return null;
    throw error;
  }
}

/** Daily warm: load dashboard stock symbols, fetch Finnhub, upsert cache. */
export async function refreshDashboardStockQuotes(): Promise<{
  ok: boolean;
  symbolCount: number;
  refreshedCount: number;
  failed: string[];
  warning?: string;
  cacheUpdatedAt: string | null;
}> {
  const items = await loadDashboardStockSymbols();
  const { quotes, fetched, failed, warning } = await fetchFinnhubQuotesForDashboard(items);

  if (quotes.size > 0) {
    await upsertDashboardStockQuotes(quotes);
  }

  const cacheUpdatedAt = await getDashboardStockQuotesCacheUpdatedAt();

  return {
    ok: fetched > 0 || items.length === 0,
    symbolCount: items.length,
    refreshedCount: fetched,
    failed,
    warning,
    cacheUpdatedAt,
  };
}

/**
 * Resolve homepage stock quotes from cache.
 * For any missing symbols, fetch Finnhub on demand and backfill (first visit / new symbol).
 */
export async function resolveDashboardStockQuotes(
  items: { symbol: string; name: string }[],
  options?: { fillMissingLive?: boolean }
): Promise<{
  quotes: Map<string, DashboardStockQuote>;
  fromCache: number;
  liveFilled: number;
  warning?: string;
}> {
  const symbols = items.map((i) => i.symbol.toUpperCase());
  const nameBySymbol = new Map(items.map((i) => [i.symbol.toUpperCase(), i.name]));
  const cached = await loadCachedDashboardStockQuotes(symbols);
  const missing = symbols.filter((s) => !cached.has(s));
  let liveFilled = 0;
  let warning: string | undefined;

  if (missing.length > 0 && options?.fillMissingLive !== false) {
    const fillItems = missing.map((symbol) => ({
      symbol,
      name: nameBySymbol.get(symbol) || symbol,
    }));
    const live = await fetchFinnhubQuotesForDashboard(fillItems);
    if (live.quotes.size > 0) {
      await upsertDashboardStockQuotes(live.quotes);
      for (const [symbol, quote] of live.quotes) {
        cached.set(symbol, { ...quote, dataSource: 'CACHE', fetchedAt: new Date().toISOString() });
      }
      liveFilled = live.quotes.size;
    }
    warning = live.warning;
  }

  return {
    quotes: cached,
    fromCache: cached.size - liveFilled,
    liveFilled,
    warning,
  };
}
