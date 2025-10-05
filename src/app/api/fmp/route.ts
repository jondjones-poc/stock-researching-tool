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
      `https://financialmodelingprep.com/api/v3/quote/${symbol}?apikey=${FMP_API_KEY}`,
      { timeout: 10000 }
    );

    const result: any = {
      sharesOutstanding: null,
      fmpPE: null,
      marketCap: null,
      price: null
    };

    if (quoteResponse.data && quoteResponse.data.length > 0) {
      const quote = quoteResponse.data[0];
      
      console.log('FMP Quote data:', JSON.stringify(quote, null, 2));
      
      result.sharesOutstanding = quote.sharesOutstanding;
      result.fmpPE = quote.pe;
      result.marketCap = quote.marketCap;
      result.price = quote.price;
      
      console.log('Shares Outstanding:', result.sharesOutstanding);
      console.log('FMP PE:', result.fmpPE);
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
