import { NextRequest, NextResponse } from 'next/server';
import {
  resolveStockResearch,
  STOCK_RESEARCH_MIGRATION_HINT,
} from '../../utils/stockResearchCache';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  const force = request.nextUrl.searchParams.get('force') === '1';

  if (!symbol?.trim()) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  try {
    const result = await resolveStockResearch(symbol.trim(), { forceRefresh: force });
    return NextResponse.json({
      ...result.payload,
      source: result.source,
      fetchedAt: result.fetchedAt,
      cached: result.cached,
      stale: result.stale,
      cacheTtlHours: 24,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load stock research';
    console.error('stock-research error:', message);
    return NextResponse.json(
      {
        error: message,
        hint: STOCK_RESEARCH_MIGRATION_HINT,
      },
      { status: 500 }
    );
  }
}
