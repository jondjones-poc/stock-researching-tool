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
    // Fetch quote, profile, and share float data from Financial Modeling Prep in parallel
    const [quoteResponse, profileResponse, shareFloatResponse] = await Promise.allSettled([
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
        // Get year high/low - FMP might use yearHigh/yearLow or yearHigh52/yearLow52
        result.yearHigh = quote.yearHigh || quote.yearHigh52 || null;
        result.yearLow = quote.yearLow || quote.yearLow52 || null;
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
