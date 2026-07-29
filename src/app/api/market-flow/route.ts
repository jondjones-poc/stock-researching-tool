import { NextRequest, NextResponse } from 'next/server';
import {
  MARKET_FLOW_PERIODS,
  type MarketFlowPeriod,
} from '@/app/config/marketFlow';
import {
  buildMarketFlowDashboard,
  type MarketFlowView,
} from '@/app/utils/marketFlowDashboard';
import { seedMarketFlowUniverse } from '@/app/utils/marketFlowDb';

function parsePeriod(raw: string | null): MarketFlowPeriod {
  if (raw && (MARKET_FLOW_PERIODS as string[]).includes(raw)) {
    return raw as MarketFlowPeriod;
  }
  return '1m';
}

function parseView(raw: string | null): MarketFlowView {
  if (raw === 'large' || raw === 'small' || raw === 'vs') return raw;
  return 'vs';
}

/** GET — dashboard payload from DB only (no live market API). */
export async function GET(request: NextRequest) {
  try {
    const period = parsePeriod(request.nextUrl.searchParams.get('period'));
    const view = parseView(request.nextUrl.searchParams.get('view'));

    // Ensure seed rows exist so empty DB still shows market structure
    try {
      await seedMarketFlowUniverse();
    } catch {
      // migration may not be applied yet
    }

    const payload = await buildMarketFlowDashboard(period, view);
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Market Flow tables missing',
          hint: 'Run scripts/migrations/026_market_flow_tracker.sql or node scripts/apply-market-flow-tracker.mjs',
        },
        { status: 500 }
      );
    }
    console.error('market-flow GET error:', e);
    return NextResponse.json(
      { error: 'Failed to load market flow dashboard', details: err.message },
      { status: 500 }
    );
  }
}
