import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';
import { DCFData } from '../../utils/dcfData';

// GET - Fetch DCF data by symbol or ID
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const id = searchParams.get('id');

    if (!symbol && !id) {
      return NextResponse.json(
        { error: 'Either symbol or id parameter is required' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await query(
        'SELECT * FROM dcf_data WHERE id = $1 ORDER BY created_at DESC LIMIT 1',
        [id]
      );
    } else {
      result = await query(
        'SELECT * FROM dcf_data WHERE symbol = $1 ORDER BY created_at DESC LIMIT 1',
        [symbol?.toUpperCase()]
      );
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No DCF data found' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    
    // Convert database row to DCFData format
    const dcfData: DCFData = {
      symbol: row.symbol,
      stockPrice: parseFloat(row.stock_price),
      revenue: parseFloat(row.revenue),
      netIncome: parseFloat(row.net_income),
      sharesOutstanding: parseInt(row.shares_outstanding),
      currentEps: row.current_eps ? parseFloat(row.current_eps) : undefined,
      revenueGrowth: {
        bear: parseFloat(row.revenue_growth_bear),
        base: parseFloat(row.revenue_growth_base),
        bull: parseFloat(row.revenue_growth_bull),
      },
      netIncomeGrowth: {
        bear: parseFloat(row.net_income_growth_bear),
        base: parseFloat(row.net_income_growth_base),
        bull: parseFloat(row.net_income_growth_bull),
      },
      peLow: {
        bear: parseInt(row.pe_low_bear),
        base: parseInt(row.pe_low_base),
        bull: parseInt(row.pe_low_bull),
      },
      peHigh: {
        bear: parseInt(row.pe_high_bear),
        base: parseInt(row.pe_high_base),
        bull: parseInt(row.pe_high_bull),
      },
      timestamp: row.timestamp || new Date().toISOString(),
    };

    return NextResponse.json({ data: dcfData, id: row.id });
  } catch (error: any) {
    console.error('Error fetching DCF data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DCF data', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new DCF data
export async function POST(request: NextRequest) {
  try {
    const body: DCFData = await request.json();

    // Validate required fields
    if (!body.symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO dcf_data (
        symbol, stock_price, revenue, net_income, shares_outstanding, current_eps,
        revenue_growth_bear, revenue_growth_base, revenue_growth_bull,
        net_income_growth_bear, net_income_growth_base, net_income_growth_bull,
        pe_low_bear, pe_low_base, pe_low_bull,
        pe_high_bear, pe_high_base, pe_high_bull,
        timestamp
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING id, created_at, updated_at`,
      [
        body.symbol.toUpperCase(),
        body.stockPrice || 0,
        body.revenue || 0,
        body.netIncome || 0,
        body.sharesOutstanding || 50000000,
        body.currentEps || null,
        body.revenueGrowth?.bear || 0,
        body.revenueGrowth?.base || 0,
        body.revenueGrowth?.bull || 0,
        body.netIncomeGrowth?.bear || 0,
        body.netIncomeGrowth?.base || 0,
        body.netIncomeGrowth?.bull || 0,
        body.peLow?.bear || 0,
        body.peLow?.base || 0,
        body.peLow?.bull || 0,
        body.peHigh?.bear || 0,
        body.peHigh?.base || 0,
        body.peHigh?.bull || 0,
        body.timestamp || new Date().toISOString(),
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      created_at: result.rows[0].created_at,
    });
  } catch (error: any) {
    console.error('Error creating DCF data:', error);
    return NextResponse.json(
      { error: 'Failed to create DCF data', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing DCF data
export async function PUT(request: NextRequest) {
  try {
    const body: DCFData & { id?: string } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id;

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required for update' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE dcf_data SET
        symbol = $1, stock_price = $2, revenue = $3, net_income = $4,
        shares_outstanding = $5, current_eps = $6,
        revenue_growth_bear = $7, revenue_growth_base = $8, revenue_growth_bull = $9,
        net_income_growth_bear = $10, net_income_growth_base = $11, net_income_growth_bull = $12,
        pe_low_bear = $13, pe_low_base = $14, pe_low_bull = $15,
        pe_high_bear = $16, pe_high_base = $17, pe_high_bull = $18,
        timestamp = $19, updated_at = NOW()
      WHERE id = $20
      RETURNING id, updated_at`,
      [
        body.symbol?.toUpperCase() || null,
        body.stockPrice || 0,
        body.revenue || 0,
        body.netIncome || 0,
        body.sharesOutstanding || 50000000,
        body.currentEps || null,
        body.revenueGrowth?.bear || 0,
        body.revenueGrowth?.base || 0,
        body.revenueGrowth?.bull || 0,
        body.netIncomeGrowth?.bear || 0,
        body.netIncomeGrowth?.base || 0,
        body.netIncomeGrowth?.bull || 0,
        body.peLow?.bear || 0,
        body.peLow?.base || 0,
        body.peLow?.bull || 0,
        body.peHigh?.bear || 0,
        body.peHigh?.base || 0,
        body.peHigh?.bull || 0,
        body.timestamp || new Date().toISOString(),
        id,
      ]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'DCF data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      updated_at: result.rows[0].updated_at,
    });
  } catch (error: any) {
    console.error('Error updating DCF data:', error);
    return NextResponse.json(
      { error: 'Failed to update DCF data', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete DCF data by ID
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

    const result = await query('DELETE FROM dcf_data WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'DCF data not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting DCF data:', error);
    return NextResponse.json(
      { error: 'Failed to delete DCF data', details: error.message },
      { status: 500 }
    );
  }
}
