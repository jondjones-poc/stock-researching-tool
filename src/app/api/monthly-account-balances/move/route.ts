import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';
import { balanceDateForMonth, monthDateRange, monthYearKey } from '@/lib/month-balance-date';
import {
  BALANCE_DATE_IN_MONTH_PREDICATE,
  balanceDateInMonthPredicate,
} from '@/lib/month-balance-date-sql';

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

    const sourceYearNum = parseInt(String(sourceYear), 10);
    const targetYearNum = parseInt(String(targetYear), 10);
    const sourceRange = monthDateRange(sourceYearNum, sourceMonth);
    const targetRange = monthDateRange(targetYearNum, targetMonth);
    const sourceMonthKey = monthYearKey(sourceYearNum, sourceMonth);
    const targetMonthKey = monthYearKey(targetYearNum, targetMonth);

    if (!sourceRange || !targetRange || !sourceMonthKey || !targetMonthKey) {
      return NextResponse.json(
        { error: 'Invalid month name' },
        { status: 400 }
      );
    }

    const targetDate = balanceDateForMonth(targetYearNum, targetMonth);

    const checkResult = await query(
      `SELECT COUNT(*) as count
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND ${BALANCE_DATE_IN_MONTH_PREDICATE}`,
      [targetRange.start, targetRange.endExclusive, targetMonthKey]
    );

    const existingCount = parseInt(checkResult.rows[0].count);
    if (existingCount > 0) {
      return NextResponse.json(
        { error: `Entries already exist for ${targetMonth} ${targetYear}. Cannot move entries.` },
        { status: 400 }
      );
    }

    const getSourceEntries = await query(
      `SELECT ab.id, ab.account_id, ab.balance_date, ab.balance
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND ${BALANCE_DATE_IN_MONTH_PREDICATE}`,
      [sourceRange.start, sourceRange.endExclusive, sourceMonthKey]
    );

    const entriesToMove = getSourceEntries.rows;
    if (entriesToMove.length === 0) {
      return NextResponse.json(
        { error: `No entries found for ${sourceMonth} ${sourceYear}` },
        { status: 404 }
      );
    }

    const updateResult = await query(
      `UPDATE account_balances ab
       SET balance_date = $1, updated_at = CURRENT_TIMESTAMP
       FROM accounts a
       WHERE ab.account_id = a.id
       AND a.is_active = TRUE
       AND ${balanceDateInMonthPredicate(2)}
       RETURNING ab.id, ab.account_id, ab.balance_date, ab.balance`,
      [targetDate, sourceRange.start, sourceRange.endExclusive, sourceMonthKey]
    );

    if (updateResult.rows.length !== entriesToMove.length) {
      return NextResponse.json(
        { error: `Failed to move all entries. Expected ${entriesToMove.length}, moved ${updateResult.rows.length}` },
        { status: 500 }
      );
    }

    const verifyDeletion = await query(
      `SELECT COUNT(*) as count
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND ${BALANCE_DATE_IN_MONTH_PREDICATE}`,
      [sourceRange.start, sourceRange.endExclusive, sourceMonthKey]
    );

    const remainingCount = parseInt(verifyDeletion.rows[0].count);
    if (remainingCount > 0) {
      const deleteResult = await query(
        `DELETE FROM account_balances ab
         USING accounts a
         WHERE ab.account_id = a.id
         AND a.is_active = TRUE
         AND ${BALANCE_DATE_IN_MONTH_PREDICATE}
         RETURNING ab.id`,
        [sourceRange.start, sourceRange.endExclusive, sourceMonthKey]
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
