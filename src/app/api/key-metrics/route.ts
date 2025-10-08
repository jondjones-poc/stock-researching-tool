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
    
    // Fetch key metrics and financial ratios data from FMP in parallel
    const [metricsResponse, ratiosResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/ratios/${symbol}?limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 })
    ]);

    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data && metricsResponse.value.data.length > 0) {
      const latestMetrics = metricsResponse.value.data[0];
      
      // Extract shares outstanding (number of shares)
      const sharesOutstanding = latestMetrics.numberOfShares;
      
      console.log(`Shares outstanding for ${symbol}:`, sharesOutstanding);
      console.log(`ROIC for ${symbol}:`, latestMetrics.roic);
      
      // Get annual payout ratio from financial ratios endpoint only (full-year data)
      let payoutRatio = null;
      if (ratiosResponse.status === 'fulfilled' && ratiosResponse.value.data && ratiosResponse.value.data.length > 0) {
        const latestRatios = ratiosResponse.value.data[0];
        payoutRatio = latestRatios.payoutRatio || latestRatios.dividendPayoutRatio;
        console.log(`Annual Payout Ratio from ratios endpoint for ${symbol}:`, payoutRatio);
      } else {
        console.log(`No annual payout ratio available for ${symbol}`);
      }
      
      return NextResponse.json({
        sharesOutstanding: sharesOutstanding || null,
        symbol: symbol.toUpperCase(),
        date: latestMetrics.date,
        marketCap: latestMetrics.marketCap,
        enterpriseValue: latestMetrics.enterpriseValue,
        roic: latestMetrics.roic || null,
        payoutRatio: payoutRatio || null
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
