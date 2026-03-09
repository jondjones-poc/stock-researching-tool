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
  const cacheKey = `cashflow_${symbol}`.toLowerCase();

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
        const cachedCashFlow = typeof cachedData.news_data === 'string'
          ? JSON.parse(cachedData.news_data)
          : cachedData.news_data;

        console.log(`[Cash Flow Cache] Returning cached data for ${symbol} (cached at: ${cachedData.cached_at})`);
        return NextResponse.json({
          symbol,
          cashFlow: cachedCashFlow,
          cached: true,
          cached_at: cachedData.cached_at
        });
      }
    } catch (dbError: any) {
      if (dbError.message?.includes('does not exist')) {
        console.log(`[Cash Flow Cache] Cache table doesn't exist yet, fetching from API`);
      } else {
        console.error(`[Cash Flow Cache] Error checking cache:`, dbError.message);
      }
    }

    // Fetch from FMP API
    const url = `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${symbol}&limit=5&apikey=${FMP_API_KEY}`;
    
    console.log(`[Cash Flow API] Fetching data for ${symbol} from FMP`);

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

    if (!Array.isArray(response.data) || response.data.length === 0) {
      console.warn(`FMP returned empty or invalid data for ${symbol}`);
      return NextResponse.json({
        error: `No cash flow data available for symbol "${symbol}"`,
        details: 'FMP API returned empty results'
      }, { status: 404 });
    }

    // Transform data to include only needed fields
    const cashFlowData = response.data
      .map((item: any) => ({
        date: item.date,
        freeCashFlow: item.freeCashFlow ?? null,
        dividendsPaid: item.dividendsPaid ?? null,
        year: new Date(item.date).getFullYear()
      }))
      .filter((item: any) => item.date && (item.freeCashFlow !== null || item.dividendsPaid !== null));

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
        [cacheKey, JSON.stringify(cashFlowData), expiresAt]
      );
      console.log(`[Cash Flow Cache] Cached data for ${symbol} (expires in 10 minutes)`);
    } catch (cacheError: any) {
      if (cacheError.message?.includes('does not exist')) {
        console.log(`[Cash Flow Cache] Cache table doesn't exist yet. Please run create_news_cache_table.sql`);
      } else {
        console.error(`[Cash Flow Cache] Error caching data:`, cacheError.message);
      }
    }

    return NextResponse.json({
      symbol,
      cashFlow: cashFlowData,
      cached: false
    });

  } catch (error: any) {
    console.error('Error fetching cash flow data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch cash flow data',
        details: error.message
      },
      { status: 500 }
    );
  }
}
