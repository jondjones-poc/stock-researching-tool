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
    // Use UTC to avoid timezone issues that could shift the date to the previous month
    const targetDate = `${targetYear}-${String(targetMonthNum).padStart(2, '0')}-01`;

    // First, get all entries that will be moved (for counting and verification)
    const getSourceEntries = await query(
      `SELECT ab.id, ab.account_id, ab.balance_date, ab.balance
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND EXTRACT(YEAR FROM ab.balance_date) = $1
       AND EXTRACT(MONTH FROM ab.balance_date) = $2`,
      [sourceYear, sourceMonthNum]
    );

    const entriesToMove = getSourceEntries.rows;
    if (entriesToMove.length === 0) {
      return NextResponse.json(
        { error: `No entries found for ${sourceMonth} ${sourceYear}` },
        { status: 404 }
      );
    }

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

    // Verify that all entries were updated successfully
    if (updateResult.rows.length !== entriesToMove.length) {
      return NextResponse.json(
        { error: `Failed to move all entries. Expected ${entriesToMove.length}, moved ${updateResult.rows.length}` },
        { status: 500 }
      );
    }

    // After successful update, verify the old entries are gone (they should be since we updated their dates)
    // Double-check by querying for any remaining entries in the source month
    const verifyDeletion = await query(
      `SELECT COUNT(*) as count
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND EXTRACT(YEAR FROM ab.balance_date) = $1
       AND EXTRACT(MONTH FROM ab.balance_date) = $2`,
      [sourceYear, sourceMonthNum]
    );

    const remainingCount = parseInt(verifyDeletion.rows[0].count);
    if (remainingCount > 0) {
      // If there are still entries in the source month after UPDATE, explicitly delete them
      // This handles edge cases where the UPDATE might not have matched all rows
      const deleteResult = await query(
        `DELETE FROM account_balances ab
         USING accounts a
         WHERE ab.account_id = a.id
         AND a.is_active = TRUE
         AND EXTRACT(YEAR FROM ab.balance_date) = $1
         AND EXTRACT(MONTH FROM ab.balance_date) = $2
         RETURNING ab.id`,
        [sourceYear, sourceMonthNum]
      );
      console.log(`Deleted ${deleteResult.rows.length} remaining entries from ${sourceMonth} ${sourceYear} after move operation`);
    }

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
