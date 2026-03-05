import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch monthly account balances, optionally filtered by year
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    let sql = `
      SELECT 
        ab.id,
        ab.account_id,
        ab.balance_date,
        ab.balance,
        a.name as account_name,
        a.investment_type_id,
        it.name as investment_type_name,
        it.colour as investment_type_colour,
        it."order" as investment_type_order,
        EXTRACT(YEAR FROM ab.balance_date)::INTEGER as year,
        EXTRACT(MONTH FROM ab.balance_date)::INTEGER as month
      FROM account_balances ab
      JOIN accounts a ON ab.account_id = a.id
      LEFT JOIN investment_type it ON a.investment_type_id = it.id
      WHERE a.is_active = TRUE
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (year) {
      sql += ` AND EXTRACT(YEAR FROM ab.balance_date) = $${paramIndex}`;
      params.push(parseInt(year));
      paramIndex++;
    }

    sql += ` ORDER BY ab.balance_date ASC, a.name ASC`;

    const result = await query(sql, params);

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        account_id: row.account_id,
        account_name: row.account_name,
        investment_type_id: row.investment_type_id,
        investment_type_name: row.investment_type_name || null,
        investment_type_colour: row.investment_type_colour || null,
        investment_type_order: row.investment_type_order !== null && row.investment_type_order !== undefined ? parseInt(String(row.investment_type_order)) : null,
        balance_date: row.balance_date,
        balance: row.balance !== null && row.balance !== undefined ? parseFloat(String(row.balance)) : null,
        year: row.year,
        month: row.month,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching monthly account balances:', error);
    return NextResponse.json(
      { error: 'Failed to fetch monthly account balances', details: error.message },
      { status: 500 }
    );
  }
}

interface AccountBalance {
  account_id: number;
  balance_date: string; // YYYY-MM-DD format
  balance: number;
}

// POST - Create or update account balances for a month
export async function POST(request: NextRequest) {
  try {
    const body: { balances: AccountBalance[] } = await request.json();
    const { balances } = body;

    if (!balances || !Array.isArray(balances) || balances.length === 0) {
      return NextResponse.json(
        { error: 'balances array is required' },
        { status: 400 }
      );
    }

    // Use a transaction to insert/update all balances
    const results = [];
    for (const balance of balances) {
      const { account_id, balance_date, balance: balanceValue } = balance;

      if (!account_id || !balance_date || balanceValue === undefined || balanceValue === null) {
        continue; // Skip invalid entries
      }

      // Validate date format
      const date = new Date(balance_date);
      if (isNaN(date.getTime())) {
        continue; // Skip invalid dates
      }

      // Use INSERT ... ON CONFLICT to upsert
      const result = await query(
        `INSERT INTO account_balances (account_id, balance_date, balance)
         VALUES ($1, $2, $3)
         ON CONFLICT (account_id, balance_date)
         DO UPDATE SET balance = $3, updated_at = CURRENT_TIMESTAMP
         RETURNING id, account_id, balance_date, balance`,
        [account_id, balance_date, balanceValue]
      );

      if (result.rows.length > 0) {
        results.push(result.rows[0]);
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error: any) {
    console.error('Error saving account balances:', error);
    return NextResponse.json(
      { error: 'Failed to save account balances', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update a single account balance
export async function PUT(request: NextRequest) {
  try {
    const body: AccountBalance & { id?: number } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id?.toString();

    const { account_id, balance_date, balance: balanceValue } = body;

    if (id) {
      // Update by ID
      if (balanceValue === undefined || balanceValue === null) {
        return NextResponse.json(
          { error: 'balance is required' },
          { status: 400 }
        );
      }

      const result = await query(
        `UPDATE account_balances 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, account_id, balance_date, balance`,
        [balanceValue, id]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Account balance not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0],
      });
    } else if (account_id && balance_date) {
      // Update by account_id and balance_date
      if (balanceValue === undefined || balanceValue === null) {
        return NextResponse.json(
          { error: 'balance is required' },
          { status: 400 }
        );
      }

      const result = await query(
        `UPDATE account_balances 
         SET balance = $1, updated_at = CURRENT_TIMESTAMP
         WHERE account_id = $2 AND balance_date = $3
         RETURNING id, account_id, balance_date, balance`,
        [balanceValue, account_id, balance_date]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Account balance not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: result.rows[0],
      });
    } else {
      return NextResponse.json(
        { error: 'Either id or (account_id and balance_date) is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error updating account balance:', error);
    return NextResponse.json(
      { error: 'Failed to update account balance', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete all account balances for a specific month and year
export async function DELETE(request: NextRequest) {
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

    // Convert month name to number
    const monthOrder = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
    const monthNum = monthOrder.indexOf(month) + 1;

    if (monthNum === 0) {
      return NextResponse.json(
        { error: 'Invalid month name' },
        { status: 400 }
      );
    }

    // Delete all entries for the specified month and year
    const deleteResult = await query(
      `DELETE FROM account_balances ab
       USING accounts a
       WHERE ab.account_id = a.id
       AND a.is_active = TRUE
       AND EXTRACT(YEAR FROM ab.balance_date) = $1
       AND EXTRACT(MONTH FROM ab.balance_date) = $2
       RETURNING ab.id`,
      [parseInt(year), monthNum]
    );

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.rows.length} entries for ${month} ${year}`,
      count: deleteResult.rows.length,
    });
  } catch (error: any) {
    console.error('Error deleting account balances:', error);
    return NextResponse.json(
      { error: 'Failed to delete account balances', details: error.message },
      { status: 500 }
    );
  }
}
