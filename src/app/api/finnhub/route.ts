import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    // Fetch insider transactions (last 6 months)
    const transactionsUrl = `https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${FINNHUB_API_KEY}`;
    
    // Fetch ownership data
    const ownershipUrl = `https://finnhub.io/api/v1/stock/ownership?symbol=${symbol}&token=${FINNHUB_API_KEY}`;

    const [transactionsResponse, ownershipResponse] = await Promise.allSettled([
      axios.get(transactionsUrl, { timeout: 10000 }),
      axios.get(ownershipUrl, { timeout: 10000 }),
    ]);

    const result: any = {
      transactions: [],
      ownership: [],
    };

    if (transactionsResponse.status === 'fulfilled' && transactionsResponse.value.data) {
      result.transactions = transactionsResponse.value.data.data || [];
    }

    if (ownershipResponse.status === 'fulfilled' && ownershipResponse.value.data) {
      result.ownership = ownershipResponse.value.data.ownership || [];
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching from Finnhub:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch data from Finnhub', details: error.message },
      { status: 500 }
    );
  }
}

