import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch all dashboard watchlist symbols from database
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get('category');
    const isActive = searchParams.get('is_active') !== 'false'; // Default to true

    let sql = `
      SELECT 
        id,
        symbol,
        name,
        category,
        icon,
        color,
        data_source,
        fred_series_id,
        notes,
        display_order,
        is_active,
        created_at,
        updated_at
      FROM dashboard_watchlist
      WHERE is_active = $1
    `;
    
    const params: any[] = [isActive];
    
    if (category && category !== 'ALL') {
      sql += ` AND category = $2`;
      params.push(category);
    }
    
    sql += ` ORDER BY category, display_order, symbol`;

    const result = await query(sql, params);

    // Transform database rows to match WatchlistSymbol interface
    const watchlistSymbols = result.rows.map(row => ({
      symbol: row.symbol,
      name: row.name,
      category: row.category,
      icon: row.icon || undefined,
      color: row.color || undefined,
      dataSource: row.data_source || undefined,
      fredSeriesId: row.fred_series_id || undefined,
    }));

    // Group by category to match the expected structure
    const grouped: { [key: string]: typeof watchlistSymbols } = {};
    watchlistSymbols.forEach(symbol => {
      if (!grouped[symbol.category]) {
        grouped[symbol.category] = [];
      }
      grouped[symbol.category].push(symbol);
    });

    return NextResponse.json({
      data: grouped,
      symbols: watchlistSymbols, // Also return flat list for convenience
    });
  } catch (error: any) {
    console.error('Error fetching dashboard watchlist:', error);
    
    let errorMessage = 'Failed to fetch dashboard watchlist';
    let hint = '';
    
    if (error.code === '42P01') {
      errorMessage = 'Table dashboard_watchlist does not exist';
      hint = 'Please run the create_dashboard_watchlist_table.sql script to create the table';
    } else if (error.code === '28P01' || error.message?.includes('password')) {
      errorMessage = 'Database authentication failed';
      hint = 'Check SUPABASE_DB_PASSWORD in .env.local';
    } else if (error.code === 'ECONNREFUSED' || error.message?.includes('connect')) {
      errorMessage = 'Database connection refused';
      hint = 'Check if the database is active and connection string is correct';
    }
    
    return NextResponse.json(
      { 
        error: errorMessage, 
        details: error.message,
        code: error.code,
        hint 
      },
      { status: 500 }
    );
  }
}

// POST - Add a new symbol to dashboard watchlist
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, name, category, icon, color, data_source, fred_series_id, notes, display_order } = body;

    if (!symbol || !name || !category) {
      return NextResponse.json(
        { error: 'symbol, name, and category are required' },
        { status: 400 }
      );
    }

    // Check if symbol already exists
    const existing = await query(
      'SELECT id FROM dashboard_watchlist WHERE symbol = $1',
      [symbol.toUpperCase()]
    );

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'Symbol already exists in watchlist' },
        { status: 409 }
      );
    }

    // Get max display_order for this category if not provided
    let order = display_order;
    if (order === undefined || order === null) {
      const maxOrderResult = await query(
        'SELECT COALESCE(MAX(display_order), 0) + 1 as next_order FROM dashboard_watchlist WHERE category = $1',
        [category]
      );
      order = maxOrderResult.rows[0].next_order;
    }

    const result = await query(
      `INSERT INTO dashboard_watchlist 
       (symbol, name, category, icon, color, data_source, fred_series_id, notes, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        symbol.toUpperCase(),
        name,
        category,
        icon || null,
        color || null,
        data_source || null,
        fred_series_id || null,
        notes || null,
        order,
        true
      ]
    );

    return NextResponse.json({
      data: result.rows[0],
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error adding dashboard watchlist symbol:', error);
    return NextResponse.json(
      { error: 'Failed to add symbol to watchlist', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a symbol from dashboard watchlist
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json(
        { error: 'symbol parameter is required' },
        { status: 400 }
      );
    }

    const result = await query(
      'DELETE FROM dashboard_watchlist WHERE symbol = $1 RETURNING *',
      [symbol.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Symbol not found in watchlist' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Symbol removed from watchlist',
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error deleting dashboard watchlist symbol:', error);
    return NextResponse.json(
      { error: 'Failed to remove symbol from watchlist', details: error.message },
      { status: 500 }
    );
  }
}
