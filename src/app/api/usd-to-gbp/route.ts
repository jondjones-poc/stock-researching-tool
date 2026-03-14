import { NextResponse } from 'next/server';

const FRANKFURTER_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=GBP';

/** GET - Return USD to GBP rate from Frankfurter (free API). Used for displaying £ on Dividends and Retirement by Dividends. */
export async function GET() {
  try {
    const res = await fetch(FRANKFURTER_URL, { next: { revalidate: 3600 } });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Frankfurter API ${res.status}: ${text}`);
    }
    const data = await res.json();
    const rate = data?.rates?.GBP;
    if (typeof rate !== 'number' || !Number.isFinite(rate)) {
      throw new Error('Invalid rate in response');
    }
    return NextResponse.json({ rate, base: 'USD', symbol: 'GBP', date: data?.date ?? null });
  } catch (error: unknown) {
    console.error('USD to GBP fetch failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch rate' },
      { status: 500 }
    );
  }
}
