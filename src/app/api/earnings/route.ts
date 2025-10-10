import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.FMP_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const url = `https://financialmodelingprep.com/api/v3/earning_calendar/${symbol}?apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`FMP API error for ${symbol}:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch earnings data' }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching earnings data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
