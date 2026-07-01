import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - All portfolio stocks (all-time)
export async function GET() {
  try {
    const result = await query(
      `SELECT
         ps.id,
         ps.stock_id,
         ps.created_at,
         ps.updated_at,
         sv.stock AS stock_symbol,
         sv.active_price
       FROM portfolio_stocks ps
       JOIN stock_valuations sv ON ps.stock_id = sv.id
       ORDER BY sv.stock ASC`
    );

    return NextResponse.json({
      data: result.rows.map((row) => ({
        id: row.id,
        stock_id: row.stock_id,
        stock_symbol: row.stock_symbol,
        active_price:
          row.active_price !== null && row.active_price !== undefined
            ? parseFloat(String(row.active_price))
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'portfolio_stocks table does not exist',
          hint: 'Run node scripts/apply-portfolio-stocks.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch portfolio stocks', details: err.message },
      { status: 500 }
    );
  }
}

// POST - Add stock to portfolio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_id } = body as { stock_id?: number };

    if (!stock_id) {
      return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM portfolio_stocks WHERE stock_id = $1', [stock_id]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'This stock is already in your portfolio' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO portfolio_stocks (stock_id)
       VALUES ($1)
       RETURNING id, stock_id, created_at, updated_at`,
      [stock_id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'portfolio_stocks table does not exist',
          hint: 'Run node scripts/apply-portfolio-stocks.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to add portfolio stock', details: err.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove from portfolio
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
  }

  try {
    const result = await query('DELETE FROM portfolio_stocks WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Portfolio entry not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Stock removed from portfolio' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: 'Failed to delete portfolio stock', details: err.message },
      { status: 500 }
    );
  }
}
