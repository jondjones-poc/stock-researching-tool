import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAllWatchlistSymbols } from '../../config/dashboard';
import { query } from '../../utils/db';
import {
  getDashboardStockQuotesCacheUpdatedAt,
  isDashboardStockSymbol,
  resolveDashboardStockQuotes,
} from '../../utils/dashboardStockQuotes';

const FRED_API_KEY = process.env.FRED_API_KEY;

type SymbolMeta = {
  symbol: string;
  name: string;
  dataSource?: string | null;
  fredSeriesId?: string | null;
};

async function loadSymbolMeta(symbols: string[]): Promise<Map<string, SymbolMeta>> {
  const map = new Map<string, SymbolMeta>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];

  for (const cfg of getAllWatchlistSymbols()) {
    map.set(cfg.symbol.toUpperCase(), {
      symbol: cfg.symbol.toUpperCase(),
      name: cfg.name,
      dataSource: cfg.dataSource || null,
      fredSeriesId: cfg.fredSeriesId || null,
    });
  }

  try {
    const rows = await query(
      `SELECT symbol, name, data_source, fred_series_id
       FROM dashboard_watchlist
       WHERE UPPER(symbol) = ANY($1::text[])`,
      [unique]
    );
    for (const row of rows.rows) {
      const symbol = String(row.symbol).toUpperCase();
      const existing = map.get(symbol);
      map.set(symbol, {
        symbol,
        name: row.name || existing?.name || symbol,
        dataSource: row.data_source || existing?.dataSource || null,
        fredSeriesId: row.fred_series_id || existing?.fredSeriesId || null,
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  for (const symbol of unique) {
    if (!map.has(symbol)) {
      map.set(symbol, { symbol, name: symbol });
    }
  }

  return map;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');

    if (!symbols) {
      return NextResponse.json({ error: 'Symbols parameter is required' }, { status: 400 });
    }

    const symbolList = symbols.split(',').map((s) => s.trim()).filter(Boolean);
    const metaBySymbol = await loadSymbolMeta(symbolList);

    const stockItems: { symbol: string; name: string }[] = [];
    const fredSymbols: { symbol: string; seriesId: string }[] = [];

    for (const raw of symbolList) {
      const symbol = raw.toUpperCase();
      const meta = metaBySymbol.get(symbol) || { symbol, name: symbol };
      if (
        String(meta.dataSource || '').toUpperCase() === 'FRED' &&
        meta.fredSeriesId
      ) {
        fredSymbols.push({ symbol, seriesId: meta.fredSeriesId });
        continue;
      }
      if (
        isDashboardStockSymbol({
          symbol,
          dataSource: meta.dataSource,
          fredSeriesId: meta.fredSeriesId,
        })
      ) {
        stockItems.push({ symbol, name: meta.name });
      }
    }

    const watchlistData: Array<{
      symbol: string;
      name: string;
      last: number;
      change: number;
      changePercent: number;
      volume: number;
      marketCap: number;
      isPositive: boolean;
    }> = [];

    let stockWarning: string | undefined;
    let stockMeta: { fromCache: number; liveFilled: number } | undefined;

    if (stockItems.length > 0) {
      const resolved = await resolveDashboardStockQuotes(stockItems, {
        fillMissingLive: true,
      });
      stockWarning = resolved.warning;
      stockMeta = {
        fromCache: resolved.fromCache,
        liveFilled: resolved.liveFilled,
      };

      for (const item of stockItems) {
        const quote = resolved.quotes.get(item.symbol);
        if (!quote) continue;
        watchlistData.push({
          symbol: quote.symbol,
          name: quote.name || item.name,
          last: quote.price,
          change: quote.change,
          changePercent: quote.changePercent,
          volume: quote.volume || 0,
          marketCap: quote.marketCap || 0,
          isPositive: quote.change >= 0,
        });
      }
    }

    if (fredSymbols.length > 0 && FRED_API_KEY) {
      for (const fredSymbol of fredSymbols) {
        try {
          const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${fredSymbol.seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`;
          const fredResponse = await axios.get(fredUrl, { timeout: 10000 });

          if (fredResponse.data?.observations) {
            const observations = fredResponse.data.observations.filter(
              (obs: { value: string }) => obs.value !== '.'
            );

            if (observations.length >= 1) {
              const latest = observations[0];
              const previous = observations.length >= 2 ? observations[1] : latest;

              const latestValue = parseFloat(latest.value);
              const previousValue = parseFloat(previous.value);
              const change = latestValue - previousValue;
              const changePercent =
                previousValue !== 0 ? (change / previousValue) * 100 : 0;

              watchlistData.push({
                symbol: fredSymbol.symbol,
                name: metaBySymbol.get(fredSymbol.symbol)?.name || fredSymbol.symbol,
                last: latestValue,
                change,
                changePercent,
                volume: 0,
                marketCap: 0,
                isPositive: change >= 0,
              });
            }
          }
        } catch (fredError) {
          console.error(`Error fetching FRED data for ${fredSymbol.symbol}:`, fredError);
        }
      }
    }

    return NextResponse.json({
      data: watchlistData,
      timestamp: new Date().toISOString(),
      cacheUpdatedAt: await getDashboardStockQuotesCacheUpdatedAt(),
      source: {
        stocks: 'FINNHUB_CACHE',
        ...stockMeta,
        warning: stockWarning,
      },
    });
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number }; code?: string };
    console.error('Watchlist API error:', err.message);

    if (err.response?.status === 429) {
      return NextResponse.json({ error: 'API rate limit exceeded' }, { status: 429 });
    }

    if (err.code === 'ECONNABORTED') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 });
    }

    return NextResponse.json({ error: 'Failed to fetch watchlist data' }, { status: 500 });
  }
}
