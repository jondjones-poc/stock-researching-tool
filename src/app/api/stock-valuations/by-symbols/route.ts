import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Get stock_valuations IDs for a list of symbols
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbols = searchParams.get('symbols');

    if (!symbols) {
      return NextResponse.json(
        { error: 'symbols parameter is required (comma-separated)' },
        { status: 400 }
      );
    }

    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    
    if (symbolList.length === 0) {
      return NextResponse.json({ data: {} });
    }

    // Use UPPER() to ensure case-insensitive matching
    const result = await query(
      `SELECT id, UPPER(stock) as stock FROM stock_valuations WHERE UPPER(stock) = ANY($1::text[])`,
      [symbolList]
    );

    // Create a mapping of symbol -> id (using uppercase for consistency)
    const mapping: { [key: string]: number } = {};
    result.rows.forEach(row => {
      const stockSymbol = (row.stock || '').toUpperCase();
      mapping[stockSymbol] = row.id;
    });

    return NextResponse.json({
      data: mapping,
    });
  } catch (error: any) {
    console.error('Error fetching stock valuations by symbols:', error);
    
    let errorMessage = 'Failed to fetch stock valuations';
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
