import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '../../utils/db';

const API_NINJAS_API_KEY = process.env.API_NINJAS_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  // API Ninjas requires an API key
  if (!API_NINJAS_API_KEY) {
    return NextResponse.json({ 
      error: 'API_NINJAS_API_KEY environment variable is not set. Please add your API Ninjas key to use this feature.',
      data: null
    }, { status: 500 });
  }

  const forceRefresh = searchParams.get('force') === 'true';

  try {
    // First, check if we have earnings data in the database (skip if force refresh)
    if (!forceRefresh) {
      try {
        const dbResult = await query(
          `SELECT next_earnings_date, next_earnings_eps_estimate, next_earnings_revenue_estimate, 
                  next_earnings_quarter, next_earnings_year, earnings_data_updated_at
           FROM stock_valuations 
           WHERE stock = $1 
           AND next_earnings_date IS NOT NULL
           ORDER BY created_at DESC 
           LIMIT 1`,
          [symbol.toUpperCase()]
        );

        if (dbResult.rows.length > 0 && dbResult.rows[0].next_earnings_date) {
          const dbData = dbResult.rows[0];
          const updatedAt = dbData.earnings_data_updated_at;
          const daysSinceUpdate = updatedAt ? Math.floor((new Date().getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 999;
          
          // If data is less than 7 days old, use it
          if (daysSinceUpdate < 7) {
            console.log(`Using cached earnings data from database for ${symbol} (${daysSinceUpdate} days old)`);
            
            return NextResponse.json({
              symbol: symbol.toUpperCase(),
              nextEarnings: {
                date: dbData.next_earnings_date,
                epsEstimate: dbData.next_earnings_eps_estimate,
                revenueEstimate: dbData.next_earnings_revenue_estimate,
                quarter: dbData.next_earnings_quarter,
                year: dbData.next_earnings_year
              },
              allEarnings: [{
                date: dbData.next_earnings_date,
                epsEstimate: dbData.next_earnings_eps_estimate,
                revenueEstimate: dbData.next_earnings_revenue_estimate,
                quarter: dbData.next_earnings_quarter,
                year: dbData.next_earnings_year
              }],
              cached: true
            });
          } else {
            console.log(`Database has earnings data for ${symbol} but it's ${daysSinceUpdate} days old, will refresh from API`);
          }
        }
      } catch (dbError: any) {
        // If database query fails (e.g., columns don't exist yet), continue to API call
        console.log('Database query failed, will fetch from API:', dbError.message);
      }
    } else {
      console.log(`Force refresh requested for ${symbol}, skipping database cache`);
    }
    // API Ninjas returns only 3 results by default. 
    // Documentation: https://api-ninjas.com/api/earningscalendar
    // - limit: max 10 for premium users (default is 3)
    // - show_upcoming: premium feature to prioritize upcoming earnings
    // - The API returns past and upcoming earnings mixed together
    // We'll try with limit=10 first, and filter for future dates on our side
    const url = `https://api.api-ninjas.com/v1/earningscalendar?ticker=${symbol.toUpperCase()}&limit=10`;
    console.log(`[Server] Fetching earnings calendar for ${symbol} from API Ninjas: ${url}`);
    console.log(`[Server] Note: API returns max 3 results by default, limit=10 may require premium tier`);
    
    const response = await axios.get(url, {
      headers: {
        'X-Api-Key': API_NINJAS_API_KEY
      },
      timeout: 10000
    });

    console.log(`[Server] API Ninjas raw response status: ${response.status}`);
    console.log(`[Server] API Ninjas raw response data type:`, typeof response.data);
    console.log(`[Server] API Ninjas raw response is array:`, Array.isArray(response.data));
    console.log(`[Server] API Ninjas earnings calendar response for ${symbol}:`, JSON.stringify(response.data, null, 2));
    console.log(`[Server] Number of earnings entries returned:`, Array.isArray(response.data) ? response.data.length : 'Not an array');
    
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log(`[Server] All dates from API Ninjas:`, response.data.map((item: any) => ({ 
        date: item.date, 
        quarter: item.quarter, 
        year: item.year,
        actual_eps: item.actual_eps,
        estimated_eps: item.estimated_eps,
        actual_revenue: item.actual_revenue,
        estimated_revenue: item.estimated_revenue
      })));
      console.log(`[Server] Full API response structure (first item):`, JSON.stringify(response.data[0], null, 2));
      console.log(`[Server] Full API response structure (last item):`, JSON.stringify(response.data[response.data.length - 1], null, 2));
    } else {
      console.log(`[Server] Response data structure:`, response.data);
    }

    if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
      return NextResponse.json({ 
        error: 'No earnings data available',
        data: []
      }, { status: 404 });
    }

    // Find the next earnings date (most recent future date)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('Today date for comparison:', today.toISOString());
    
    // Sort all earnings by date (ascending)
    const sortedEarnings = response.data
      .filter((item: any) => item.date) // Only include items with dates
      .map((item: any) => {
        const earningsDate = new Date(item.date);
        earningsDate.setHours(0, 0, 0, 0);
        return { ...item, parsedDate: earningsDate };
      })
      .sort((a: any, b: any) => {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      });
    
    console.log('All sorted earnings dates:', sortedEarnings.map((e: any) => ({ date: e.date, parsed: e.parsedDate.toISOString() })));
    
    // Find future earnings (strictly greater than today, not including today)
    const futureEarnings = sortedEarnings.filter((item: any) => {
      const isFuture = item.parsedDate > today;
      console.log(`Earnings date ${item.date} (${item.parsedDate.toISOString()}) is future: ${isFuture} (today: ${today.toISOString()})`);
      return isFuture;
    });

    console.log('Future earnings dates:', futureEarnings.map((e: any) => ({ date: e.date, parsed: e.parsedDate.toISOString() })));

    // Next earnings is the first future date, or the most recent past date if no future dates
    const nextEarnings = futureEarnings.length > 0 
      ? futureEarnings[0] 
      : (sortedEarnings.length > 0 ? sortedEarnings[sortedEarnings.length - 1] : null);
    
    console.log('Selected next earnings:', nextEarnings ? { date: nextEarnings.date, parsed: nextEarnings.parsedDate.toISOString() } : 'null');

    const earningsData = {
      symbol: symbol.toUpperCase(),
      nextEarnings: nextEarnings ? {
        date: nextEarnings.date,
        actualEps: nextEarnings.actual_eps || null,
        estimatedEps: nextEarnings.estimated_eps || null,
        actualRevenue: nextEarnings.actual_revenue || null,
        estimatedRevenue: nextEarnings.estimated_revenue || null,
        quarter: nextEarnings.quarter || null,
        year: nextEarnings.year || null
      } : null,
      allEarnings: sortedEarnings.map((item: any) => ({
        date: item.date,
        actualEps: item.actual_eps || null,
        estimatedEps: item.estimated_eps || null,
        actualRevenue: item.actual_revenue || null,
        estimatedRevenue: item.estimated_revenue || null,
        quarter: item.quarter || null,
        year: item.year || null
      }))
    };

    // Save to database if we have next earnings data
    if (nextEarnings) {
      try {
        await query(
          `UPDATE stock_valuations 
           SET next_earnings_date = $1,
               next_earnings_eps_estimate = $2,
               next_earnings_revenue_estimate = $3,
               next_earnings_quarter = $4,
               next_earnings_year = $5,
               earnings_data_updated_at = CURRENT_TIMESTAMP
           WHERE stock = $6
           AND (next_earnings_date IS NULL OR next_earnings_date != $1 OR earnings_data_updated_at < NOW() - INTERVAL '7 days')`,
          [
            nextEarnings.date,
            nextEarnings.eps_estimate || null,
            nextEarnings.revenue_estimate || null,
            nextEarnings.quarter || null,
            nextEarnings.year || null,
            symbol.toUpperCase()
          ]
        );
        console.log(`Saved earnings data to database for ${symbol}`);
      } catch (saveError: any) {
        // If save fails (e.g., columns don't exist), log but don't fail the request
        console.log('Failed to save earnings data to database:', saveError.message);
      }
    }

    return NextResponse.json(earningsData);

  } catch (error: any) {
    console.error('Error fetching earnings calendar from API Ninjas:', error.message);
    console.error('Error response:', error.response?.data);
    
    if (error.response?.status === 401) {
      return NextResponse.json({ 
        error: 'Invalid API key for API Ninjas',
        details: error.message 
      }, { status: 401 });
    }
    
    if (error.response?.status === 429) {
      return NextResponse.json({ 
        error: 'API Ninjas rate limit exceeded',
        details: error.message 
      }, { status: 429 });
    }

    return NextResponse.json(
      { error: 'Failed to fetch earnings calendar data', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Save earnings data to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, nextEarnings } = body;

    if (!symbol) {
      return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
    }

    if (!nextEarnings || !nextEarnings.date) {
      return NextResponse.json({ error: 'Earnings date is required' }, { status: 400 });
    }

    // Update or insert earnings data for the stock symbol
    const result = await query(
      `UPDATE stock_valuations 
       SET next_earnings_date = $1,
           next_earnings_eps_estimate = $2,
           next_earnings_revenue_estimate = $3,
           next_earnings_quarter = $4,
           next_earnings_year = $5,
           earnings_data_updated_at = CURRENT_TIMESTAMP
       WHERE stock = $6
       RETURNING id`,
      [
        nextEarnings.date,
        nextEarnings.epsEstimate || null,
        nextEarnings.revenueEstimate || null,
        nextEarnings.quarter || null,
        nextEarnings.year || null,
        symbol.toUpperCase()
      ]
    );

    if (result.rows.length === 0) {
      // No existing record found, try to create one with just the stock symbol and earnings data
      // First check if stock exists
      const checkResult = await query(
        `SELECT id FROM stock_valuations WHERE stock = $1 LIMIT 1`,
        [symbol.toUpperCase()]
      );

      if (checkResult.rows.length > 0) {
        // Stock exists but update didn't work, try again with the ID
        const stockId = checkResult.rows[0].id;
        await query(
          `UPDATE stock_valuations 
           SET next_earnings_date = $1,
               next_earnings_eps_estimate = $2,
               next_earnings_revenue_estimate = $3,
               next_earnings_quarter = $4,
               next_earnings_year = $5,
               earnings_data_updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [
            nextEarnings.date,
            nextEarnings.epsEstimate || null,
            nextEarnings.revenueEstimate || null,
            nextEarnings.quarter || null,
            nextEarnings.year || null,
            stockId
          ]
        );
      } else {
        // Create new record with just stock and earnings data
        await query(
          `INSERT INTO stock_valuations (stock, next_earnings_date, next_earnings_eps_estimate, 
           next_earnings_revenue_estimate, next_earnings_quarter, next_earnings_year, earnings_data_updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`,
          [
            symbol.toUpperCase(),
            nextEarnings.date,
            nextEarnings.epsEstimate || null,
            nextEarnings.revenueEstimate || null,
            nextEarnings.quarter || null,
            nextEarnings.year || null
          ]
        );
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Earnings data saved successfully' 
    });

  } catch (error: any) {
    console.error('Error saving earnings data:', error.message);
    return NextResponse.json(
      { error: 'Failed to save earnings data', details: error.message },
      { status: 500 }
    );
  }
}
