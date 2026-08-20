import { NextRequest, NextResponse } from 'next/server';
import {
  ETORO_HOLDINGS_DASHBOARD_MAX_AGE_MS,
  loadEtoroHoldingSymbols,
} from '../../../../utils/etoroLiveHoldings';

/**
 * GET /api/etoro/portfolio/symbols
 * Lightweight eToro holding symbol list for the dashboard.
 * Uses a DB cache (default 24h) so the homepage does not wait on eToro + quote enrichment.
 */
export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get('refresh') === '1';
    const maxAgeHoursRaw = request.nextUrl.searchParams.get('maxAgeHours');
    const maxAgeHours = maxAgeHoursRaw != null ? Number(maxAgeHoursRaw) : null;
    const maxAgeMs =
      maxAgeHours != null && Number.isFinite(maxAgeHours) && maxAgeHours > 0
        ? maxAgeHours * 60 * 60 * 1000
        : ETORO_HOLDINGS_DASHBOARD_MAX_AGE_MS;

    const result = await loadEtoroHoldingSymbols({ force, maxAgeMs });

    return NextResponse.json({
      data: result.symbols.map((item) => ({
        symbol: item.symbol,
        name: item.name,
        instrument_id: item.instrumentId,
      })),
      fromCache: result.fromCache,
      fetchedAt: result.fetchedAt,
      cacheAgeMs: result.cacheAgeMs,
      maxAgeMs,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'etoro_holdings_cache table does not exist',
          hint: 'Run: node scripts/apply-etoro-holdings-cache.mjs',
        },
        { status: 503 }
      );
    }
    const message = err.message || 'Failed to load eToro holding symbols';
    const status = message.includes('rate limit') ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
