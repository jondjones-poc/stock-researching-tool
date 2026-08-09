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

export async function GET(request: NextRequest) {
  try {
    const groupParam = request.nextUrl.searchParams.get('group');
    const group =
      groupParam === 'sector' || groupParam === 'country' || groupParam === 'all'
        ? groupParam
        : 'all';
    const markets = await fetchMarketsWithStocks(group);
    return NextResponse.json(
      { markets, group },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('GET /api/markets:', error);
    let hint = '';
    if (err.code === '42P01' || err.message?.includes('market_group')) {
      hint =
        'Run scripts/migrations/038_markets_country_indexes.sql (node scripts/apply-markets-country-indexes.mjs)';
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
    const indexSymbol =
      body.index_symbol === null || body.index_symbol === undefined || body.index_symbol === ''
        ? null
        : normalizeSymbol(body.index_symbol);
    const marketGroup = body.market_group === 'country' ? 'country' : 'sector';

    if (!name) {
      return NextResponse.json({ error: 'Market name is required' }, { status: 400 });
    }
    if (body.index_symbol && !indexSymbol) {
      return NextResponse.json({ error: 'Invalid index symbol' }, { status: 400 });
    }

    const orderResult = await query(
      'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM markets'
    );
    const displayOrder = orderResult.rows[0].next_order;

    const marketResult = await query(
      `INSERT INTO markets (name, display_order, index_symbol, market_group)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, display_order, index_symbol, market_group`,
      [name, displayOrder, indexSymbol, marketGroup]
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
          index_symbol: market.index_symbol,
          market_group: market.market_group,
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
