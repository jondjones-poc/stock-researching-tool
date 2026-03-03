import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '../../utils/db';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  // Finnhub requires an API key
  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ 
      error: 'FINNHUB_API_KEY environment variable is not set. Please add your Finnhub key to use this feature.',
      data: null
    }, { status: 500 });
  }

  const forceRefresh = searchParams.get('force') === 'true';
  const symbolUpper = symbol.toUpperCase();

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
    
    // Use Yahoo Finance quoteSummary API (free, no API key needed)
    // Documentation: https://query2.finance.yahoo.com/v10/finance/quoteSummary/{SYMBOL}?modules=price,earnings
    // Returns: earningsTimestamp/earningsTimestampStart (next earnings) and earnings.earningsDate (last earnings)
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`[Server] Fetching earnings data for ${symbolUpper} from Yahoo Finance`);
    
    // Use axios with cookie handling to maintain session
    let yahooResponse;
    try {
      // First, get the Yahoo Finance page to establish session and get cookies
      const pageResponse = await axios.get(`https://finance.yahoo.com/quote/${symbolUpper}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5'
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      // Extract crumb token from HTML
      let crumb = '';
      const crumbMatch = pageResponse.data.match(/"crumb":"([^"]+)"/);
      if (crumbMatch) {
        crumb = crumbMatch[1];
        console.log(`[Server] Got Yahoo Finance crumb token`);
      }
      
      // Extract cookies from the response
      const cookies = pageResponse.headers['set-cookie'] || [];
      const cookieString = cookies.join('; ');
      
      // Call Yahoo Finance quoteSummary API with crumb and cookies
      const yahooUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbolUpper}?modules=price,earnings${crumb ? `&crumb=${crumb}` : ''}`;
      console.log(`[Server] Calling Yahoo Finance quoteSummary API`);
      
      yahooResponse = await axios.get(yahooUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Cookie': cookieString,
          'Referer': `https://finance.yahoo.com/quote/${symbolUpper}`
        },
        timeout: 10000
      });
    } catch (yahooError: any) {
      console.log(`[Server] Yahoo Finance API failed, falling back to Finnhub:`, yahooError.message);
      if (yahooError.response) {
        console.log(`[Server] Yahoo Finance error status: ${yahooError.response.status}`);
        console.log(`[Server] Yahoo Finance error data:`, yahooError.response.data);
      }
      yahooResponse = null;
    }
    
    // Try to parse Yahoo Finance response
    if (yahooResponse && yahooResponse.data) {
      // Check for error in response
      if (yahooResponse.data.error || (yahooResponse.data.quoteSummary && yahooResponse.data.quoteSummary.error)) {
        console.log(`[Server] Yahoo Finance returned an error:`, yahooResponse.data.error || yahooResponse.data.quoteSummary?.error);
        yahooResponse = null; // Fall through to Finnhub
      } else if (yahooResponse.data.quoteSummary) {
        const quoteSummary = yahooResponse.data.quoteSummary;
        const result = quoteSummary.result && quoteSummary.result[0] ? quoteSummary.result[0] : null;
        
        if (result) {
          const price = result.price || {};
          const earnings = result.earnings || {};
        
          console.log(`[Server] Yahoo Finance data:`, {
            earningsTimestamp: price.earningsTimestamp,
            earningsTimestampStart: price.earningsTimestampStart,
            earningsDate: earnings.earningsDate
          });
          
          // Extract next earnings date (earningsTimestamp or earningsTimestampStart)
          let nextEarningsDate: string | null = null;
          let nextEarningsTimestamp: number | null = null;
          
          if (price.earningsTimestamp) {
            nextEarningsTimestamp = price.earningsTimestamp;
          } else if (price.earningsTimestampStart) {
            nextEarningsTimestamp = price.earningsTimestampStart;
          }
          
          if (nextEarningsTimestamp) {
            const nextDate = new Date(nextEarningsTimestamp * 1000); // Convert from Unix timestamp
            nextEarningsDate = nextDate.toISOString().split('T')[0]; // YYYY-MM-DD format
          }
          
          // Extract last earnings date
          let lastEarningsDate: string | null = null;
          if (earnings.earningsDate && Array.isArray(earnings.earningsDate) && earnings.earningsDate.length > 0) {
            // Get the most recent earnings date
            const lastEarnings = earnings.earningsDate[earnings.earningsDate.length - 1];
            if (lastEarnings && lastEarnings.fmt) {
              // Parse date from format like "Dec 18, 2025"
              const parsedDate = new Date(lastEarnings.fmt);
              if (!isNaN(parsedDate.getTime())) {
                lastEarningsDate = parsedDate.toISOString().split('T')[0];
              }
            } else if (lastEarnings && lastEarnings.raw) {
              // Use raw timestamp if available
              const parsedDate = new Date(lastEarnings.raw * 1000);
              lastEarningsDate = parsedDate.toISOString().split('T')[0];
            }
          }
          
          // Build earnings data array
          const allEarningsData: any[] = [];
          
          // Add last earnings if available
          if (lastEarningsDate) {
            allEarningsData.push({
              date: lastEarningsDate,
              parsedDate: new Date(lastEarningsDate),
              quarter: null, // Yahoo doesn't provide quarter
              year: new Date(lastEarningsDate).getFullYear(),
              actual_eps: null,
              estimated_eps: null,
              actual_revenue: null,
              estimated_revenue: null
            });
          }
          
          // Add next earnings if available and different from last
          if (nextEarningsDate && nextEarningsDate !== lastEarningsDate) {
            allEarningsData.push({
              date: nextEarningsDate,
              parsedDate: new Date(nextEarningsDate),
              quarter: null, // Yahoo doesn't provide quarter
              year: new Date(nextEarningsDate).getFullYear(),
              actual_eps: null,
              estimated_eps: null,
              actual_revenue: null,
              estimated_revenue: null
            });
          }
          
          // Sort by date
          allEarningsData.sort((a: any, b: any) => a.parsedDate.getTime() - b.parsedDate.getTime());
          
          if (allEarningsData.length > 0) {
            console.log(`[Server] Found ${allEarningsData.length} earnings dates from Yahoo Finance`);
            
            // Find future earnings
            const futureEarnings = allEarningsData.filter((item: any) => item.parsedDate > today);
            const nextEarnings = futureEarnings.length > 0 
              ? futureEarnings[0] 
              : (allEarningsData.length > 0 ? allEarningsData[allEarningsData.length - 1] : null);
            
            const earningsData = {
              symbol: symbolUpper,
              nextEarnings: nextEarnings ? {
                date: nextEarnings.date,
                actualEps: nextEarnings.actual_eps || null,
                estimatedEps: nextEarnings.estimated_eps || null,
                actualRevenue: nextEarnings.actual_revenue || null,
                estimatedRevenue: nextEarnings.estimated_revenue || null,
                quarter: nextEarnings.quarter || null,
                year: nextEarnings.year || null
              } : null,
              allEarnings: allEarningsData.map((item: any) => ({
                date: item.date,
                actualEps: item.actual_eps || null,
                estimatedEps: item.estimated_eps || null,
                actualRevenue: item.actual_revenue || null,
                estimatedRevenue: item.estimated_revenue || null,
                quarter: item.quarter || null,
                year: item.year || null
              }))
            };
            
            // Save to database
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
                    nextEarnings.estimated_eps || null,
                    nextEarnings.estimated_revenue || null,
                    nextEarnings.quarter || null,
                    nextEarnings.year || null,
                    symbolUpper
                  ]
                );
                console.log(`Saved earnings data to database for ${symbolUpper}`);
              } catch (saveError: any) {
                console.log('Failed to save earnings data to database:', saveError.message);
              }
            }
            
            return NextResponse.json(earningsData);
          }
        }
      }
    }
    
    // Fallback to Finnhub if Yahoo Finance didn't work
    console.log(`[Server] Yahoo Finance didn't return data, falling back to Finnhub earnings calendar`);
    
    // Calculate date range: 90 days back and 90 days forward (180 day total window)
    const fromDate = new Date(today);
    fromDate.setDate(fromDate.getDate() - 90); // 90 days back
    
    const toDate = new Date(today);
    toDate.setDate(toDate.getDate() + 90); // 90 days forward
    
    const fromDateStr = fromDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const toDateStr = toDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromDateStr}&to=${toDateStr}&token=${FINNHUB_API_KEY}`;
    console.log(`[Server] Fetching earnings calendar for ${symbol} from Finnhub: ${url}`);
    console.log(`[Server] Date range: ${fromDateStr} to ${toDateStr} (180 days: 90 back + 90 forward)`);
    
    const response = await axios.get(url, {
      timeout: 10000
    });

    console.log(`[Server] Finnhub raw response status: ${response.status}`);
    console.log(`[Server] Finnhub response data type:`, typeof response.data);
    console.log(`[Server] Finnhub earnings calendar response keys:`, Object.keys(response.data || {}));
    console.log(`[Server] Finnhub earnings calendar response:`, JSON.stringify(response.data, null, 2));
    
    // Check response structure - Finnhub returns { earningsCalendar: [...] }
    let allEarnings: any[] = [];
    
    if (response.data && Array.isArray(response.data)) {
      // Response is directly an array
      allEarnings = response.data;
      console.log(`[Server] Response is direct array with ${allEarnings.length} items`);
    } else if (response.data && response.data.earningsCalendar && Array.isArray(response.data.earningsCalendar)) {
      // Response has earningsCalendar property
      allEarnings = response.data.earningsCalendar;
      console.log(`[Server] Response has earningsCalendar property with ${allEarnings.length} items`);
    } else {
      console.log(`[Server] Unexpected response structure:`, response.data);
      return NextResponse.json({ 
        error: 'No earnings data available from Finnhub - unexpected response structure',
        data: [],
        debug: { responseKeys: Object.keys(response.data || {}), responseType: typeof response.data }
      }, { status: 404 });
    }
    
    if (allEarnings.length === 0) {
      console.log(`[Server] No earnings entries found in response`);
      return NextResponse.json({ 
        error: 'No earnings data available from Finnhub for the date range',
        data: []
      }, { status: 404 });
    }
    
    // Log all unique symbols found in the response (first 20)
    const uniqueSymbols = [...new Set(allEarnings.map((item: any) => item.symbol).filter(Boolean))].slice(0, 20);
    console.log(`[Server] Found ${allEarnings.length} total earnings entries`);
    console.log(`[Server] Sample symbols in response (first 20):`, uniqueSymbols);
    
    // Filter for our specific symbol (symbolUpper already defined above)
    console.log(`[Server] Filtering for symbol: ${symbolUpper}`);
    
    const symbolEarnings = allEarnings
      .filter((item: any) => {
        const itemSymbol = item.symbol ? item.symbol.toUpperCase() : null;
        const matches = itemSymbol === symbolUpper;
        if (!matches && itemSymbol) {
          // Log first few non-matching symbols for debugging
          if (Math.random() < 0.1) { // Log 10% of non-matches to avoid spam
            console.log(`[Server] Skipping symbol: ${itemSymbol} (looking for ${symbolUpper})`);
          }
        }
        return matches;
      })
      .map((item: any) => {
        // Finnhub returns: { date, symbol, epsEstimate, epsActual, revenueEstimate, revenueActual, hour, year, quarter }
        const earningsDate = new Date(item.date);
        earningsDate.setHours(0, 0, 0, 0);
        return {
          ...item,
          parsedDate: earningsDate,
          // Map Finnhub fields to our expected format
          date: item.date, // Already in YYYY-MM-DD format
          quarter: item.quarter || null,
          year: item.year || null,
          actual_eps: item.epsActual || null,
          estimated_eps: item.epsEstimate || null,
          actual_revenue: item.revenueActual || null,
          estimated_revenue: item.revenueEstimate || null
        };
      })
      .sort((a: any, b: any) => {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      });
    
    console.log(`[Server] Filtered ${symbolEarnings.length} earnings entries for ${symbolUpper}`);
    
    // If symbol not found in initial query, try multiple smaller date ranges to increase coverage
    // Finnhub's API returns ~1500 entries per query, so trying smaller ranges may catch different stocks
    if (symbolEarnings.length === 0) {
      console.log(`[Server] No earnings found for ${symbolUpper} in initial query. Trying smaller date ranges...`);
      
      // Try 3 monthly queries: current month, next month, month after
      const monthlyRanges = [];
      for (let i = 0; i < 3; i++) {
        const monthStart = new Date(today);
        monthStart.setMonth(today.getMonth() + i);
        monthStart.setDate(1); // First day of month
        
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthStart.getMonth() + 1);
        monthEnd.setDate(0); // Last day of month
        
        monthlyRanges.push({
          from: monthStart.toISOString().split('T')[0],
          to: monthEnd.toISOString().split('T')[0]
        });
      }
      
      // Try each monthly range
      for (const range of monthlyRanges) {
        try {
          const monthlyUrl = `https://finnhub.io/api/v1/calendar/earnings?from=${range.from}&to=${range.to}&token=${FINNHUB_API_KEY}`;
          console.log(`[Server] Trying monthly range: ${range.from} to ${range.to}`);
          
          const monthlyResponse = await axios.get(monthlyUrl, { timeout: 10000 });
          let monthlyEarnings: any[] = [];
          
          if (monthlyResponse.data && Array.isArray(monthlyResponse.data)) {
            monthlyEarnings = monthlyResponse.data;
          } else if (monthlyResponse.data && monthlyResponse.data.earningsCalendar && Array.isArray(monthlyResponse.data.earningsCalendar)) {
            monthlyEarnings = monthlyResponse.data.earningsCalendar;
          }
          
          const monthlySymbolEarnings = monthlyEarnings
            .filter((item: any) => item.symbol && item.symbol.toUpperCase() === symbolUpper)
            .map((item: any) => {
              const earningsDate = new Date(item.date);
              earningsDate.setHours(0, 0, 0, 0);
              return {
                ...item,
                parsedDate: earningsDate,
                date: item.date,
                quarter: item.quarter || null,
                year: item.year || null,
                actual_eps: item.epsActual || null,
                estimated_eps: item.epsEstimate || null,
                actual_revenue: item.revenueActual || null,
                estimated_revenue: item.revenueEstimate || null
              };
            });
          
          if (monthlySymbolEarnings.length > 0) {
            console.log(`[Server] Found ${monthlySymbolEarnings.length} earnings entries in monthly range ${range.from} to ${range.to}`);
            symbolEarnings.push(...monthlySymbolEarnings);
            break; // Found it, stop searching
          }
        } catch (monthlyError: any) {
          console.log(`[Server] Monthly range query failed:`, monthlyError.message);
          // Continue to next range
        }
      }
      
      // Sort all found earnings by date
      symbolEarnings.sort((a: any, b: any) => a.parsedDate.getTime() - b.parsedDate.getTime());
      
      if (symbolEarnings.length === 0) {
        console.log(`[Server] No earnings found for ${symbolUpper} after trying multiple date ranges`);
        console.log(`[Server] Note: Finnhub earnings calendar API may have limits (typically returns ~1500 entries per query)`);
        console.log(`[Server] Symbol ${symbolUpper} may not be in any response due to API limits or no scheduled earnings`);
      }
    }
    
    const earningsDatesLog = symbolEarnings.map((e: any) => ({ 
      date: e.date, 
      quarter: e.quarter, 
      year: e.year,
      parsed: e.parsedDate.toISOString()
    }));
    console.log(`[Server] All earnings dates for ${symbolUpper}:`, earningsDatesLog);
    
    // Find future earnings (strictly greater than today, not including today)
    const futureEarnings = symbolEarnings.filter((item: any) => {
      const isFuture = item.parsedDate > today;
      return isFuture;
    });

    const futureEarningsLog = futureEarnings.map((e: any) => ({ date: e.date, parsed: e.parsedDate.toISOString() }));
    console.log(`[Server] Future earnings dates (${futureEarnings.length}):`, futureEarningsLog);

    // Next earnings is the first future date, or the most recent past date if no future dates
    const nextEarnings = futureEarnings.length > 0 
      ? futureEarnings[0] 
      : (symbolEarnings.length > 0 ? symbolEarnings[symbolEarnings.length - 1] : null);
    
    const nextEarningsLog = nextEarnings ? { date: nextEarnings.date, parsed: nextEarnings.parsedDate.toISOString() } : 'null';
    console.log('Selected next earnings:', nextEarningsLog);

    const earningsData = {
      symbol: symbolUpper,
      nextEarnings: nextEarnings ? {
        date: nextEarnings.date,
        actualEps: nextEarnings.actual_eps || null,
        estimatedEps: nextEarnings.estimated_eps || null,
        actualRevenue: nextEarnings.actual_revenue || null,
        estimatedRevenue: nextEarnings.estimated_revenue || null,
        quarter: nextEarnings.quarter || null,
        year: nextEarnings.year || null
      } : null,
      allEarnings: symbolEarnings.map((item: any) => ({
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
            nextEarnings.estimated_eps || null,
            nextEarnings.estimated_revenue || null,
            nextEarnings.quarter || null,
            nextEarnings.year || null,
            symbolUpper
          ]
        );
        console.log(`Saved earnings data to database for ${symbolUpper}`);
      } catch (saveError: any) {
        // If save fails (e.g., columns don't exist), log but don't fail the request
        console.log('Failed to save earnings data to database:', saveError.message);
      }
    }

    return NextResponse.json(earningsData);

  } catch (error: any) {
    console.error('Error fetching earnings calendar from Finnhub:', error.message);
    console.error('Error response:', error.response?.data);
    
    if (error.response?.status === 401) {
      return NextResponse.json({ 
        error: 'Invalid API key for Finnhub',
        details: error.message 
      }, { status: 401 });
    }
    
    if (error.response?.status === 429) {
      return NextResponse.json({ 
        error: 'Finnhub rate limit exceeded',
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
