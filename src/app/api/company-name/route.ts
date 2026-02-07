import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    const profileResponse = await axios.get(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`,
      { timeout: 10000 }
    );

    if (profileResponse.data && profileResponse.data.name) {
      return NextResponse.json({
        name: profileResponse.data.name,
        symbol: symbol.toUpperCase()
      });
    }

    return NextResponse.json({
      name: null,
      symbol: symbol.toUpperCase()
    });
  } catch (error: any) {
    console.error('Error fetching company name:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company name', details: error.message },
      { status: 500 }
    );
  }
}
