import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';
import {
  STATEMENT_TIMEZONE,
  balanceDateMatchesStatementMonth,
  monthDateRange,
  monthNameFromBalanceDate,
  monthYearKey,
  normalizeBalanceDate,
} from '@/lib/month-balance-date';
import { BALANCE_DATE_IN_MONTH_PREDICATE } from '@/lib/month-balance-date-sql';

// GET - List rows that would be deleted for a month/year (GMT), before confirming delete
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    if (!month || !year) {
      return NextResponse.json(
        { error: 'month and year are required' },
        { status: 400 }
      );
    }

    const yearNum = parseInt(year, 10);
    const range = monthDateRange(yearNum, month);
    const monthKey = monthYearKey(yearNum, month);

    if (!range || !monthKey) {
      return NextResponse.json({ error: 'Invalid month name' }, { status: 400 });
    }

    const result = await query(
      `SELECT
        ab.id,
        ab.balance_date,
        ab.balance,
        a.name AS account_name
       FROM account_balances ab
       JOIN accounts a ON ab.account_id = a.id
       WHERE a.is_active = TRUE
       AND ${BALANCE_DATE_IN_MONTH_PREDICATE}
       ORDER BY a.name ASC`,
      [range.start, range.endExclusive, monthKey]
    );

    const entries = result.rows.map((row) => {
      const balanceDate = normalizeBalanceDate(row.balance_date);
      const calendarMonth = monthNameFromBalanceDate(balanceDate);
      return {
        id: row.id,
        account_name: row.account_name,
        balance_date: balanceDate,
        balance:
          row.balance !== null && row.balance !== undefined
            ? parseFloat(String(row.balance))
            : 0,
        calendar_month: calendarMonth,
        matches_requested_month: balanceDateMatchesStatementMonth(balanceDate, yearNum, month),
      };
    });

    const mismatched = entries.filter((e) => !e.matches_requested_month);

    return NextResponse.json({
      month,
      year: yearNum,
      timezone: STATEMENT_TIMEZONE,
      date_range: range,
      expected_phrase: `DELETE ${month} ${yearNum}`,
      entries,
      count: entries.length,
      warnings:
        mismatched.length > 0
          ? [`${mismatched.length} row(s) did not match the requested calendar month and would not be deleted.`]
          : [],
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error loading delete preview:', error);
    return NextResponse.json(
      { error: 'Failed to load delete preview', details: message },
      { status: 500 }
    );
  }
}
