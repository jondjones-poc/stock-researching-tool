import { NextResponse } from 'next/server';
import { fetchMarketsWithStocks } from '../../../utils/marketsDb';
import {
  refreshStaleHeatmapQuotes,
  resolveHeatmapQuotesFromCache,
} from '../../../utils/marketPeriodCache';
import { parseMarketPeriod } from '../../../utils/marketPeriods';

function buildHeatmap(
  markets: Awaited<ReturnType<typeof fetchMarketsWithStocks>>,
  quotes: Map<
    string,
    {
      name?: string;
      price: number | null;
      change: number | null;
      changePercent: number | null;
      dataSource?: string | null;
    }
  >
) {
  return markets.map((market) => {
    const stockDetails = market.stocks.map((symbol) => {
      const quote = quotes.get(symbol.toUpperCase());
      return {
        symbol,
        name: quote?.name ?? symbol,
        price: quote?.price ?? null,
        change: quote?.change ?? null,
        changePercent: quote?.changePercent ?? null,
        dataSource: quote?.dataSource ?? null,
      };
    });

    const validPcts = stockDetails
      .map((s) => s.changePercent)
      .filter((p): p is number => p !== null && Number.isFinite(p));

    const meanChangePct =
      validPcts.length > 0 ? validPcts.reduce((sum, p) => sum + p, 0) / validPcts.length : null;

    const cumulativeChange =
      validPcts.length > 0 ? validPcts.reduce((sum, p) => sum + p, 0) : null;

    return {
      id: market.id,
      name: market.name,
      display_order: market.display_order,
      stocks: stockDetails,
      meanChangePct,
      cumulativeChangePct: cumulativeChange,
      direction:
        meanChangePct === null
          ? 'unknown'
          : meanChangePct > 0
            ? 'up'
            : meanChangePct < 0
              ? 'down'
              : 'flat',
    };
  });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = parseMarketPeriod(searchParams.get('period'));
    const refresh = searchParams.get('refresh') === 'true';

    const markets = await fetchMarketsWithStocks();
    const allSymbols = markets.flatMap((m) => m.stocks);

    const quotes = new Map<
      string,
      {
        name: string;
        price: number | null;
        change: number | null;
        changePercent: number | null;
        dataSource: string | null;
      }
    >();

    const result = refresh
      ? await refreshStaleHeatmapQuotes(allSymbols, period)
      : await resolveHeatmapQuotesFromCache(allSymbols, period);

    for (const [symbol, q] of result.quotes) {
      quotes.set(symbol, {
        name: q.name,
        price: q.price,
        change: q.change,
        changePercent: q.changePercent,
        dataSource: q.dataSource,
      });
    }

    const heatmap = buildHeatmap(markets, quotes);

    return NextResponse.json({
      markets: heatmap,
      period,
      fetchedAt: result.cacheStatus.oldestFetchedAt ?? new Date().toISOString(),
      quoteCount: quotes.size,
      symbolsRequested: allSymbols.length,
      usedCache: true,
      cacheStale: result.cacheStatus.cacheStale,
      cacheOldestAt: result.cacheStatus.oldestFetchedAt,
      refreshedCount: 'refreshedCount' in result ? result.refreshedCount : 0,
      quoteWarning: result.warning,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('GET /api/markets/heatmap:', error);
    let hint = '';
    if (err.code === '42P01') {
      hint =
        'Run scripts/migrations/011_markets_heatmap.sql through 015_market_stock_period_cache.sql';
    } else if (err.message?.includes('FMP_API_KEY') || err.message?.includes('FINNHUB')) {
      hint = 'Set FMP_API_KEY or FINNHUB_API_KEY in .env.local';
    }
    return NextResponse.json(
      { error: 'Failed to load market heatmap', details: err.message, hint },
      { status: 500 }
    );
  }
}
