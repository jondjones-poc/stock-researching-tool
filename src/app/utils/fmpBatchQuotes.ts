import axios from 'axios';
import type { StockQuote } from './marketQuotes';
import { fetchLiveStockQuotes } from './marketQuotes';

export interface FmpQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

const FMP_API_KEY = process.env.FMP_API_KEY?.trim();

/** One FMP batch request for all symbols — falls back to Finnhub via marketQuotes. */
export async function fetchFmpBatchQuotes(symbols: string[]): Promise<Map<string, FmpQuote>> {
  const { quotes } = await fetchLiveStockQuotes(symbols);
  const result = new Map<string, FmpQuote>();
  for (const [symbol, q] of quotes) {
    result.set(symbol, toFmpQuote(q));
  }
  return result;
}

function toFmpQuote(q: StockQuote): FmpQuote {
  return {
    symbol: q.symbol,
    name: q.name,
    price: q.price,
    change: q.change,
    changePercent: q.changePercent,
  };
}

/** @deprecated use fetchLiveStockQuotes — kept for direct FMP-only callers */
export async function fetchFmpOnlyBatchQuotes(symbols: string[]): Promise<Map<string, FmpQuote>> {
  const result = new Map<string, FmpQuote>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return result;

  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY is not configured');
  }

  const response = await axios.get(
    `https://financialmodelingprep.com/stable/quote?symbol=${unique.join(',')}&apikey=${FMP_API_KEY}`,
    { timeout: 15000 }
  );

  if (typeof response.data === 'object' && response.data !== null && 'Error Message' in response.data) {
    throw new Error(String((response.data as { 'Error Message': string })['Error Message']));
  }

  if (Array.isArray(response.data)) {
    for (const quote of response.data) {
      if (!quote?.symbol) continue;
      result.set(String(quote.symbol).toUpperCase(), {
        symbol: String(quote.symbol).toUpperCase(),
        name: quote.name || quote.symbol,
        price: Number(quote.price) || 0,
        change: Number(quote.change) || 0,
        changePercent: Number(quote.changesPercentage) || 0,
      });
    }
  }

  return result;
}
