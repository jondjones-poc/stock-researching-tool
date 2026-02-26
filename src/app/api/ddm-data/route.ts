import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List all DDM data entries or get specific one by symbol
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (symbol) {
      // Get specific stock
      const result = await query(
        `SELECT 
          id, symbol, wacc, margin_of_safety, high_growth_years, stable_growth_rate, current_price,
          dividends_by_year, current_year_projected, dividend_growth_rate, latest_dividend,
          historical_dividends, dividend_projections,
          intrinsic_value, ddm_with_safety, terminal_value,
          last_updated, created_at
        FROM ddm_data 
        WHERE symbol = $1`,
        [symbol.toUpperCase()]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: 'DDM data not found for symbol' }, { status: 404 });
      }

      const row = result.rows[0];
      return NextResponse.json({
        id: row.id,
        symbol: row.symbol,
        wacc: parseFloat(row.wacc),
        marginOfSafety: parseFloat(row.margin_of_safety),
        highGrowthYears: row.high_growth_years,
        stableGrowthRate: parseFloat(row.stable_growth_rate),
        currentPrice: row.current_price ? parseFloat(row.current_price) : null,
        dividendsByYear: row.dividends_by_year,
        currentYearProjected: row.current_year_projected,
        dividendGrowthRate: row.dividend_growth_rate ? parseFloat(row.dividend_growth_rate) : null,
        latestDividend: row.latest_dividend ? parseFloat(row.latest_dividend) : null,
        historicalDividends: row.historical_dividends,
        dividendProjections: row.dividend_projections,
        intrinsicValue: row.intrinsic_value ? parseFloat(row.intrinsic_value) : null,
        ddmWithSafety: row.ddm_with_safety ? parseFloat(row.ddm_with_safety) : null,
        terminalValue: row.terminal_value ? parseFloat(row.terminal_value) : null,
        lastUpdated: row.last_updated,
        createdAt: row.created_at
      });
    } else {
      // List all symbols
      const result = await query(
        `SELECT symbol, last_updated, created_at 
         FROM ddm_data 
         ORDER BY symbol ASC`
      );

      return NextResponse.json({
        stocks: result.rows.map(row => ({
          symbol: row.symbol,
          lastUpdated: row.last_updated,
          createdAt: row.created_at
        }))
      });
    }
  } catch (error: any) {
    console.error('Error fetching DDM data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch DDM data', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new DDM data entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    if (body.wacc === undefined || body.marginOfSafety === undefined || 
        body.highGrowthYears === undefined || body.stableGrowthRate === undefined) {
      return NextResponse.json({ 
        error: 'WACC, margin of safety, high growth years, and stable growth rate are required' 
      }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO ddm_data (
        symbol, wacc, margin_of_safety, high_growth_years, stable_growth_rate, current_price,
        dividends_by_year, current_year_projected, dividend_growth_rate, latest_dividend,
        historical_dividends, dividend_projections,
        intrinsic_value, ddm_with_safety, terminal_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, symbol, last_updated`,
      [
        body.symbol.toUpperCase(),
        body.wacc,
        body.marginOfSafety,
        body.highGrowthYears,
        body.stableGrowthRate,
        body.currentPrice || null,
        body.dividendsByYear ? JSON.stringify(body.dividendsByYear) : null,
        body.currentYearProjected || false,
        body.dividendGrowthRate || null,
        body.latestDividend || null,
        body.historicalDividends ? JSON.stringify(body.historicalDividends) : null,
        body.dividendProjections ? JSON.stringify(body.dividendProjections) : null,
        body.intrinsicValue || null,
        body.ddmWithSafety || null,
        body.terminalValue || null
      ]
    );

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      symbol: result.rows[0].symbol,
      lastUpdated: result.rows[0].last_updated
    });
  } catch (error: any) {
    console.error('Error creating DDM data:', error);
    
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'DDM data already exists for this symbol. Use PUT to update.' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create DDM data', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing DDM data entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (body.wacc !== undefined) {
      updates.push(`wacc = $${paramIndex++}`);
      values.push(body.wacc);
    }
    if (body.marginOfSafety !== undefined) {
      updates.push(`margin_of_safety = $${paramIndex++}`);
      values.push(body.marginOfSafety);
    }
    if (body.highGrowthYears !== undefined) {
      updates.push(`high_growth_years = $${paramIndex++}`);
      values.push(body.highGrowthYears);
    }
    if (body.stableGrowthRate !== undefined) {
      updates.push(`stable_growth_rate = $${paramIndex++}`);
      values.push(body.stableGrowthRate);
    }
    if (body.currentPrice !== undefined) {
      updates.push(`current_price = $${paramIndex++}`);
      values.push(body.currentPrice);
    }
    if (body.dividendsByYear !== undefined) {
      updates.push(`dividends_by_year = $${paramIndex++}`);
      values.push(JSON.stringify(body.dividendsByYear));
    }
    if (body.currentYearProjected !== undefined) {
      updates.push(`current_year_projected = $${paramIndex++}`);
      values.push(body.currentYearProjected);
    }
    if (body.dividendGrowthRate !== undefined) {
      updates.push(`dividend_growth_rate = $${paramIndex++}`);
      values.push(body.dividendGrowthRate);
    }
    if (body.latestDividend !== undefined) {
      updates.push(`latest_dividend = $${paramIndex++}`);
      values.push(body.latestDividend);
    }
    if (body.historicalDividends !== undefined) {
      updates.push(`historical_dividends = $${paramIndex++}`);
      values.push(JSON.stringify(body.historicalDividends));
    }
    if (body.dividendProjections !== undefined) {
      updates.push(`dividend_projections = $${paramIndex++}`);
      values.push(JSON.stringify(body.dividendProjections));
    }
    if (body.intrinsicValue !== undefined) {
      updates.push(`intrinsic_value = $${paramIndex++}`);
      values.push(body.intrinsicValue);
    }
    if (body.ddmWithSafety !== undefined) {
      updates.push(`ddm_with_safety = $${paramIndex++}`);
      values.push(body.ddmWithSafety);
    }
    if (body.terminalValue !== undefined) {
      updates.push(`terminal_value = $${paramIndex++}`);
      values.push(body.terminalValue);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Add symbol to values for WHERE clause
    values.push(body.symbol.toUpperCase());

    const result = await query(
      `UPDATE ddm_data 
       SET ${updates.join(', ')}, last_updated = NOW()
       WHERE symbol = $${paramIndex}
       RETURNING id, symbol, last_updated`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'DDM data not found for symbol' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      id: result.rows[0].id,
      symbol: result.rows[0].symbol,
      lastUpdated: result.rows[0].last_updated
    });
  } catch (error: any) {
    console.error('Error updating DDM data:', error);
    return NextResponse.json(
      { error: 'Failed to update DDM data', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete DDM data entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM ddm_data WHERE symbol = $1 RETURNING id, symbol`,
      [symbol.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'DDM data not found for symbol' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `DDM data deleted for ${result.rows[0].symbol}`
    });
  } catch (error: any) {
    console.error('Error deleting DDM data:', error);
    return NextResponse.json(
      { error: 'Failed to delete DDM data', details: error.message },
      { status: 500 }
    );
  }
}
