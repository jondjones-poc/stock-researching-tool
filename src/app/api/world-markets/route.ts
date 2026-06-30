import { NextRequest, NextResponse } from 'next/server';
import {
  WORLD_MARKET_PERIOD_OPTIONS,
  type WorldMarketPeriod,
} from '../../config/worldMarkets';
import { fetchWorldMarkets } from '../../utils/worldMarketsData';

const VALID_PERIODS = new Set<string>(WORLD_MARKET_PERIOD_OPTIONS.map((o) => o.id));

function parsePeriod(value: string | null): WorldMarketPeriod {
  if (value && VALID_PERIODS.has(value)) {
    return value as WorldMarketPeriod;
  }
  return '1y';
}

export async function GET(request: NextRequest) {
  const period = parsePeriod(request.nextUrl.searchParams.get('period'));

  try {
    const data = await fetchWorldMarkets(period);
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('World markets API error:', message);
    return NextResponse.json(
      { error: 'Failed to fetch world market data', details: message },
      { status: 500 }
    );
  }
}
