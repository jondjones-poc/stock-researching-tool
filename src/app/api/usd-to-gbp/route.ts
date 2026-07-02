import { NextResponse } from 'next/server';
import { getUsdToGbpRate } from '../../utils/fxRates';

/** GET - USD→GBP rate (DB-cached 24h, Frankfurter / ECB reference). */
export async function GET() {
  try {
    const fx = await getUsdToGbpRate();
    return NextResponse.json({
      rate: fx.rate,
      base: fx.base,
      symbol: fx.quote,
      date: fx.rateDate,
      fetchedAt: fx.fetchedAt,
      fromCache: fx.fromCache,
      stale: fx.stale,
      source: fx.source,
    });
  } catch (error: unknown) {
    console.error('USD to GBP fetch failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rate' },
      { status: 500 }
    );
  }
}
