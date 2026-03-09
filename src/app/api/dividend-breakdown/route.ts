import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch dividend breakdown data
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const action = searchParams.get('action'); // 'symbols' to get list of symbols

  try {
    // Get list of all stock symbols
    if (action === 'symbols') {
      const result = await query(
        `SELECT DISTINCT stock_symbol 
         FROM dividend_breakdown 
         ORDER BY stock_symbol ASC`
      );
      const symbols = result.rows.map(row => row.stock_symbol);
      return NextResponse.json({ symbols });
    }

    // Get data for a specific symbol
    if (symbol) {
      const result = await query(
        `SELECT id, stock_symbol, year, free_cash_flow, dividends_paid, 
                fcf_payout_ratio, adjusted_dividend, payout_ratio,
                created_at, updated_at
         FROM dividend_breakdown 
         WHERE stock_symbol = $1 
         ORDER BY year DESC`,
        [symbol.toUpperCase()]
      );
      return NextResponse.json({ data: result.rows });
    }

    // Get all data if no symbol specified
    const result = await query(
      `SELECT id, stock_symbol, year, free_cash_flow, dividends_paid, 
              fcf_payout_ratio, adjusted_dividend, payout_ratio,
              created_at, updated_at
       FROM dividend_breakdown 
       ORDER BY stock_symbol ASC, year DESC`
    );
    return NextResponse.json({ data: result.rows });

  } catch (error: any) {
    console.error('Error fetching dividend breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dividend breakdown data', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new dividend breakdown record
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_symbol, year, free_cash_flow, dividends_paid, fcf_payout_ratio, adjusted_dividend, payout_ratio } = body;

    if (!stock_symbol || !year) {
      return NextResponse.json(
        { error: 'stock_symbol and year are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO dividend_breakdown 
       (stock_symbol, year, free_cash_flow, dividends_paid, fcf_payout_ratio, adjusted_dividend, payout_ratio)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (stock_symbol, year) 
       DO UPDATE SET
         free_cash_flow = EXCLUDED.free_cash_flow,
         dividends_paid = EXCLUDED.dividends_paid,
         fcf_payout_ratio = EXCLUDED.fcf_payout_ratio,
         adjusted_dividend = EXCLUDED.adjusted_dividend,
         payout_ratio = EXCLUDED.payout_ratio,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, stock_symbol, year, free_cash_flow, dividends_paid, 
                 fcf_payout_ratio, adjusted_dividend, payout_ratio, created_at, updated_at`,
      [
        stock_symbol.toUpperCase(),
        parseInt(year),
        free_cash_flow || 0,
        dividends_paid || 0,
        fcf_payout_ratio || 0,
        adjusted_dividend || 0,
        payout_ratio || 0
      ]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error creating dividend breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to create dividend breakdown record', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing dividend breakdown record
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, stock_symbol, year, free_cash_flow, dividends_paid, fcf_payout_ratio, adjusted_dividend, payout_ratio } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE dividend_breakdown 
       SET free_cash_flow = $1, dividends_paid = $2, fcf_payout_ratio = $3, 
           adjusted_dividend = $4, payout_ratio = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id, stock_symbol, year, free_cash_flow, dividends_paid, 
                 fcf_payout_ratio, adjusted_dividend, payout_ratio, created_at, updated_at`,
      [
        free_cash_flow || 0,
        dividends_paid || 0,
        fcf_payout_ratio || 0,
        adjusted_dividend || 0,
        payout_ratio || 0,
        id
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating dividend breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to update dividend breakdown record', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete dividend breakdown record
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const symbol = searchParams.get('symbol');
  const year = searchParams.get('year');

  try {
    if (id) {
      // Delete by ID
      const result = await query(
        `DELETE FROM dividend_breakdown WHERE id = $1 RETURNING id`,
        [parseInt(id)]
      );
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Record not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, deletedId: result.rows[0].id });
    } else if (symbol && year) {
      // Delete by symbol and year
      const result = await query(
        `DELETE FROM dividend_breakdown 
         WHERE stock_symbol = $1 AND year = $2 
         RETURNING id`,
        [symbol.toUpperCase(), parseInt(year)]
      );
      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Record not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Either id or (symbol and year) must be provided' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting dividend breakdown:', error);
    return NextResponse.json(
      { error: 'Failed to delete dividend breakdown record', details: error.message },
      { status: 500 }
    );
  }
}
