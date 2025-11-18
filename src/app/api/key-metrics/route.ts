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
    // Note: Free tier limits 'limit' parameter to max 5
    const [metricsResponse, ratiosResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=5&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/stable/ratios?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 })
    ]);

    // Check if metrics response is successful and valid
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.status === 200) {
      const metricsData = metricsResponse.value.data;
      
      // Check if response is an error string (when limit is exceeded)
      if (typeof metricsData === 'string' && (metricsData.includes('Premium') || metricsData.includes('limit') || metricsData.includes('subscription'))) {
        console.log(`Key metrics subscription limit error for ${symbol}:`, metricsData);
        return NextResponse.json({
          sharesOutstanding: null,
          symbol: symbol.toUpperCase(),
          error: `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - subscription limit (limit parameter must be 0-5)`
        });
      }
      
      // Check if response is a valid array with data
      if (Array.isArray(metricsData) && metricsData.length > 0) {
        const latestMetrics = metricsData[0];
        
        // Extract shares outstanding (number of shares)
        const sharesOutstanding = latestMetrics.numberOfShares;
        
        console.log(`Shares outstanding for ${symbol}:`, sharesOutstanding);
        console.log(`ROIC for ${symbol}:`, latestMetrics.roic);
        
        // Get annual payout ratio from financial ratios endpoint only (full-year data)
        let payoutRatio = null;
        if (ratiosResponse.status === 'fulfilled' && ratiosResponse.value.status === 200 && Array.isArray(ratiosResponse.value.data) && ratiosResponse.value.data.length > 0) {
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
        console.log(`No key metrics data found for ${symbol} - empty array or invalid format`);
      }
    } else {
      console.log(`Key metrics request failed for ${symbol}`);
      // Check for errors in the responses
      const errors: string[] = [];
      
      if (metricsResponse.status === 'rejected') {
        const error = metricsResponse.reason;
        const statusCode = error.response?.status;
        if (statusCode === 429) {
          errors.push(`FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - rate limit`);
        } else if (statusCode === 402) {
          errors.push(`FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - payment required (402)`);
        } else if (statusCode === 403) {
          errors.push(`FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - forbidden (403)`);
        } else if (statusCode) {
          errors.push(`FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - HTTP ${statusCode}`);
        } else {
          errors.push(`FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - request failed`);
        }
      }
      
      if (ratiosResponse.status === 'rejected') {
        const error = ratiosResponse.reason;
        const statusCode = error.response?.status;
        if (statusCode === 429) {
          errors.push(`FMP https://financialmodelingprep.com/stable/ratios?symbol=${symbol} - rate limit`);
        } else if (statusCode === 402) {
          errors.push(`FMP https://financialmodelingprep.com/stable/ratios?symbol=${symbol} - payment required (402)`);
        } else if (statusCode === 403) {
          errors.push(`FMP https://financialmodelingprep.com/stable/ratios?symbol=${symbol} - forbidden (403)`);
        } else if (statusCode) {
          errors.push(`FMP https://financialmodelingprep.com/stable/ratios?symbol=${symbol} - HTTP ${statusCode}`);
        } else {
          errors.push(`FMP https://financialmodelingprep.com/stable/ratios?symbol=${symbol} - request failed`);
        }
      }
      
      if (errors.length > 0) {
        return NextResponse.json({
          sharesOutstanding: null,
          symbol: symbol.toUpperCase(),
          error: errors[0], // Return first error for display
          errors: errors // Return all errors
        });
      }
      
      return NextResponse.json({
        sharesOutstanding: null,
        symbol: symbol.toUpperCase(),
        error: `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - no data available`
      });
    }
  } catch (error: any) {
    console.error('Error fetching key metrics:', error);
    const statusCode = error.response?.status;
    let errorMessage = 'Failed to fetch key metrics data';
    
    if (statusCode === 429) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - rate limit`;
    } else if (statusCode === 402) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - payment required (402)`;
    } else if (statusCode === 403) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - forbidden (403)`;
    } else if (statusCode) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol} - HTTP ${statusCode}`;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode || 500 }
    );
  }
}
