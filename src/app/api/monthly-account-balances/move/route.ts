import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// POST - Move/change date for all entries in a month
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sourceMonth, sourceYear, targetMonth, targetYear } = body;

    if (!sourceMonth || !sourceYear || !targetMonth || !targetYear) {
      return NextResponse.json(
        { error: 'sourceMonth, sourceYear, targetMonth, and targetYear are required' },
        { status: 400 }
      );
    }

    // Convert month name to number
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const sourceMonthNum = monthOrder.indexOf(sourceMonth) + 1;
    const targetMonthNum = monthOrder.indexOf(targetMonth) + 1;

    if (sourceMonthNum === 0 || targetMonthNum === 0) {
      return NextResponse.json(
        { error: 'Invalid month name' },
        { status: 400 }
      );
    }

    // Check if entries exist for target month/year
    const checkResult = await query(
      `SELECT COUNT(*) as count
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND EXTRACT(YEAR FROM ab.balance_date) = $1
       AND EXTRACT(MONTH FROM ab.balance_date) = $2`,
      [targetYear, targetMonthNum]
    );

    const existingCount = parseInt(checkResult.rows[0].count);
    if (existingCount > 0) {
      return NextResponse.json(
        { error: `Entries already exist for ${targetMonth} ${targetYear}. Cannot move entries.` },
        { status: 400 }
      );
    }

    // Calculate new balance_date (first day of target month)
    const targetDate = new Date(targetYear, targetMonthNum - 1, 1).toISOString().split('T')[0];

    // Update all entries for source month to target month/year
    const updateResult = await query(
      `UPDATE account_balances ab
       SET balance_date = $1, updated_at = CURRENT_TIMESTAMP
       FROM accounts a
       WHERE ab.account_id = a.id
       AND a.is_active = TRUE
       AND EXTRACT(YEAR FROM ab.balance_date) = $2
       AND EXTRACT(MONTH FROM ab.balance_date) = $3
       RETURNING ab.id, ab.account_id, ab.balance_date, ab.balance`,
      [targetDate, sourceYear, sourceMonthNum]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully moved ${updateResult.rows.length} entries from ${sourceMonth} ${sourceYear} to ${targetMonth} ${targetYear}`,
      count: updateResult.rows.length,
    });
  } catch (error: any) {
    console.error('Error moving account balances:', error);
    return NextResponse.json(
      { error: 'Failed to move account balances', details: error.message },
      { status: 500 }
    );
  }
}
