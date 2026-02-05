import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - List all stock valuations for dropdown
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stock = searchParams.get('stock');
    const limit = parseInt(searchParams.get('limit') || '100');

    let result;
    if (stock) {
      result = await query(
        'SELECT id, stock, buy_price, active_price, created_at FROM stock_valuations WHERE stock = $1 ORDER BY created_at DESC LIMIT $2',
        [stock.toUpperCase(), limit]
      );
    } else {
      result = await query(
        'SELECT id, stock, buy_price, active_price, created_at FROM stock_valuations ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    }

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        stock: row.stock,
        buy_price: row.buy_price ? parseFloat(row.buy_price) : null,
        active_price: row.active_price ? parseFloat(row.active_price) : null,
        created_at: row.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Error listing stock valuations:', error);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to list stock valuations';
    let hint = '';
    
    if (error.code === '42P01') {
      errorMessage = 'Table stock_valuations does not exist';
      hint = 'Please run the SQL script to create the table in Supabase';
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
