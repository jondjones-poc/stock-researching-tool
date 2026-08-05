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
        ins.account_id,
        it.name as income_type_name,
        it.isbusinessincome,
        a.name as account_name
      FROM income_source ins
      JOIN income_type it ON ins.income_type_id = it.id
      LEFT JOIN accounts a ON a.id = ins.account_id
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
