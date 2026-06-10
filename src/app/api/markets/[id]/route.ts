import { NextRequest, NextResponse } from 'next/server';
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
    const name = String(body.name || '').trim();

    if (!name) {
      return NextResponse.json({ error: 'Market name is required' }, { status: 400 });
    }

    const result = await query(
      `UPDATE markets SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name`,
      [name, marketId]
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
