import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    console.log(`Fetching key metrics for ${symbol}`);
    
    // Fetch key metrics data from FMP
    const response = await axios.get(
      `https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?limit=10&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    if (response.data && response.data.length > 0) {
      const latestMetrics = response.data[0];
      
      // Extract shares outstanding (number of shares)
      const sharesOutstanding = latestMetrics.numberOfShares;
      
      console.log(`Shares outstanding for ${symbol}:`, sharesOutstanding);
      
      return NextResponse.json({
        sharesOutstanding: sharesOutstanding || null,
        symbol: symbol.toUpperCase(),
        date: latestMetrics.date,
        marketCap: latestMetrics.marketCap,
        enterpriseValue: latestMetrics.enterpriseValue
      });
    } else {
      console.log(`No key metrics data found for ${symbol}`);
      return NextResponse.json({
        sharesOutstanding: null,
        symbol: symbol.toUpperCase(),
        error: 'No key metrics data available'
      });
    }
  } catch (error) {
    console.error('Error fetching key metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch key metrics data' },
      { status: 500 }
    );
  }
}
