import axios from 'axios';
import { query } from './db';
import {
  computeCacheStatus,
  symbolsNeedingRefresh,
  type CacheStatus,
} from './marketCachePolicy';

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  dataSource: 'FMP' | 'FINNHUB' | 'CACHE';
  fetchedAt?: string;
}

function isFmpErrorPayload(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'Error Message' in data;
}

export async function fetchLiveStockQuotes(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  warning?: string;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const quotes = new Map<string, StockQuote>();
  if (unique.length === 0) return { quotes };

  const fmpKey = process.env.FMP_API_KEY?.trim();
  const finnhubKey = process.env.FINNHUB_API_KEY?.trim();
  const warnings: string[] = [];

  if (fmpKey) {
    try {
      const response = await axios.get(
        `https://financialmodelingprep.com/stable/quote?symbol=${unique.join(',')}&apikey=${fmpKey}`,
        { timeout: 15000 }
      );
      if (isFmpErrorPayload(response.data)) {
        warnings.push('FMP daily limit reached');
      } else if (Array.isArray(response.data)) {
        for (const quote of response.data) {
          if (!quote?.symbol) continue;
          const symbol = String(quote.symbol).toUpperCase();
          quotes.set(symbol, {
            symbol,
            name: quote.name || symbol,
            price: Number(quote.price) || 0,
            change: Number(quote.change) || 0,
            changePercent: Number(quote.changesPercentage) || 0,
            dataSource: 'FMP',
          });
        }
      } else {
        warnings.push('FMP returned an unexpected response');
      }
    } catch {
      warnings.push('FMP quote request failed');
    }
  } else {
    warnings.push('FMP_API_KEY not set');
  }

  const missing = unique.filter((s) => !quotes.has(s));
  if (missing.length > 0 && finnhubKey) {
    await Promise.all(
      missing.map(async (symbol) => {
        try {
          const response = await axios.get(
            `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubKey}`,
            { timeout: 8000 }
          );
          const q = response.data;
          if (q && typeof q.c === 'number' && Number.isFinite(q.c)) {
            quotes.set(symbol, {
              symbol,
              name: symbol,
              price: q.c,
              change: Number(q.d) || 0,
              changePercent: Number(q.dp) || 0,
              dataSource: 'FINNHUB',
            });
          }
        } catch {
          /* keep missing */
        }
      })
    );
    if (missing.some((s) => quotes.has(s))) {
      warnings.push('Using Finnhub for live prices');
    }
  } else if (missing.length > 0 && !finnhubKey) {
    warnings.push('FINNHUB_API_KEY not set');
  }

  if (quotes.size === 0 && !fmpKey && !finnhubKey) {
    throw new Error('FMP_API_KEY or FINNHUB_API_KEY must be configured');
  }

  return {
    quotes,
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
  };
}

export async function upsertStockQuotes(quotes: Map<string, StockQuote>): Promise<void> {
  for (const q of quotes.values()) {
    if (q.dataSource === 'CACHE') continue;
    await query(
      `INSERT INTO market_stock_quotes (symbol, name, price, change_abs, change_pct, data_source, fetched_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (symbol) DO UPDATE SET
         name = EXCLUDED.name,
         price = EXCLUDED.price,
         change_abs = EXCLUDED.change_abs,
         change_pct = EXCLUDED.change_pct,
         data_source = EXCLUDED.data_source,
         fetched_at = NOW()`,
      [q.symbol, q.name, q.price, q.change, q.changePercent, q.dataSource]
    );
  }

  const { upsertTodayPeriodCacheFromQuote } = await import('./marketPeriodCache');
  for (const q of quotes.values()) {
    if (q.dataSource !== 'CACHE') {
      await upsertTodayPeriodCacheFromQuote({
        ...q,
        fetchedAt: new Date().toISOString(),
      });
    }
  }
}

export async function loadCachedStockQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return result;

  try {
    const rows = await query(
      `SELECT symbol, name, price, change_abs, change_pct, data_source, fetched_at
       FROM market_stock_quotes
       WHERE symbol = ANY($1::text[])`,
      [unique]
    );
    for (const row of rows.rows) {
      result.set(row.symbol, {
        symbol: row.symbol,
        name: row.name || row.symbol,
        price: Number(row.price),
        change: Number(row.change_abs),
        changePercent: Number(row.change_pct),
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

export async function loadQuoteCacheMeta(symbols: string[]): Promise<Map<string, Date>> {
  const meta = new Map<string, Date>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return meta;

  try {
    const rows = await query(
      `SELECT symbol, fetched_at FROM market_stock_quotes WHERE symbol = ANY($1::text[])`,
      [unique]
    );
    for (const row of rows.rows) {
      meta.set(String(row.symbol).toUpperCase(), new Date(row.fetched_at));
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  return meta;
}

function mergeQuotes(
  symbols: string[],
  quotes: Map<string, StockQuote>
): Map<string, StockQuote> {
  const merged = new Map<string, StockQuote>();
  for (const symbol of symbols) {
    const upper = symbol.toUpperCase();
    const quote = quotes.get(upper);
    if (quote) merged.set(upper, quote);
  }
  return merged;
}

/** Read today quotes from cache only (no live API calls). */
export async function resolveStockQuotesFromCache(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  cacheStatus: CacheStatus;
  usedCache: boolean;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const cached = await loadCachedStockQuotes(unique);
  const meta = await loadQuoteCacheMeta(unique);

  return {
    quotes: mergeQuotes(unique, cached),
    cacheStatus: computeCacheStatus(unique, meta),
    usedCache: cached.size > 0,
  };
}

/** Refresh symbols whose cache is older than 24h (or missing), then return merged quotes. */
export async function refreshStaleStockQuotes(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  cacheStatus: CacheStatus;
  refreshedCount: number;
  warning?: string;
  usedCache: boolean;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const cached = await loadCachedStockQuotes(unique);
  const meta = await loadQuoteCacheMeta(unique);
  const toRefresh = symbolsNeedingRefresh(unique, meta);

  const warnings: string[] = [];
  let refreshedCount = 0;

  if (toRefresh.length > 0) {
    const { quotes: live, warning: liveWarning } = await fetchLiveStockQuotes(toRefresh);
    if (liveWarning) warnings.push(liveWarning);

    if (live.size > 0) {
      try {
        await upsertStockQuotes(live);
        refreshedCount = live.size;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code !== '42P01') throw error;
      }
      for (const [symbol, quote] of live) {
        cached.set(symbol, {
          ...quote,
          dataSource: quote.dataSource === 'CACHE' ? 'CACHE' : quote.dataSource,
          fetchedAt: new Date().toISOString(),
        });
      }
    }
  }

  const metaAfter = await loadQuoteCacheMeta(unique);
  const freshCached = await loadCachedStockQuotes(unique);
  for (const [symbol, quote] of freshCached) {
    if (!cached.has(symbol)) cached.set(symbol, quote);
  }

  return {
    quotes: mergeQuotes(unique, cached),
    cacheStatus: computeCacheStatus(unique, metaAfter),
    refreshedCount,
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
    usedCache: true,
  };
}

/** Force-fetch live quotes for all symbols and update today cache only. */
export async function forceLiveStockQuotes(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  warning?: string;
  refreshedCount: number;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const { quotes: live, warning } = await fetchLiveStockQuotes(unique);

  if (live.size > 0) {
    await upsertStockQuotes(live);
  }

  return {
    quotes: live,
    warning,
    refreshedCount: live.size,
  };
}

/** @deprecated use resolveStockQuotesFromCache or refreshStaleStockQuotes */
export async function resolveStockQuotes(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  warning?: string;
  usedCache: boolean;
}> {
  const { quotes, cacheStatus, warning, usedCache } = await refreshStaleStockQuotes(symbols);
  return {
    quotes,
    warning,
    usedCache: usedCache || cacheStatus.cacheStale,
  };
}
