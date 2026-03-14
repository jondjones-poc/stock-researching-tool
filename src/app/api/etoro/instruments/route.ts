import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Get instrument symbol by ID, or get all mappings
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const instrumentId = searchParams.get('instrumentId');
  const action = searchParams.get('action'); // 'all' to get all mappings

  try {
    if (action === 'all') {
      const result = await query(
        `SELECT instrument_id, symbol, name 
         FROM etoro_instruments 
         ORDER BY instrument_id ASC`
      );
      return NextResponse.json({ 
        instruments: result.rows.map(row => ({
          instrumentId: row.instrument_id,
          symbol: row.symbol,
          name: row.name
        }))
      });
    }

    if (instrumentId) {
      const result = await query(
        `SELECT instrument_id, symbol, name 
         FROM etoro_instruments 
         WHERE instrument_id = $1`,
        [parseInt(instrumentId)]
      );
      
      if (result.rows.length === 0) {
        return NextResponse.json({ 
          instrumentId: parseInt(instrumentId),
          symbol: null,
          name: null
        });
      }
      
      return NextResponse.json({
        instrumentId: result.rows[0].instrument_id,
        symbol: result.rows[0].symbol,
        name: result.rows[0].name
      });
    }

    return NextResponse.json({ error: 'instrumentId parameter or action=all is required' }, { status: 400 });
  } catch (error: any) {
    console.error('Error fetching instrument mapping:', error);
    return NextResponse.json(
      { error: 'Failed to fetch instrument mapping', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create or update instrument mapping
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instrumentId, symbol, name } = body;

    if (!instrumentId || !symbol) {
      return NextResponse.json(
        { error: 'instrumentId and symbol are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO etoro_instruments (instrument_id, symbol, name, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (instrument_id) 
       DO UPDATE SET 
         symbol = EXCLUDED.symbol,
         name = EXCLUDED.name,
         updated_at = CURRENT_TIMESTAMP
       RETURNING instrument_id, symbol, name, created_at, updated_at`,
      [parseInt(instrumentId), symbol.toUpperCase(), name || null]
    );

    return NextResponse.json({
      success: true,
      instrument: {
        instrumentId: result.rows[0].instrument_id,
        symbol: result.rows[0].symbol,
        name: result.rows[0].name,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at
      }
    });
  } catch (error: any) {
    console.error('Error creating/updating instrument mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create/update instrument mapping', details: error.message },
      { status: 500 }
    );
  }
}
