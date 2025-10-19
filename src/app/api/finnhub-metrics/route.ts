import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    const url = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Finnhub API error for ${symbol}:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch metrics data' }, { status: response.status });
    }

    const data = await response.json();

    // Check for API errors
    if (data.error) {
      console.error(`Finnhub API error:`, data);
      return NextResponse.json({ error: data.error }, { status: 400 });
    }

    console.log(`Finnhub metrics data for ${symbol}:`, data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Finnhub metrics data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
