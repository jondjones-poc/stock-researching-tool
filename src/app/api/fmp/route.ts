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
    // Fetch quote data from Financial Modeling Prep
    const quoteResponse = await axios.get(
      `https://financialmodelingprep.com/stable/quote?symbol=${symbol}&apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    const result: any = {
      sharesOutstanding: null,
      fmpPE: null,
      marketCap: null,
      price: null,
      yearHigh: null,
      yearLow: null,
      changePercent: null
    };

    if (quoteResponse.data && quoteResponse.data.length > 0) {
      const quote = quoteResponse.data[0];
      
      console.log('FMP Quote data:', JSON.stringify(quote, null, 2));
      
      result.sharesOutstanding = quote.sharesOutstanding;
      result.fmpPE = quote.pe;
      result.marketCap = quote.marketCap;
      result.price = quote.price;
      // Get year high/low - FMP might use yearHigh/yearLow or yearHigh52/yearLow52
      result.yearHigh = quote.yearHigh || quote.yearHigh52 || null;
      result.yearLow = quote.yearLow || quote.yearLow52 || null;
      // Get change percentage - FMP uses changesPercentage field
      result.changePercent = quote.changesPercentage || quote.changePercent || null;
      
      console.log('Shares Outstanding:', result.sharesOutstanding);
      console.log('FMP PE:', result.fmpPE);
      console.log('Year High:', result.yearHigh);
      console.log('Year Low:', result.yearLow);
      console.log('Change %:', result.changePercent);
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
