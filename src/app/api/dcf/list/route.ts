import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - List all DCF data entries (with optional symbol filter)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const limit = parseInt(searchParams.get('limit') || '50');

    let result;
    if (symbol) {
      result = await query(
        'SELECT id, symbol, stock_price, revenue, created_at, updated_at FROM dcf_data WHERE symbol = $1 ORDER BY created_at DESC LIMIT $2',
        [symbol.toUpperCase(), limit]
      );
    } else {
      result = await query(
        'SELECT id, symbol, stock_price, revenue, created_at, updated_at FROM dcf_data ORDER BY created_at DESC LIMIT $1',
        [limit]
      );
    }

    return NextResponse.json({ data: result.rows, count: result.rows.length });
  } catch (error: any) {
    console.error('Error listing DCF data:', error);
    const errorMessage = error.message || 'Unknown error';
    const errorCode = error.code || 'UNKNOWN';
    
    let hint = 'Check database connection settings';
    if (errorMessage.includes('password') || errorCode === '28P01') {
      hint = 'Check SUPABASE_DB_PASSWORD environment variable';
    } else if (errorMessage.includes('ECONNREFUSED') || errorCode === 'ECONNREFUSED') {
      hint = 'Connection refused - Check: 1) Database is active (not paused) in Supabase, 2) IP restrictions, 3) Try connection pooler instead';
    } else if (errorMessage.includes('ETIMEDOUT') || errorCode === 'ETIMEDOUT') {
      hint = 'Connection timeout - Check network/firewall settings';
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to list DCF data', 
        details: errorMessage,
        code: errorCode,
        hint: hint
      },
      { status: 500 }
    );
  }
}
