import { NextRequest, NextResponse } from 'next/server';
import {
  MARKET_FLOW_PERIODS,
  type MarketFlowPeriod,
} from '@/app/config/marketFlow';
import {
  getMarketFlowMarketBySlug,
  getLatestClose,
  getPricesForFund,
  listFundsForMarket,
  listReturnsForFunds,
} from '@/app/utils/marketFlowDb';
import {
  buildNormalizedComparison,
  periodStartFromAsOf,
} from '@/app/utils/marketFlowReturns';

/** GET /api/market-flow/[slug] — detail for one market (from DB). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const periodParam = request.nextUrl.searchParams.get('period') ?? '1y';
    const period: MarketFlowPeriod = (MARKET_FLOW_PERIODS as string[]).includes(periodParam)
      ? (periodParam as MarketFlowPeriod)
      : '1y';

    const market = await getMarketFlowMarketBySlug(slug);
    if (!market) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const funds = await listFundsForMarket(market.id);
    const large = funds.find((f) => f.cap_type === 'large') ?? null;
    const small = funds.find((f) => f.cap_type === 'small') ?? null;
    const fundIds = funds.map((f) => f.id);
    const returns = await listReturnsForFunds(fundIds);

    const returnsByFund: Record<number, Record<string, number | null>> = {};
    for (const r of returns) {
      if (!returnsByFund[r.fund_id]) returnsByFund[r.fund_id] = {};
      returnsByFund[r.fund_id][r.period] = r.return_pct;
    }

    const latestLarge = large ? await getLatestClose(large.id) : null;
    const latestSmall = small ? await getLatestClose(small.id) : null;
    const asOf = [latestLarge?.date, latestSmall?.date].filter(Boolean).sort().at(-1) ?? null;
    const fromDate = asOf ? periodStartFromAsOf(asOf, period) : undefined;

    const largePrices = large ? await getPricesForFund(large.id, fromDate) : [];
    const smallPrices = small ? await getPricesForFund(small.id, fromDate) : [];
    const chart = buildNormalizedComparison(largePrices, smallPrices, fromDate);

    const historyDates = new Set([
      ...largePrices.map((p) => p.date),
      ...smallPrices.map((p) => p.date),
    ]);
    const largeMap = new Map(largePrices.map((p) => [p.date, p.close]));
    const smallMap = new Map(smallPrices.map((p) => [p.date, p.close]));
    const historyTable = [...historyDates]
      .sort()
      .reverse()
      .slice(0, 120)
      .map((date) => ({
        date,
        large: largeMap.get(date) ?? null,
        small: smallMap.get(date) ?? null,
      }));

    return NextResponse.json({
      disclaimer:
        'Compares price momentum of the selected large-cap and small-cap funds. Not confirmed cash flow.',
      market: {
        slug: market.slug,
        name: market.name,
        region: market.region,
      },
      period,
      large: large
        ? {
            symbol: large.symbol,
            name: large.name,
            description: large.description,
            price: latestLarge?.close ?? null,
            asOf: latestLarge?.date ?? null,
            returns: returnsByFund[large.id] ?? {},
          }
        : null,
      small: small
        ? {
            symbol: small.symbol,
            name: small.name,
            description: small.description,
            price: latestSmall?.close ?? null,
            asOf: latestSmall?.date ?? null,
            returns: returnsByFund[small.id] ?? {},
          }
        : null,
      chart,
      historyTable,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Market Flow tables missing',
          hint: 'Run scripts/migrations/026_market_flow_tracker.sql',
        },
        { status: 500 }
      );
    }
    console.error('market-flow detail error:', e);
    return NextResponse.json(
      { error: 'Failed to load market detail', details: err.message },
      { status: 500 }
    );
  }
}
