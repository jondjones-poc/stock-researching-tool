import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

interface MonthlyStock {
  id?: number;
  stock_id: number;
  investment_date: string; // ISO date string
}

// GET - Fetch monthly stocks, optionally filtered by month/year
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month'); // 1-12
    const year = searchParams.get('year'); // YYYY
    const stock_id = searchParams.get('stock_id');
    const id = searchParams.get('id');

    let sql = `
      SELECT 
        ms.id,
        ms.stock_id,
        ms.investment_date,
        ms.created_at,
        ms.updated_at,
        sv.stock as stock_symbol,
        sv.buy_price,
        sv.active_price
      FROM monthly_stocks ms
      JOIN stock_valuations sv ON ms.stock_id = sv.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (id) {
      sql += ` AND ms.id = $${paramIndex}`;
      params.push(id);
      paramIndex++;
    }

    if (stock_id) {
      sql += ` AND ms.stock_id = $${paramIndex}`;
      params.push(stock_id);
      paramIndex++;
    }

    if (month && year) {
      sql += ` AND EXTRACT(MONTH FROM ms.investment_date) = $${paramIndex} AND EXTRACT(YEAR FROM ms.investment_date) = $${paramIndex + 1}`;
      params.push(parseInt(month), parseInt(year));
    }

    sql += ` ORDER BY ms.investment_date DESC, sv.stock ASC`;

    const result = await query(sql, params);

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        stock_id: row.stock_id,
        investment_date: row.investment_date,
        stock_symbol: row.stock_symbol,
        buy_price: row.buy_price !== null && row.buy_price !== undefined ? parseFloat(String(row.buy_price)) : null,
        active_price: row.active_price !== null && row.active_price !== undefined ? parseFloat(String(row.active_price)) : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching monthly stocks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly stocks', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new monthly stock entry
export async function POST(request: NextRequest) {
  try {
    const body: MonthlyStock = await request.json();
    const { stock_id, investment_date } = body;

    if (!stock_id || !investment_date) {
      return NextResponse.json(
        { error: 'stock_id and investment_date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const date = new Date(investment_date);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid investment_date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Check if entry already exists for this stock_id and date
    const checkResult = await query(
      `SELECT id FROM monthly_stocks 
       WHERE stock_id = $1 AND investment_date = $2`,
      [stock_id, investment_date]
    );

    if (checkResult.rows.length > 0) {
      return NextResponse.json(
        { error: 'Monthly stock entry already exists for this stock and date' },
        { status: 409 }
      );
    }

    const result = await query(
      `INSERT INTO monthly_stocks (stock_id, investment_date) 
       VALUES ($1, $2) 
       RETURNING id, investment_date, created_at, updated_at`,
      [stock_id, investment_date]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating monthly stock:', error);
    return NextResponse.json(
      { error: 'Failed to create monthly stock', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing monthly stock entry
export async function PUT(request: NextRequest) {
  try {
    const body: MonthlyStock & { id?: number } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id?.toString();

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required for update' },
        { status: 400 }
      );
    }

    const { stock_id, investment_date } = body;

    if (!stock_id || !investment_date) {
      return NextResponse.json(
        { error: 'stock_id and investment_date are required' },
        { status: 400 }
      );
    }

    // Validate date format
    const date = new Date(investment_date);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: 'Invalid investment_date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE monthly_stocks 
       SET stock_id = $1, investment_date = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3 
       RETURNING id, stock_id, investment_date, updated_at`,
      [stock_id, investment_date, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Monthly stock entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating monthly stock:', error);
    return NextResponse.json(
      { error: 'Failed to update monthly stock', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete monthly stock entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required for deletion' },
        { status: 400 }
      );
    }

    const result = await query(
      'DELETE FROM monthly_stocks WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Monthly stock entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Monthly stock entry deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting monthly stock:', error);
    return NextResponse.json(
      { error: 'Failed to delete monthly stock', details: error.message },
      { status: 500 }
    );
  }
}
