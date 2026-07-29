import axios from 'axios';
import { isMarketFlowMockMode } from '../config/marketFlow';
import type { MarketFlowPriceBar } from './marketFlowDb';

function isFmpErrorPayload(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'Error Message' in data;
}

function parseFmpEodRows(data: unknown): MarketFlowPriceBar[] {
  const raw: unknown[] = Array.isArray(data)
    ? data
    : typeof data === 'object' &&
        data !== null &&
        'historical' in data &&
        Array.isArray((data as { historical: unknown[] }).historical)
      ? (data as { historical: unknown[] }).historical
      : [];

  const bars: MarketFlowPriceBar[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as { date?: string; close?: number };
    if (!row.date || row.close === undefined || row.close === null) continue;
    const close = Number(row.close);
    if (!Number.isFinite(close)) continue;
    bars.push({ date: row.date.slice(0, 10), close });
  }
  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

/** Deterministic mock EOD series so the app runs without an API key. */
export function generateMockEod(
  symbol: string,
  from: string,
  to: string
): MarketFlowPriceBar[] {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  const base = 40 + (hash % 160);
  const drift = ((hash % 17) - 8) / 1000;

  const bars: MarketFlowPriceBar[] = [];
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  let price = base;
  let i = 0;

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const wave = Math.sin((i + hash % 10) / 9) * 0.012;
    const noise = ((hash + i * 17) % 100) / 10000 - 0.005;
    price = Math.max(5, price * (1 + drift + wave + noise));
    bars.push({ date: d.toISOString().slice(0, 10), close: Math.round(price * 100) / 100 });
    i += 1;
  }
  return bars;
}

export async function fetchMarketFlowEod(
  symbol: string,
  from: string,
  to: string
): Promise<{ bars: MarketFlowPriceBar[]; source: 'mock' | 'fmp' }> {
  if (isMarketFlowMockMode() || !process.env.FMP_API_KEY?.trim()) {
    return { bars: generateMockEod(symbol, from, to), source: 'mock' };
  }

  const fmpKey = process.env.FMP_API_KEY.trim();
  const url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&apikey=${fmpKey}`;
  const response = await axios.get(url, { timeout: 25000, validateStatus: () => true });

  if (response.status !== 200 || isFmpErrorPayload(response.data)) {
    const msg =
      typeof response.data === 'object' &&
      response.data !== null &&
      'Error Message' in response.data
        ? String((response.data as { 'Error Message': string })['Error Message'])
        : `FMP EOD failed (${response.status})`;
    throw new Error(msg);
  }

  return { bars: parseFmpEodRows(response.data), source: 'fmp' };
}

export function defaultHistoryFromDate(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 2);
  return d.toISOString().slice(0, 10);
}

export function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}
