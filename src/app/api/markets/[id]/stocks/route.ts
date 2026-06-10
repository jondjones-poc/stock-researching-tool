import { NextRequest, NextResponse } from 'next/server';
import { normalizeSymbol, nextStockOrder } from '../../../../utils/marketsDb';
import { query } from '../../../../utils/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);
    if (!Number.isFinite(marketId)) {
      return NextResponse.json({ error: 'Invalid market id' }, { status: 400 });
    }

    const body = await request.json();
    const symbol = normalizeSymbol(body.symbol);
    if (!symbol) {
      return NextResponse.json({ error: 'Valid stock symbol is required' }, { status: 400 });
    }

    const market = await query('SELECT id FROM markets WHERE id = $1', [marketId]);
    if (market.rows.length === 0) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    const order = await nextStockOrder(marketId);
    await query(
      `INSERT INTO market_stocks (market_id, symbol, stock_order) VALUES ($1, $2, $3) RETURNING symbol`,
      [marketId, symbol, order]
    );

    await query('UPDATE markets SET updated_at = NOW() WHERE id = $1', [marketId]);

    return NextResponse.json({ symbol }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('POST /api/markets/[id]/stocks:', error);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'Symbol already in this market' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to add stock', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);
    if (!Number.isFinite(marketId)) {
      return NextResponse.json({ error: 'Invalid market id' }, { status: 400 });
    }

    const symbol = normalizeSymbol(request.nextUrl.searchParams.get('symbol'));
    if (!symbol) {
      return NextResponse.json({ error: 'symbol query param is required' }, { status: 400 });
    }

    const result = await query(
      'DELETE FROM market_stocks WHERE market_id = $1 AND symbol = $2 RETURNING symbol',
      [marketId, symbol]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Stock not found in market' }, { status: 404 });
    }

    await query('UPDATE markets SET updated_at = NOW() WHERE id = $1', [marketId]);

    return NextResponse.json({ message: 'Stock removed', symbol });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('DELETE /api/markets/[id]/stocks:', error);
    return NextResponse.json(
      { error: 'Failed to remove stock', details: err.message },
      { status: 500 }
    );
  }
}
