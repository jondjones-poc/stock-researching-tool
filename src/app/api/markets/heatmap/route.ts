import { NextResponse } from 'next/server';
import { fetchMarketsWithStocks } from '../../../utils/marketsDb';
import { resolveStockQuotes } from '../../../utils/marketQuotes';

export async function GET() {
  try {
    const markets = await fetchMarketsWithStocks();
    const allSymbols = markets.flatMap((m) => m.stocks);
    const { quotes, warning, usedCache } = await resolveStockQuotes(allSymbols);

    const heatmap = markets.map((market) => {
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
        validPcts.length > 0
          ? validPcts.reduce((sum, p) => sum + p, 0) / validPcts.length
          : null;

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

    return NextResponse.json({
      markets: heatmap,
      fetchedAt: new Date().toISOString(),
      quoteCount: quotes.size,
      symbolsRequested: allSymbols.length,
      usedCache,
      quoteWarning: warning,
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('GET /api/markets/heatmap:', error);
    let hint = '';
    if (err.code === '42P01') {
      hint = 'Run scripts/migrations/011_markets_heatmap.sql (and 013_market_stock_quotes.sql for quote cache)';
    } else if (err.message?.includes('FMP_API_KEY') || err.message?.includes('FINNHUB')) {
      hint = 'Set FMP_API_KEY or FINNHUB_API_KEY in .env.local';
    }
    return NextResponse.json(
      { error: 'Failed to load market heatmap', details: err.message, hint },
      { status: 500 }
    );
  }
}
