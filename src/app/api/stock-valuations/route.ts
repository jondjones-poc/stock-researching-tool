import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

interface StockValuation {
  id?: number;
  stock: string;
  buy_price?: number | null;
  active_price?: number | null;
  dcf_price?: number | null;
  ddm_price?: number | null;
  reit_valuation?: number | null;
  average_valuations?: number | null;
  dividend_per_share?: number | null;
  gross_profit_pct?: number | null;
  roic?: number | null;
  long_term_earning_growth?: number | null;
  simplywall_valuation?: number | null;
  change_pct?: number | null;
  year_high?: number | null;
  year_low?: number | null;
  pe?: number | null;
  eps?: number | null;
  bear_case_avg_price?: number | null;
  bear_case_low_price?: number | null;
  bear_case_high_price?: number | null;
  base_case_avg_price?: number | null;
  base_case_low_price?: number | null;
  base_case_high_price?: number | null;
  bull_case_avg_price?: number | null;
  bull_case_low_price?: number | null;
  bull_case_high_price?: number | null;
}

// GET - Fetch stock valuation by stock symbol or ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stock = searchParams.get('stock');
    const id = searchParams.get('id');

    if (!stock && !id) {
      return NextResponse.json(
        { error: 'Either stock or id parameter is required' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await query(
        'SELECT * FROM stock_valuations WHERE id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
    } else {
      result = await query(
        'SELECT * FROM stock_valuations WHERE stock = $1 ORDER BY created_at DESC LIMIT 1',
        [stock?.toUpperCase()]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No stock valuation found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    
    // Convert database row to StockValuation format
    const stockValuation: StockValuation = {
      id: row.id,
      stock: row.stock,
      buy_price: row.buy_price ? parseFloat(row.buy_price) : null,
      active_price: row.active_price ? parseFloat(row.active_price) : null,
      dcf_price: row.dcf_price ? parseFloat(row.dcf_price) : null,
      ddm_price: row.ddm_price ? parseFloat(row.ddm_price) : null,
      reit_valuation: row.reit_valuation ? parseFloat(row.reit_valuation) : null,
      average_valuations: row.average_valuations ? parseFloat(row.average_valuations) : null,
      dividend_per_share: row.dividend_per_share ? parseFloat(row.dividend_per_share) : null,
      gross_profit_pct: row.gross_profit_pct ? parseFloat(row.gross_profit_pct) : null,
      roic: row.roic ? parseFloat(row.roic) : null,
      long_term_earning_growth: row.long_term_earning_growth ? parseFloat(row.long_term_earning_growth) : null,
      simplywall_valuation: row.simplywall_valuation ? parseFloat(row.simplywall_valuation) : null,
      change_pct: row.change_pct ? parseFloat(row.change_pct) : null,
      year_high: row.year_high ? parseFloat(row.year_high) : null,
      year_low: row.year_low ? parseFloat(row.year_low) : null,
      pe: row.pe ? parseFloat(row.pe) : null,
      eps: row.eps ? parseFloat(row.eps) : null,
      bear_case_avg_price: row.bear_case_avg_price ? parseFloat(row.bear_case_avg_price) : null,
      bear_case_low_price: row.bear_case_low_price ? parseFloat(row.bear_case_low_price) : null,
      bear_case_high_price: row.bear_case_high_price ? parseFloat(row.bear_case_high_price) : null,
      base_case_avg_price: row.base_case_avg_price ? parseFloat(row.base_case_avg_price) : null,
      base_case_low_price: row.base_case_low_price ? parseFloat(row.base_case_low_price) : null,
      base_case_high_price: row.base_case_high_price ? parseFloat(row.base_case_high_price) : null,
      bull_case_avg_price: row.bull_case_avg_price ? parseFloat(row.bull_case_avg_price) : null,
      bull_case_low_price: row.bull_case_low_price ? parseFloat(row.bull_case_low_price) : null,
      bull_case_high_price: row.bull_case_high_price ? parseFloat(row.bull_case_high_price) : null,
    };

    return NextResponse.json({ data: stockValuation, id: row.id });
  } catch (error: any) {
    console.error('Error fetching stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock valuation', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new stock valuation
export async function POST(request: NextRequest) {
  try {
    const body: StockValuation = await request.json();

    // Validate required fields
    if (!body.stock) {
      return NextResponse.json(
        { error: 'Stock symbol is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO stock_valuations (
        stock, buy_price, active_price, dcf_price, ddm_price, reit_valuation,
        average_valuations, dividend_per_share, gross_profit_pct, roic,
        long_term_earning_growth, simplywall_valuation, change_pct,
        year_high, year_low, pe, eps,
        bear_case_avg_price, bear_case_low_price, bear_case_high_price,
        base_case_avg_price, base_case_low_price, base_case_high_price,
        bull_case_avg_price, bull_case_low_price, bull_case_high_price
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26
      ) RETURNING id, created_at, updated_at`,
      [
        body.stock.toUpperCase(),
        body.buy_price ?? null,
        body.active_price ?? null,
        body.dcf_price ?? null,
        body.ddm_price ?? null,
        body.reit_valuation ?? null,
        body.average_valuations ?? null,
        body.dividend_per_share ?? null,
        body.gross_profit_pct ?? null,
        body.roic ?? null,
        body.long_term_earning_growth ?? null,
        body.simplywall_valuation ?? null,
        body.change_pct ?? null,
        body.year_high ?? null,
        body.year_low ?? null,
        body.pe ?? null,
        body.eps ?? null,
        body.bear_case_avg_price ?? null,
        body.bear_case_low_price ?? null,
        body.bear_case_high_price ?? null,
        body.base_case_avg_price ?? null,
        body.base_case_low_price ?? null,
        body.base_case_high_price ?? null,
        body.bull_case_avg_price ?? null,
        body.bull_case_low_price ?? null,
        body.bull_case_high_price ?? null,
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (error: any) {
    console.error('Error creating stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to create stock valuation', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing stock valuation
export async function PUT(request: NextRequest) {
  try {
    const body: StockValuation & { id?: number } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id?.toString();

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required for update' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE stock_valuations SET
        stock = $1, buy_price = $2, active_price = $3, dcf_price = $4,
        ddm_price = $5, reit_valuation = $6, average_valuations = $7,
        dividend_per_share = $8, gross_profit_pct = $9, roic = $10,
        long_term_earning_growth = $11, simplywall_valuation = $12, change_pct = $13,
        year_high = $14, year_low = $15, pe = $16, eps = $17,
        bear_case_avg_price = $18, bear_case_low_price = $19, bear_case_high_price = $20,
        base_case_avg_price = $21, base_case_low_price = $22, base_case_high_price = $23,
        bull_case_avg_price = $24, bull_case_low_price = $25, bull_case_high_price = $26,
        updated_at = NOW()
      WHERE id = $27
      RETURNING id, updated_at`,
      [
        body.stock?.toUpperCase() || null,
        body.buy_price ?? null,
        body.active_price ?? null,
        body.dcf_price ?? null,
        body.ddm_price ?? null,
        body.reit_valuation ?? null,
        body.average_valuations ?? null,
        body.dividend_per_share ?? null,
        body.gross_profit_pct ?? null,
        body.roic ?? null,
        body.long_term_earning_growth ?? null,
        body.simplywall_valuation ?? null,
        body.change_pct ?? null,
        body.year_high ?? null,
        body.year_low ?? null,
        body.pe ?? null,
        body.eps ?? null,
        body.bear_case_avg_price ?? null,
        body.bear_case_low_price ?? null,
        body.bear_case_high_price ?? null,
        body.base_case_avg_price ?? null,
        body.base_case_low_price ?? null,
        body.base_case_high_price ?? null,
        body.bull_case_avg_price ?? null,
        body.bull_case_low_price ?? null,
        body.bull_case_high_price ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Stock valuation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error: any) {
    console.error('Error updating stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to update stock valuation', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete stock valuation by ID
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      );
    }

    const result = await query('DELETE FROM stock_valuations WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Stock valuation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting stock valuation:', error);
    return NextResponse.json(
      { error: 'Failed to delete stock valuation', details: error.message },
      { status: 500 }
    );
  }
}
