import { NextRequest, NextResponse } from 'next/server';
import { fetchFundamentalsRanges } from '../../utils/fundamentalsRanges';

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  try {
    const ranges = await fetchFundamentalsRanges(symbol);
    return NextResponse.json(ranges);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('GET /api/fundamentals-ranges:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fundamentals ranges', details: message },
      { status: 500 }
    );
  }
}
