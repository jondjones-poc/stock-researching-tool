import { NextResponse } from 'next/server';
import {
  fetchMarketsWithStocks,
  parseMarketHeatmapView,
  type MarketHeatmapView,
  type MarketRow,
} from '../../../utils/marketsDb';
import { applyRegionIndexSymbols } from '../../../utils/marketRegionEtfs';
import {
  forceLiveHeatmapQuotes,
  resolveHeatmapQuotesFromCache,
} from '../../../utils/marketPeriodCache';
import { parseMarketPeriod } from '../../../utils/marketPeriods';
import { getSectorRegion, parseSectorRegion } from '../../../config/sectorRegions';

type QuoteMap = Map<
  string,
  {
    name?: string;
    price: number | null;
    change: number | null;
    changePercent: number | null;
    dataSource?: string | null;
  }
>;

function symbolsForView(markets: MarketRow[], view: MarketHeatmapView): string[] {
  if (view === 'index') {
    return markets
      .map((m) => m.index_symbol)
      .filter((s): s is string => Boolean(s));
  }
  return markets.flatMap((m) => m.stocks);
}

function buildHeatmap(markets: MarketRow[], quotes: QuoteMap, view: MarketHeatmapView) {
  return markets.map((market) => {
    const symbols =
      view === 'index'
        ? market.index_symbol
          ? [market.index_symbol]
          : []
        : market.stocks;

    const stockDetails = symbols.map((symbol) => {
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
      index_symbol: market.index_symbol,
      index_is_proxy: Boolean(market.index_is_proxy),
      market_group: market.market_group,
      view,
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
    const view = parseMarketHeatmapView(searchParams.get('view'));
    const region = parseSectorRegion(searchParams.get('region'));
    const live = searchParams.get('live') === 'true';
    // Always sector cards; region swaps the ETF lens.
    const marketsBase = await fetchMarketsWithStocks('sector');
    const markets = await applyRegionIndexSymbols(marketsBase, region);
    const allSymbols = symbolsForView(markets, view);

    const quotes: QuoteMap = new Map();

    const result = live
      ? await forceLiveHeatmapQuotes(allSymbols, period)
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

    const heatmap = buildHeatmap(markets, quotes, view);
    const regionMeta = getSectorRegion(region);

    return NextResponse.json(
      {
        markets: heatmap,
        view,
        group: 'sector',
        region,
        regionLabel: regionMeta.region,
        period,
        fetchedAt: result.cacheStatus.oldestFetchedAt ?? new Date().toISOString(),
        quoteCount: quotes.size,
        symbolsRequested: allSymbols.length,
        usedCache: !live,
        live,
        cacheStale: result.cacheStatus.cacheStale,
        cacheOldestAt: result.cacheStatus.oldestFetchedAt,
        liveAvailable: result.cacheStatus.liveAvailable,
        refreshedCount: 'refreshedCount' in result ? result.refreshedCount : 0,
        quoteWarning: result.warning,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('GET /api/markets/heatmap:', error);
    let hint = '';
    if (err.code === '42P01' || err.message?.includes('index_symbol')) {
      hint =
        'Run scripts/migrations/036_markets_index_symbol.sql (node scripts/apply-markets-index-symbol.mjs)';
    } else if (err.message?.includes('market_region_etfs')) {
      hint = 'Run node scripts/apply-market-region-etfs.mjs';
    } else if (err.message?.includes('market_group')) {
      hint =
        'Run scripts/migrations/038_markets_country_indexes.sql (node scripts/apply-markets-country-indexes.mjs)';
    } else if (err.message?.includes('FMP_API_KEY') || err.message?.includes('FINNHUB')) {
      hint = 'Set FMP_API_KEY or FINNHUB_API_KEY in .env.local';
    }
    return NextResponse.json(
      { error: 'Failed to load market heatmap', details: err.message, hint },
      { status: 500 }
    );
  }
}
