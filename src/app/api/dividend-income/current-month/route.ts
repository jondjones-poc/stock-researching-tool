import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Dividend income for the current month (from income_entry where income_type name matches 'dividend')
export async function GET(_request: NextRequest) {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12

    const result = await query(
      `SELECT 
        ie.id,
        ie.add_date,
        ie.price,
        ins.name AS income_source_name,
        it.name AS income_type_name,
        ins.account_id,
        (SELECT ab.balance 
         FROM account_balances ab 
         WHERE ab.account_id = ins.account_id 
         AND EXTRACT(YEAR FROM ab.balance_date) = $1
         AND EXTRACT(MONTH FROM ab.balance_date) = $2
         ORDER BY ab.balance_date DESC 
         LIMIT 1) AS current_month_balance,
        (SELECT ab.balance 
         FROM account_balances ab 
         WHERE ab.account_id = ins.account_id 
         AND (
           (EXTRACT(MONTH FROM ie.add_date) > 1 
            AND EXTRACT(YEAR FROM ab.balance_date) = EXTRACT(YEAR FROM ie.add_date)
            AND EXTRACT(MONTH FROM ab.balance_date) = EXTRACT(MONTH FROM ie.add_date) - 1)
           OR
           (EXTRACT(MONTH FROM ie.add_date) = 1 
            AND EXTRACT(YEAR FROM ab.balance_date) = EXTRACT(YEAR FROM ie.add_date) - 1
            AND EXTRACT(MONTH FROM ab.balance_date) = 12)
         )
         ORDER BY ab.balance_date DESC 
         LIMIT 1) AS previous_month_balance
       FROM income_entry ie
       JOIN income_source ins ON ie.income_source_id = ins.id
       JOIN income_type it ON ins.income_type_id = it.id
       WHERE EXTRACT(YEAR FROM ie.add_date) = $1
         AND EXTRACT(MONTH FROM ie.add_date) = $2
         AND LOWER(TRIM(it.name)) LIKE '%dividend%'
       ORDER BY ie.add_date ASC, ins.name ASC`,
      [year, month]
    );

    const rows = result.rows || [];
    const entries = rows.map((row: any) => {
      let amount = parseFloat(row.price);
      if (
        row.account_id != null &&
        row.current_month_balance != null &&
        row.previous_month_balance != null
      ) {
        const curr = parseFloat(row.current_month_balance);
        const prev = parseFloat(row.previous_month_balance);
        if (Number.isFinite(curr) && Number.isFinite(prev)) {
          amount = curr - prev;
        }
      }
      return {
        id: row.id,
        date: row.add_date,
        sourceName: row.income_source_name || '—',
        amount: Number.isFinite(amount) ? amount : 0,
      };
    });

    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    const monthName = now.toLocaleString('default', { month: 'long' });

    return NextResponse.json({
      year,
      month: monthName,
      entries,
      total,
      message: entries.length === 0
        ? `No dividend income recorded for ${monthName} ${year}. Add dividend income via Summary or income entries with a "Dividend" income type.`
        : undefined,
    });
  } catch (error: any) {
    console.error('Error fetching dividend income:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dividend income', details: error.message },
      { status: 500 }
    );
  }
}
