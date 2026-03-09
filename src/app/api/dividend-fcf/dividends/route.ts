import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '../../../utils/db';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY is not configured' }, { status: 500 });
  }

  // Create cache key
  const cacheKey = `dividends_${symbol}`.toLowerCase();

  try {
    // Check cache first (10 minutes)
    try {
      const cacheResult = await query(
        `SELECT news_data, cached_at, expires_at 
         FROM news_cache 
         WHERE symbol = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (cacheResult.rows.length > 0) {
        const cachedData = cacheResult.rows[0];
        const cachedDividends = typeof cachedData.news_data === 'string'
          ? JSON.parse(cachedData.news_data)
          : cachedData.news_data;

        console.log(`[Dividend Cache] Returning cached data for ${symbol} (cached at: ${cachedData.cached_at})`);
        return NextResponse.json({
          symbol,
          dividends: cachedDividends,
          cached: true,
          cached_at: cachedData.cached_at
        });
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist')) {
        console.log(`[Dividend Cache] Cache table doesn't exist yet, fetching from API`);
      } else {
        console.error(`[Dividend Cache] Error checking cache:`, dbError.message);
      }
    }

    // Fetch from FMP API
    const url = `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    
    console.log(`[Dividend API] Fetching data for ${symbol} from FMP`);

    const response = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true
    });

    if (response.status !== 200) {
      console.error(`FMP API returned status ${response.status} for ${symbol}:`, response.data);
      
      // Handle 402 Payment Required specifically
      if (response.status === 402) {
        return NextResponse.json({
          error: 'Payment required (402) - Your FMP API subscription may have expired or hit its daily/monthly limit. Please check your FMP account or upgrade your subscription.',
          details: response.data,
          statusCode: 402
        }, { status: 402 });
      }
      
      return NextResponse.json({
        error: response.data?.['Error Message'] || `FMP API returned status ${response.status}`,
        details: response.data
      }, { status: response.status === 404 ? 404 : 500 });
    }

    // Check if the response is an error object
    if (response.data && typeof response.data === 'object' && 'Error Message' in response.data) {
      console.error('FMP API error message in response:', response.data['Error Message']);
      return NextResponse.json({
        error: response.data['Error Message'] || 'FMP API returned an error',
        details: response.data
      }, { status: 404 });
    }

    // FMP returns data in format: { historical: [...] } or just an array
    let dividendData = [];
    if (Array.isArray(response.data)) {
      dividendData = response.data;
    } else if (response.data?.historical && Array.isArray(response.data.historical)) {
      dividendData = response.data.historical;
    } else if (response.data?.dividends && Array.isArray(response.data.dividends)) {
      dividendData = response.data.dividends;
    }

    if (dividendData.length === 0) {
      // Don't log as warning - empty dividend data is expected for many stocks
      return NextResponse.json({
        error: `No dividend data available for symbol "${symbol}"`,
        details: 'FMP API returned empty results'
      }, { status: 404 });
    }

    // Transform data to include only needed fields
    const dividends = dividendData
      .map((item: any) => ({
        date: item.date,
        dividend: item.dividend ?? null,
        adjustedDividend: item.adjustedDividend ?? item.dividend ?? null,
        year: new Date(item.date).getFullYear()
      }))
      .filter((item: any) => item.date && (item.dividend !== null || item.adjustedDividend !== null))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort descending

    // Store in cache (10 minutes expiration)
    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      await query(
        `INSERT INTO news_cache (symbol, news_data, cached_at, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
         ON CONFLICT (symbol) 
         DO UPDATE SET 
           news_data = EXCLUDED.news_data,
           cached_at = CURRENT_TIMESTAMP,
           expires_at = $3`,
        [cacheKey, JSON.stringify(dividends), expiresAt]
      );
      console.log(`[Dividend Cache] Cached data for ${symbol} (expires in 10 minutes)`);
    } catch (cacheError: any) {
      if (cacheError.message?.includes('does not exist')) {
        console.log(`[Dividend Cache] Cache table doesn't exist yet. Please run create_news_cache_table.sql`);
      } else {
        console.error(`[Dividend Cache] Error caching data:`, cacheError.message);
      }
    }

    return NextResponse.json({
      symbol,
      dividends,
      cached: false
    });

  } catch (error: any) {
    console.error('Error fetching dividend data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dividend data',
        details: error.message
      },
      { status: 500 }
    );
  }
}
