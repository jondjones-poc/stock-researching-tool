import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Get available years from income entries
export async function GET(_request: NextRequest) {
  try {
    const result = await query(
      `SELECT DISTINCT EXTRACT(YEAR FROM add_date) as year
       FROM income_entry
       ORDER BY year DESC`,
      []
    );

    const years = result.rows.map((row: any) => parseInt(row.year));
    return NextResponse.json({ years });
  } catch (error: any) {
    console.error('Error fetching income entry years:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: error.message },
      { status: 500 }
    );
  }
}
