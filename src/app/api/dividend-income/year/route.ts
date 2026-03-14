import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Total dividend income for a year (from income_entry where income_type name matches 'dividend')
// Query param: year (default current year)
export async function GET(request: NextRequest) {
  try {
    const yearParam = request.nextUrl.searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (!Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    const result = await query(
      `SELECT 
        ie.id,
        ie.add_date,
        ie.price,
        ins.account_id,
        (SELECT ab.balance 
         FROM account_balances ab 
         WHERE ab.account_id = ins.account_id 
         AND EXTRACT(YEAR FROM ab.balance_date) = $1
         AND EXTRACT(MONTH FROM ab.balance_date) = EXTRACT(MONTH FROM ie.add_date)
         ORDER BY ab.balance_date DESC 
         LIMIT 1) AS current_month_balance,
        (SELECT ab.balance 
         FROM account_balances ab 
         WHERE ab.account_id = ins.account_id 
         AND (
           (EXTRACT(MONTH FROM ie.add_date) > 1 
            AND EXTRACT(YEAR FROM ab.balance_date) = $1
            AND EXTRACT(MONTH FROM ab.balance_date) = EXTRACT(MONTH FROM ie.add_date) - 1)
           OR
           (EXTRACT(MONTH FROM ie.add_date) = 1 
            AND EXTRACT(YEAR FROM ab.balance_date) = $1 - 1
            AND EXTRACT(MONTH FROM ab.balance_date) = 12)
         )
         ORDER BY ab.balance_date DESC 
         LIMIT 1) AS previous_month_balance
       FROM income_entry ie
       JOIN income_source ins ON ie.income_source_id = ins.id
       JOIN income_type it ON ins.income_type_id = it.id
       WHERE EXTRACT(YEAR FROM ie.add_date) = $1
         AND LOWER(TRIM(it.name)) LIKE '%dividend%'
       ORDER BY ie.add_date ASC`,
      [year]
    );

    const rows = result.rows || [];
    let total = 0;
    rows.forEach((row: Record<string, unknown>) => {
      let amount = parseFloat(String(row.price ?? 0));
      if (
        row.account_id != null &&
        row.current_month_balance != null &&
        row.previous_month_balance != null
      ) {
        const curr = parseFloat(String(row.current_month_balance));
        const prev = parseFloat(String(row.previous_month_balance));
        if (Number.isFinite(curr) && Number.isFinite(prev)) {
          amount = curr - prev;
        }
      }
      total += Number.isFinite(amount) ? amount : 0;
    });

    return NextResponse.json({ year, total: Number(total.toFixed(2)) });
  } catch (error: unknown) {
    console.error('Error fetching dividend income for year:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch dividend income',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
