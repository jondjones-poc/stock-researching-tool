import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';
import { enrichPortfolioStockMetrics } from '../../../utils/portfolioStockMetrics';
import { computePositionMetrics } from '../../../utils/portfolioHoldings';
import { getUsdToGbpRate } from '../../../utils/fxRates';
import { fetchTrading212OpenPositions } from '../../../utils/trading212';
import { loadResearchSymbolLinks } from '../../../utils/researchSymbolLinks';
import { symbolsMatch } from '../../../utils/symbolMatch';

const CONTRARIAN = {
  id: 0,
  slug: 'contrarian',
  name: 'The Contrarian Portfolio',
  is_default: false,
  sort_order: 20,
};

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('refresh') === '1';
    const [positions, valuationsResult, fx, symbolLinks] = await Promise.all([
      fetchTrading212OpenPositions({ force }),
      query(
        `SELECT id, stock, active_price, change_pct, bear_case_low_price
         FROM stock_valuations`
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> })),
      getUsdToGbpRate().catch(() => null),
      loadResearchSymbolLinks().catch(() => new Map()),
    ]);

    const symbols = positions.map((position) => position.symbol).filter(Boolean);
    const { dayChangeBySymbol, monthChangeBySymbol, livePriceBySymbol } =
      await enrichPortfolioStockMetrics(symbols);

    const data = positions.map((position, index) => {
      const symbol = position.symbol.toUpperCase();
      const valuation = valuationsResult.rows.find((row) =>
        symbolsMatch(String(row.stock), symbol, symbolLinks)
      );
      const storedPrice =
        valuation?.active_price != null ? parseFloat(String(valuation.active_price)) : null;
      const livePrice = livePriceBySymbol.get(symbol) ?? null;
      const activePrice =
        position.currentPrice ??
        (storedPrice != null && Number.isFinite(storedPrice) && storedPrice > 0 ? storedPrice : livePrice);
      const storedChangePct =
        valuation?.change_pct != null ? parseFloat(String(valuation.change_pct)) : null;
      const metrics = computePositionMetrics(
        { shares: position.quantity, avgBuyCost: position.averagePricePaid },
        activePrice
      );

      return {
        id: index + 1,
        portfolio_id: CONTRARIAN.id,
        stock_id: valuation ? Number(valuation.id) : 0,
        stock_symbol: valuation ? String(valuation.stock) : position.symbol,
        active_price: activePrice,
        bear_case_low_price:
          valuation?.bear_case_low_price != null
            ? parseFloat(String(valuation.bear_case_low_price))
            : null,
        day_change_pct:
          dayChangeBySymbol.get(symbol) ??
          (storedChangePct != null && Number.isFinite(storedChangePct) ? storedChangePct : null),
        month_change_pct: monthChangeBySymbol.get(symbol) ?? null,
        shares: metrics.shares,
        avg_buy_cost: metrics.avg_buy_cost,
        position_value: metrics.position_value,
        gain_loss_pct: metrics.gain_loss_pct,
        created_at: null,
        updated_at: null,
      };
    });

    return NextResponse.json({
      portfolio: CONTRARIAN,
      source: 'trading212',
      currency: fx ? 'GBP' : 'USD',
      fx: fx
        ? {
            usd_to_gbp: fx.rate,
            rate_date: fx.rateDate,
            fetched_at: fx.fetchedAt,
            from_cache: fx.fromCache,
            stale: fx.stale,
            source: fx.source,
            note: 'USD prices converted to GBP using ECB reference rates (Frankfurter). Cached up to 24h.',
          }
        : null,
      data,
    });
  } catch (error: unknown) {
    const err = error as { message?: string };
    const message = err.message || 'Failed to load Trading 212 portfolio';
    const status = message.includes('rate limit') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
