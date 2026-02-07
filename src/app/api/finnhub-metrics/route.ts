import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

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
    // Fetch metrics and quote in parallel to get market cap and price for shares outstanding calculation
    const [metricsResponse, quoteResponse] = await Promise.allSettled([
      axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      metric: null,
      sharesOutstanding: null,
      totalDebt: null,
      cashAndCashEquivalents: null
    };

    // Process metrics data
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      const data = metricsResponse.value.data;

      // Check for API errors
      if (data.error) {
        console.error(`Finnhub API error:`, data);
        return NextResponse.json({ error: data.error }, { status: 400 });
      }

      result.metric = data.metric || data;
      console.log(`Finnhub metrics data for ${symbol}:`, data);

      // Extract total debt and cash if available in metrics
      if (result.metric?.totalDebt !== null && result.metric?.totalDebt !== undefined) {
        result.totalDebt = result.metric.totalDebt * 1000000; // Convert from millions to actual value
        console.log(`Total Debt from Finnhub Metrics: ${result.totalDebt}`);
      }
      
      if (result.metric?.cashAndCashEquivalents !== null && result.metric?.cashAndCashEquivalents !== undefined) {
        result.cashAndCashEquivalents = result.metric.cashAndCashEquivalents * 1000000; // Convert from millions to actual value
        console.log(`Cash from Finnhub Metrics: ${result.cashAndCashEquivalents}`);
      }

      // Calculate shares outstanding from market cap and price if available
      if (result.metric?.marketCapitalization && quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
        const marketCap = result.metric.marketCapitalization * 1000000; // Convert from millions to actual value
        const price = quoteResponse.value.data.c; // Current price
        
        if (marketCap && price && marketCap > 0 && price > 0) {
          result.sharesOutstanding = Math.round(marketCap / price);
          console.log(`Calculated shares outstanding for ${symbol}: ${result.sharesOutstanding} (Market Cap: ${marketCap}, Price: ${price})`);
        }
      }
    } else if (metricsResponse.status === 'rejected') {
      console.error(`Finnhub metrics API error for ${symbol}:`, metricsResponse.reason);
      return NextResponse.json({ error: 'Failed to fetch metrics data' }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching Finnhub metrics data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
