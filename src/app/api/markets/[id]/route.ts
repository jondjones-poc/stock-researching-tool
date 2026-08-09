import { NextRequest, NextResponse } from 'next/server';
import { normalizeSymbol } from '../../../utils/marketsDb';
import { query } from '../../../utils/db';

export async function PUT(
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
    const hasName = body.name !== undefined;
    const hasIndex = body.index_symbol !== undefined;
    const name = hasName ? String(body.name || '').trim() : null;

    if (hasName && !name) {
      return NextResponse.json({ error: 'Market name is required' }, { status: 400 });
    }
    if (!hasName && !hasIndex) {
      return NextResponse.json(
        { error: 'Provide name and/or index_symbol to update' },
        { status: 400 }
      );
    }

    let indexSymbol: string | null | undefined;
    if (hasIndex) {
      if (body.index_symbol === null || body.index_symbol === '') {
        indexSymbol = null;
      } else {
        indexSymbol = normalizeSymbol(body.index_symbol);
        if (!indexSymbol) {
          return NextResponse.json({ error: 'Invalid index symbol' }, { status: 400 });
        }
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (hasName) {
      sets.push(`name = $${i++}`);
      values.push(name);
    }
    if (hasIndex) {
      sets.push(`index_symbol = $${i++}`);
      values.push(indexSymbol);
    }
    sets.push('updated_at = NOW()');
    values.push(marketId);

    const result = await query(
      `UPDATE markets SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, name, display_order, index_symbol`,
      values
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    return NextResponse.json({ market: result.rows[0] });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    console.error('PUT /api/markets/[id]:', error);
    if (err.code === '23505') {
      return NextResponse.json({ error: 'A market with that name already exists' }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to update market', details: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const marketId = parseInt(id, 10);
    if (!Number.isFinite(marketId)) {
      return NextResponse.json({ error: 'Invalid market id' }, { status: 400 });
    }

    const result = await query('DELETE FROM markets WHERE id = $1 RETURNING id', [marketId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Market not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Market deleted' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error('DELETE /api/markets/[id]:', error);
    return NextResponse.json(
      { error: 'Failed to delete market', details: err.message },
      { status: 500 }
    );
  }
}
