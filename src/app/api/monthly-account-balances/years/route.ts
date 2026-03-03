import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Fetch available years from monthly_account_balances table
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT DISTINCT EXTRACT(YEAR FROM balance_date)::INTEGER as year
       FROM account_balances
       ORDER BY year DESC`
    );

    const years = result.rows.map(row => row.year).filter(year => year !== null);

    // If no years found, return current year and previous year as defaults
    if (years.length === 0) {
      const currentYear = new Date().getFullYear();
      return NextResponse.json({
        years: [currentYear, currentYear - 1]
      });
    }

    return NextResponse.json({
      years
    });
  } catch (error: any) {
    console.error('Error fetching years:', error);
    return NextResponse.json(
      { error: 'Failed to fetch years', details: error.message },
      { status: 500 }
    );
  }
}
