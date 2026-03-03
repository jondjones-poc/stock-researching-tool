import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List all income sources with their income types
export async function GET(_request: NextRequest) {
  try {
    const result = await query(
      `SELECT 
        ins.id, 
        ins.name, 
        ins.income_type_id,
        it.name as income_type_name
      FROM income_source ins
      JOIN income_type it ON ins.income_type_id = it.id
      ORDER BY it.id, ins.id`,
      []
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching income sources:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income sources', details: error.message },
      { status: 500 }
    );
  }
}
