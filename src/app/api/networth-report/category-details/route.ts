import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Fetch account details for a specific category and month
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');
    const month = searchParams.get('month');
    const categoryName = searchParams.get('category');

    if (!year || !month || !categoryName) {
      return NextResponse.json(
        { error: 'year, month, and category parameters are required' },
        { status: 400 }
      );
    }

    // Get accounts for this category with their balances for the specified month
    const result = await query(
      `SELECT 
        a.id as account_id,
        a.name as account_name,
        it.name as investment_type_name,
        ab.balance
      FROM accounts a
      JOIN investment_type it ON a.investment_type_id = it.id
      JOIN investment_categories ic ON it.category_id = ic.id
      LEFT JOIN account_balances ab ON ab.account_id = a.id 
        AND EXTRACT(YEAR FROM ab.balance_date) = $1
        AND EXTRACT(MONTH FROM ab.balance_date) = $2
      WHERE a.is_active = TRUE
        AND ic.name = $3
      ORDER BY a.name ASC`,
      [parseInt(year), parseInt(month), categoryName]
    );

    return NextResponse.json({
      data: result.rows.map(row => ({
        account_id: row.account_id,
        account_name: row.account_name,
        investment_type_name: row.investment_type_name,
        balance: row.balance !== null && row.balance !== undefined ? parseFloat(String(row.balance)) : null,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching category details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch category details', details: error.message },
      { status: 500 }
    );
  }
}
