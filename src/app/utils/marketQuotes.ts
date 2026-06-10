import axios from 'axios';
import { query } from './db';

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
          /* try cache next */
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

export async function resolveStockQuotes(symbols: string[]): Promise<{
  quotes: Map<string, StockQuote>;
  warning?: string;
  usedCache: boolean;
}> {
  const { quotes: live, warning: liveWarning } = await fetchLiveStockQuotes(symbols);

  if (live.size > 0) {
    try {
      await upsertStockQuotes(live);
    } catch (error: unknown) {
      const err = error as { code?: string };
      if (err.code !== '42P01') throw error;
    }
  }

  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const missing = unique.filter((s) => !live.has(s));
  let usedCache = false;

  if (missing.length > 0) {
    const cached = await loadCachedStockQuotes(missing);
    for (const [symbol, quote] of cached) {
      live.set(symbol, quote);
      usedCache = true;
    }
  }

  const warnings = [liveWarning, usedCache ? 'Showing cached prices for symbols without live data' : '']
    .filter(Boolean)
    .join('. ');

  return {
    quotes: live,
    warning: warnings || undefined,
    usedCache,
  };
}
