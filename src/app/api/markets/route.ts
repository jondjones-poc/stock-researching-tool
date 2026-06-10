import { NextRequest, NextResponse } from 'next/server';
import { fetchMarketsWithStocks, normalizeSymbol } from '../../utils/marketsDb';
import { query } from '../../utils/db';

function normalizeOptionalSymbols(symbols: unknown): string[] {
  if (!Array.isArray(symbols)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of symbols) {
    const sym = normalizeSymbol(raw);
    if (sym && !seen.has(sym)) {
      seen.add(sym);
      out.push(sym);
    }
  }
  return out;
}

export async function GET() {
  try {
    const markets = await fetchMarketsWithStocks();
    return NextResponse.json({ markets });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('GET /api/markets:', error);
    let hint = '';
    if (err.code === '42P01') {
      hint = 'Run scripts/migrations/011_markets_heatmap.sql in Supabase SQL Editor';
    }
    return NextResponse.json(
      { error: 'Failed to fetch markets', details: err.message, hint },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const symbols = normalizeOptionalSymbols(body.symbols);

    if (!name) {
      return NextResponse.json({ error: 'Market name is required' }, { status: 400 });
    }

    const orderResult = await query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM markets'
    );
    const displayOrder = orderResult.rows[0].next_order;

    const marketResult = await query(
      `INSERT INTO markets (name, display_order) VALUES ($1, $2) RETURNING id, name, display_order`,
      [name, displayOrder]
    );
    const market = marketResult.rows[0];

    for (let i = 0; i < symbols.length; i++) {
      await query(
        `INSERT INTO market_stocks (market_id, symbol, stock_order) VALUES ($1, $2, $3)`,
        [market.id, symbols[i], i + 1]
      );
    }

    return NextResponse.json(
      {
        market: {
          id: market.id,
          name: market.name,
          display_order: market.display_order,
          stocks: symbols,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('POST /api/markets:', error);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'A market with that name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create market', details: err.message },
      { status: 500 }
    );
  }
}
