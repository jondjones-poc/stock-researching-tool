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
    // Calculate date range for 52-week historical data (approximately 252 trading days = 1 year)
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    const fromDate = oneYearAgo.toISOString().split('T')[0]; // YYYY-MM-DD format
    const toDate = today.toISOString().split('T')[0];

    // Fetch quote, profile, share float, and historical price data from Financial Modeling Prep in parallel
    const [quoteResponse, profileResponse, shareFloatResponse, historicalResponse] = await Promise.allSettled([
      axios.get(
        `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${FMP_API_KEY}`,
        { timeout: 10000 }
      ),
      axios.get(
        `https://financialmodelingprep.com/api/v3/profile/${symbol}?apikey=${FMP_API_KEY}`,
        { timeout: 10000 }
      ),
      axios.get(
        `https://financialmodelingprep.com/api/v4/shares_float?symbol=${symbol}&apikey=${FMP_API_KEY}`,
        { timeout: 10000 }
      ),
      axios.get(
        `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`,
        { timeout: 15000 }
      )
    ]);

    const result: any = {
      sharesOutstanding: null,
      fmpPE: null,
      marketCap: null,
      price: null,
      yearHigh: null,
      yearLow: null,
      changePercent: null,
      error: null
    };

    // Process quote data for price, PE, etc.
    if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
      if (Array.isArray(quoteResponse.value.data) && quoteResponse.value.data.length > 0) {
        const quote = quoteResponse.value.data[0];
        
        console.log('FMP Quote data:', JSON.stringify(quote, null, 2));
        
        result.fmpPE = quote.pe;
        result.price = quote.price;
        // Get 52-week high/low - prioritize yearHigh52/yearLow52 (true 52-week range)
        // Fallback to yearHigh/yearLow if yearHigh52/yearLow52 are not available
        // Get 52-week high/low from quote - but we'll validate/override with historical data if available
        result.yearHigh = quote.yearHigh52 || quote.yearHigh || null;
        result.yearLow = quote.yearLow52 || quote.yearLow || null;
        
        console.log('FMP Quote 52-week data:', {
          yearHigh52: quote.yearHigh52,
          yearLow52: quote.yearLow52,
          yearHigh: quote.yearHigh,
          yearLow: quote.yearLow,
          currentPrice: quote.price,
          finalYearHigh: result.yearHigh,
          finalYearLow: result.yearLow
        });
        // Get change percentage - FMP uses changesPercentage field
        result.changePercent = quote.changesPercentage || quote.changePercent || null;
        
        // Use quote marketCap and sharesOutstanding as fallback if profile doesn't have them
        if (!result.marketCap && quote.marketCap) {
          result.marketCap = quote.marketCap;
        }
        if (!result.sharesOutstanding && quote.sharesOutstanding) {
          result.sharesOutstanding = quote.sharesOutstanding;
        }
        
        console.log('FMP PE:', result.fmpPE);
        console.log('Year High:', result.yearHigh);
        console.log('Year Low:', result.yearLow);
        console.log('Change %:', result.changePercent);
        console.log('Quote sharesOutstanding:', quote.sharesOutstanding);
      } else {
        console.log('FMP Quote response is not an array or is empty:', quoteResponse.value.data);
      }
    } else if (quoteResponse.status === 'rejected') {
      const error = quoteResponse.reason?.response?.status === 429 
        ? 'Rate limit exceeded. Please try again later.'
        : quoteResponse.reason?.message || 'Request failed';
      console.log('FMP Quote request failed:', error);
      if (!result.error) result.error = error;
    }

    // Process profile data for sharesOutstanding and marketCap (primary source)
    if (profileResponse.status === 'fulfilled' && profileResponse.value.data) {
      if (Array.isArray(profileResponse.value.data) && profileResponse.value.data.length > 0) {
        const profile = profileResponse.value.data[0];
        
        console.log('FMP Profile data:', JSON.stringify(profile, null, 2));
        
        // Get market cap from profile (mktCap field)
        if (profile.mktCap !== null && profile.mktCap !== undefined) {
          result.marketCap = profile.mktCap;
          console.log('Market Cap from Profile (mktCap):', result.marketCap);
        }
        
        // Get shares outstanding from profile - try multiple field names
        const profileShares = profile.sharesOutstanding || profile.sharesFloat || profile.numberOfShares;
        if (profileShares !== null && profileShares !== undefined) {
          result.sharesOutstanding = profileShares;
          console.log('Shares Outstanding from Profile:', result.sharesOutstanding, 'field:', profile.sharesOutstanding ? 'sharesOutstanding' : profile.sharesFloat ? 'sharesFloat' : 'numberOfShares');
        } else {
          console.log('Profile does not have sharesOutstanding field. Available fields:', Object.keys(profile));
        }
      } else {
        console.log('FMP Profile response is not an array or is empty:', profileResponse.value.data);
      }
    } else if (profileResponse.status === 'rejected') {
      const error = profileResponse.reason?.response?.status === 429 
        ? 'Rate limit exceeded. Please try again later.'
        : profileResponse.reason?.message || 'Request failed';
      console.log('FMP Profile request failed:', error);
      if (!result.error) result.error = error;
    }

    // Process share float data for sharesOutstanding (fallback if profile doesn't have it)
    if (!result.sharesOutstanding && shareFloatResponse.status === 'fulfilled' && shareFloatResponse.value.data) {
      const shareFloatData = shareFloatResponse.value.data;
      console.log('FMP Share Float data:', JSON.stringify(shareFloatData, null, 2));
      
      // Share Float API might return an array or single object
      const shareFloat = Array.isArray(shareFloatData) ? shareFloatData[0] : shareFloatData;
      
      // Try different possible field names for shares outstanding
      if (shareFloat) {
        const shares = shareFloat.sharesOutstanding || shareFloat.numberOfShares || shareFloat.totalShares || shareFloat.sharesFloat;
        if (shares !== null && shares !== undefined && typeof shares === 'number') {
          result.sharesOutstanding = shares;
          console.log('Shares Outstanding from Share Float API:', result.sharesOutstanding);
        }
      }
    } else if (shareFloatResponse.status === 'rejected') {
      const error = shareFloatResponse.reason?.response?.status === 429 
        ? 'Rate limit exceeded. Please try again later.'
        : shareFloatResponse.reason?.message || 'Request failed';
      console.log('FMP Share Float request failed:', error);
      if (!result.error) result.error = error;
    }

    // Process historical price data to calculate accurate 52-week high/low
    if (historicalResponse.status === 'fulfilled' && historicalResponse.value.data) {
      const historicalData = historicalResponse.value.data;
      
      if (historicalData.historical && Array.isArray(historicalData.historical) && historicalData.historical.length > 0) {
        // Calculate 52-week high/low from actual historical price data
        let calculatedYearHigh = null;
        let calculatedYearLow = null;
        
        for (const day of historicalData.historical) {
          if (day.high !== null && day.high !== undefined) {
            if (calculatedYearHigh === null || day.high > calculatedYearHigh) {
              calculatedYearHigh = day.high;
            }
          }
          if (day.low !== null && day.low !== undefined) {
            if (calculatedYearLow === null || day.low < calculatedYearLow) {
              calculatedYearLow = day.low;
            }
          }
        }
        
        console.log('Calculated 52-week high/low from historical data:', {
          calculatedYearHigh,
          calculatedYearLow,
          dataPoints: historicalData.historical.length,
          currentPrice: result.price,
          quoteYearHigh: result.yearHigh,
          quoteYearLow: result.yearLow
        });
        
        // Always use calculated values from historical data if available
        // Historical data is more accurate than quote API fields which may be stale or incorrect
        if (calculatedYearHigh && calculatedYearLow) {
          // Validate: Current price should be between year low and year high
          const calculatedDataValid = result.price && 
            result.price >= calculatedYearLow && result.price <= calculatedYearHigh;
          
          if (calculatedDataValid || !result.price) {
            console.log('Using calculated 52-week high/low from historical data (most accurate)');
            result.yearHigh = calculatedYearHigh;
            result.yearLow = calculatedYearLow;
          } else {
            console.warn('Warning: Current price is outside calculated 52-week range. Using calculated values anyway (more reliable than quote API).');
            result.yearHigh = calculatedYearHigh;
            result.yearLow = calculatedYearLow;
          }
        } else {
          // Validate quote data if calculated values not available
          const quoteDataValid = result.price && result.yearHigh && result.yearLow &&
            result.price >= result.yearLow && result.price <= result.yearHigh;
          
          if (!quoteDataValid && result.price) {
            console.warn('Warning: Current price is outside 52-week range from quote API. Calculated values not available.');
          }
        }
      } else {
        console.log('Historical data not available or empty');
      }
    } else if (historicalResponse.status === 'rejected') {
      const error = historicalResponse.reason?.response?.status === 429 
        ? 'Rate limit exceeded. Please try again later.'
        : historicalResponse.reason?.message || 'Request failed';
      console.log('FMP Historical price request failed:', error);
      // Don't set this as a critical error - we can still use quote data
    }

    console.log('Final FMP result:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching FMP data:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch FMP data', details: error.message },
      { status: 500 }
    );
  }
}
