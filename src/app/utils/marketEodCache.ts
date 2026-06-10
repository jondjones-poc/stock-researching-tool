import axios from 'axios';
import { query } from './db';
import {
  eodFetchFromDate,
  eodFetchToDate,
  periodStartDate,
  type MarketHeatmapPeriod,
} from './marketPeriods';

const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface EodBar {
  date: string;
  close: number;
}

export interface PeriodStockQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dataSource: 'EOD_CACHE' | 'EOD_FMP' | null;
}

function isFmpErrorPayload(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'Error Message' in data;
}

function parseFmpEodRows(data: unknown): EodBar[] {
  const raw: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' &&
        data !== null &&
        'historical' in data &&
        Array.isArray((data as { historical: unknown[] }).historical)
      ? (data as { historical: unknown[] }).historical
      : [];

  const bars: EodBar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { date?: string; close?: number };
    if (!row.date || row.close === undefined || row.close === null) continue;
    const close = Number(row.close);
    if (!Number.isFinite(close)) continue;
    bars.push({ date: row.date, close });
  }

  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

async function fetchFmpEod(symbol: string, from: string, to: string): Promise<EodBar[]> {
  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (!fmpKey) {
    throw new Error('FMP_API_KEY is not configured');
  }

  const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&apikey=${fmpKey}`;
  const response = await axios.get(url, { timeout: 20000, validateStatus: () => true });

  if (response.status !== 200 || isFmpErrorPayload(response.data)) {
    const msg =
      typeof response.data === 'object' &&
      response.data !== null &&
      'Error Message' in response.data
        ? String((response.data as { 'Error Message': string })['Error Message'])
        : `FMP EOD failed (${response.status})`;
    throw new Error(msg);
  }

  return parseFmpEodRows(response.data);
}

async function loadCachedBars(symbols: string[]): Promise<Map<string, EodBar[]>> {
  const result = new Map<string, EodBar[]>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return result;

  try {
    const rows = await query(
      `SELECT symbol, trade_date::text AS trade_date, close
       FROM market_stock_eod
       WHERE symbol = ANY($1::text[])
       ORDER BY symbol, trade_date`,
      [unique]
    );
    for (const row of rows.rows) {
      const symbol = String(row.symbol).toUpperCase();
      if (!result.has(symbol)) result.set(symbol, []);
      result.get(symbol)!.push({
        date: String(row.trade_date).slice(0, 10),
        close: Number(row.close),
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  return result;
}

async function loadStaleSymbols(symbols: string[]): Promise<string[]> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return [];

  try {
    const rows = await query(
      `SELECT symbol, fetched_at
       FROM market_stock_eod_meta
       WHERE symbol = ANY($1::text[])`,
      [unique]
    );
    const meta = new Map<string, Date>();
    for (const row of rows.rows) {
      meta.set(String(row.symbol).toUpperCase(), new Date(row.fetched_at));
    }

    const cutoff = Date.now() - CACHE_MAX_AGE_MS;
    return unique.filter((s) => {
      const fetched = meta.get(s);
      return !fetched || fetched.getTime() < cutoff;
    });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === '42P01') return unique;
    throw error;
  }
}

async function upsertEodBars(symbol: string, bars: EodBar[]): Promise<void> {
  if (bars.length === 0) return;

  for (const bar of bars) {
    await query(
      `INSERT INTO market_stock_eod (symbol, trade_date, close)
       VALUES ($1, $2, $3)
       ON CONFLICT (symbol, trade_date) DO UPDATE SET close = EXCLUDED.close`,
      [symbol, bar.date, bar.close]
    );
  }

  await query(
    `INSERT INTO market_stock_eod_meta (symbol, fetched_at)
     VALUES ($1, NOW())
     ON CONFLICT (symbol) DO UPDATE SET fetched_at = NOW()`,
    [symbol]
  );
}

function closeOnOrBefore(bars: EodBar[], targetDate: string): number | null {
  let best: number | null = null;
  for (const bar of bars) {
    if (bar.date <= targetDate) best = bar.close;
    else break;
  }
  return best;
}

export function computePeriodReturnPct(bars: EodBar[], period: MarketHeatmapPeriod): number | null {
  if (period === 'today' || bars.length === 0) return null;

  const startDate = periodStartDate(period);
  if (!startDate) return null;

  const latest = bars[bars.length - 1];
  const startClose = closeOnOrBefore(bars, startDate);
  if (startClose === null || startClose === 0) return null;

  return ((latest.close - startClose) / startClose) * 100;
}

export async function ensureEodCache(
  symbols: string[],
  force = false
): Promise<{ refreshed: number; warning?: string }> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return { refreshed: 0 };

  const toRefresh = force ? unique : await loadStaleSymbols(unique);
  if (toRefresh.length === 0) return { refreshed: 0 };

  const from = eodFetchFromDate();
  const to = eodFetchToDate();
  const warnings: string[] = [];
  let refreshed = 0;

  for (const symbol of toRefresh) {
    try {
      const bars = await fetchFmpEod(symbol, from, to);
      if (bars.length === 0) {
        warnings.push(`${symbol}: no EOD data`);
        continue;
      }
      await upsertEodBars(symbol, bars);
      refreshed += 1;
    } catch (e) {
      warnings.push(`${symbol}: ${e instanceof Error ? e.message : 'EOD fetch failed'}`);
    }
  }

  return {
    refreshed,
    warning: warnings.length > 0 ? warnings.slice(0, 3).join('; ') : undefined,
  };
}

export async function resolvePeriodStockQuotes(
  symbols: string[],
  period: MarketHeatmapPeriod,
  force = false
): Promise<{ quotes: Map<string, PeriodStockQuote>; warning?: string }> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const quotes = new Map<string, PeriodStockQuote>();

  if (unique.length === 0) return { quotes };

  const { warning: refreshWarning } = await ensureEodCache(unique, force);
  const cached = await loadCachedBars(unique);
  const warnings = [refreshWarning].filter(Boolean);

  for (const symbol of unique) {
    const bars = cached.get(symbol) ?? [];
    const changePercent = computePeriodReturnPct(bars, period);
    const latest = bars.length > 0 ? bars[bars.length - 1] : null;
    const startDate = periodStartDate(period);
    const startClose = startDate ? closeOnOrBefore(bars, startDate) : null;

    quotes.set(symbol, {
      symbol,
      name: symbol,
      price: latest?.close ?? null,
      change:
        latest && startClose !== null ? latest.close - startClose : null,
      changePercent,
      dataSource: bars.length > 0 ? 'EOD_CACHE' : null,
    });
  }

  const missing = unique.filter((s) => !cached.has(s) || cached.get(s)!.length === 0);
  if (missing.length > 0) {
    warnings.push(`No cached history for ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`);
  }

  return {
    quotes,
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
  };
}
