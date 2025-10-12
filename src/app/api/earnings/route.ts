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

    // Use earnings-surprises endpoint instead of earning_calendar (which requires premium subscription)
    const url = `https://financialmodelingprep.com/api/v3/earnings-surprises/${symbol}?apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`FMP API error for ${symbol}:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch earnings data' }, { status: response.status });
    }

    const rawData = await response.json();
    
    // Transform the data to match the expected format
    // earnings-surprises returns: { date, symbol, actualEarningResult, estimatedEarning }
    const data = rawData.map((item: any) => ({
      symbol: item.symbol,
      date: item.date,
      eps: item.actualEarningResult || item.estimatedEarning || 0,
      epsEstimate: item.estimatedEarning || 0,
      epsActual: item.actualEarningResult || null,
      revenue: null, // earnings-surprises doesn't include revenue
      link: `https://www.google.com/finance/quote/${symbol}:NYSE`
    }));
    
    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching earnings data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
