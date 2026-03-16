import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

interface WatchlistReason {
  id?: number;
  stock_valuations_id: number;
  type: 'buy' | 'avoid';
  body: string;
  created_at?: string;
  updated_at?: string;
}

// GET - Fetch reasons by stock_valuations_id (optional type filter)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stock_valuations_id = searchParams.get('stock_valuations_id');
    const type = searchParams.get('type');
    const id = searchParams.get('id');

    if (!stock_valuations_id && !id) {
      return NextResponse.json(
        { error: 'stock_valuations_id or id parameter is required' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      const idNum = parseInt(id, 10);
      if (Number.isNaN(idNum)) {
        return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
      }
      result = await query(
        'SELECT * FROM watchlist_reasons WHERE id = $1',
        [idNum]
      );
    } else {
      const svId = parseInt(stock_valuations_id!, 10);
      if (Number.isNaN(svId)) {
        return NextResponse.json({ error: 'Invalid stock_valuations_id' }, { status: 400 });
      }
      let sql = 'SELECT * FROM watchlist_reasons WHERE stock_valuations_id = $1';
      const params: (string | number)[] = [svId];
      if (type === 'buy' || type === 'avoid') {
        sql += ' AND type = $2';
        params.push(type);
      }
      sql += ' ORDER BY id ASC';
      result = await query(sql, params);
    }

    const rows = result.rows.map((row: any) => ({
      id: row.id,
      stock_valuations_id: row.stock_valuations_id,
      type: row.type,
      body: row.body,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return NextResponse.json({ data: id ? rows[0] : rows });
  } catch (error: any) {
    console.error('Error fetching watchlist reasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch watchlist reasons', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new reason
export async function POST(request: NextRequest) {
  try {
    const body: WatchlistReason = await request.json();

    if (!body.stock_valuations_id || !body.type || body.body == null) {
      return NextResponse.json(
        { error: 'stock_valuations_id, type, and body are required' },
        { status: 400 }
      );
    }
    if (body.type !== 'buy' && body.type !== 'avoid') {
      return NextResponse.json(
        { error: 'type must be "buy" or "avoid"' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO watchlist_reasons (stock_valuations_id, type, body, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING id, stock_valuations_id, type, body, created_at, updated_at`,
      [body.stock_valuations_id, body.type, body.body.trim()]
    );

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        stock_valuations_id: row.stock_valuations_id,
        type: row.type,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error creating watchlist reason:', error);
    return NextResponse.json(
      { error: 'Failed to create watchlist reason', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing reason
export async function PUT(request: NextRequest) {
  try {
    const body: WatchlistReason & { id?: number } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id?.toString();

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter or body.id is required for update' },
        { status: 400 }
      );
    }
    if (body.body == null || body.body === '') {
      return NextResponse.json(
        { error: 'body is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE watchlist_reasons SET body = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, stock_valuations_id, type, body, created_at, updated_at`,
      [body.body.trim(), id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reason not found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        stock_valuations_id: row.stock_valuations_id,
        type: row.type,
        body: row.body,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Error updating watchlist reason:', error);
    return NextResponse.json(
      { error: 'Failed to update watchlist reason', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete reason by ID
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id parameter is required' },
        { status: 400 }
      );
    }

    const result = await query('DELETE FROM watchlist_reasons WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reason not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting watchlist reason:', error);
    return NextResponse.json(
      { error: 'Failed to delete watchlist reason', details: error.message },
      { status: 500 }
    );
  }
}
