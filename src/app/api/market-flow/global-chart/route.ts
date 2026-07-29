import { NextRequest, NextResponse } from 'next/server';
import {
  MARKET_FLOW_PERIODS,
  type MarketFlowCapType,
  type MarketFlowPeriod,
} from '@/app/config/marketFlow';
import {
  getLatestClose,
  getPricesForFund,
  listActiveMarketFlowFunds,
} from '@/app/utils/marketFlowDb';
import { normalizeSeriesTo100, periodStartFromAsOf } from '@/app/utils/marketFlowReturns';

/** GET /api/market-flow/global-chart?cap=large|small&period=1y — all ten funds, normalized to 100. */
export async function GET(request: NextRequest) {
  try {
    const capRaw = request.nextUrl.searchParams.get('cap') ?? 'large';
    const cap: MarketFlowCapType = capRaw === 'small' ? 'small' : 'large';
    const periodParam = request.nextUrl.searchParams.get('period') ?? '1y';
    const period: MarketFlowPeriod = (MARKET_FLOW_PERIODS as string[]).includes(periodParam)
      ? (periodParam as MarketFlowPeriod)
      : '1y';

    const funds = (await listActiveMarketFlowFunds()).filter((f) => f.cap_type === cap);
    const asOfCandidates: string[] = [];
    for (const f of funds) {
      const latest = await getLatestClose(f.id);
      if (latest) asOfCandidates.push(latest.date);
    }
    const asOf = asOfCandidates.sort().at(-1) ?? null;
    const fromDate = asOf ? periodStartFromAsOf(asOf, period) : undefined;

    const seriesMeta: Array<{ slug: string; name: string; symbol: string; key: string }> = [];
    const byDate = new Map<string, Record<string, number>>();

    for (const fund of funds) {
      const key = fund.market_slug ?? fund.symbol;
      seriesMeta.push({
        slug: fund.market_slug ?? fund.symbol,
        name: fund.market_name ?? fund.name,
        symbol: fund.symbol,
        key,
      });
      const prices = await getPricesForFund(fund.id, fromDate);
      const normalized = normalizeSeriesTo100(
        fromDate ? prices.filter((p) => p.date >= fromDate) : prices
      );
      for (const point of normalized) {
        const row = byDate.get(point.date) ?? {};
        row[key] = point.value;
        byDate.set(point.date, row);
      }
    }

    const chart = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, ...values }));

    return NextResponse.json({
      cap,
      period,
      asOf,
      series: seriesMeta,
      chart,
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
    console.error('market-flow global-chart error:', e);
    return NextResponse.json(
      { error: 'Failed to load global chart', details: err.message },
      { status: 500 }
    );
  }
}
