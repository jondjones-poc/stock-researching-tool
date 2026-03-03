import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List income entries, optionally filtered by year
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    let result;
    if (year) {
      result = await query(
        `SELECT 
          ie.id,
          ie.income_source_id,
          ie.add_date,
          ie.price,
          ins.name as income_source_name,
          ins.income_type_id,
          ins.account_id,
          it.name as income_type_name,
          EXTRACT(YEAR FROM ie.add_date) as year,
          EXTRACT(MONTH FROM ie.add_date) as month,
          -- Get current month account balance
          (SELECT ab.balance 
           FROM account_balances ab 
           WHERE ab.account_id = ins.account_id 
           AND EXTRACT(YEAR FROM ab.balance_date) = EXTRACT(YEAR FROM ie.add_date)
           AND EXTRACT(MONTH FROM ab.balance_date) = EXTRACT(MONTH FROM ie.add_date)
           ORDER BY ab.balance_date DESC 
           LIMIT 1) as current_month_balance,
          -- Get previous month account balance (handle year boundaries)
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
           LIMIT 1) as previous_month_balance
        FROM income_entry ie
        JOIN income_source ins ON ie.income_source_id = ins.id
        JOIN income_type it ON ins.income_type_id = it.id
        WHERE EXTRACT(YEAR FROM ie.add_date) = $1
        ORDER BY it.id, ins.id, ie.add_date`,
        [parseInt(year)]
      );
    } else {
      result = await query(
        `SELECT 
          ie.id,
          ie.income_source_id,
          ie.add_date,
          ie.price,
          ins.name as income_source_name,
          ins.income_type_id,
          ins.account_id,
          it.name as income_type_name,
          EXTRACT(YEAR FROM ie.add_date) as year,
          EXTRACT(MONTH FROM ie.add_date) as month,
          -- Get current month account balance
          (SELECT ab.balance 
           FROM account_balances ab 
           WHERE ab.account_id = ins.account_id 
           AND EXTRACT(YEAR FROM ab.balance_date) = EXTRACT(YEAR FROM ie.add_date)
           AND EXTRACT(MONTH FROM ab.balance_date) = EXTRACT(MONTH FROM ie.add_date)
           ORDER BY ab.balance_date DESC 
           LIMIT 1) as current_month_balance,
          -- Get previous month account balance (handle year boundaries)
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
           LIMIT 1) as previous_month_balance
        FROM income_entry ie
        JOIN income_source ins ON ie.income_source_id = ins.id
        JOIN income_type it ON ins.income_type_id = it.id
        ORDER BY it.id, ins.id, ie.add_date`,
        []
      );
    }

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching income entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income entries', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new income entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.income_source_id || !body.add_date || body.price === undefined) {
      return NextResponse.json(
        { error: 'income_source_id, add_date, and price are required' },
        { status: 400 }
      );
    }

    // Check if entry already exists for this source and month
    const existing = await query(
      `SELECT id FROM income_entry 
       WHERE income_source_id = $1 
       AND EXTRACT(YEAR FROM add_date) = EXTRACT(YEAR FROM $2::date)
       AND EXTRACT(MONTH FROM add_date) = EXTRACT(MONTH FROM $2::date)`,
      [body.income_source_id, body.add_date]
    );

    if (existing.rows.length > 0) {
      // Update existing entry
      const result = await query(
        `UPDATE income_entry 
         SET price = $1
         WHERE id = $2
         RETURNING id, income_source_id, add_date, price`,
        [body.price, existing.rows[0].id]
      );
      return NextResponse.json({ data: result.rows[0] }, { status: 200 });
    }

    // Create new entry
    const result = await query(
      `INSERT INTO income_entry (income_source_id, add_date, price)
       VALUES ($1, $2, $3)
       RETURNING id, income_source_id, add_date, price`,
      [body.income_source_id, body.add_date, body.price]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating income entry:', error);
    return NextResponse.json(
      { error: 'Failed to create income entry', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update income entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || body.price === undefined) {
      return NextResponse.json(
        { error: 'id and price are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE income_entry 
       SET price = $1, add_date = COALESCE($2, add_date)
       WHERE id = $3
       RETURNING id, income_source_id, add_date, price`,
      [body.price, body.add_date || null, body.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Income entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating income entry:', error);
    return NextResponse.json(
      { error: 'Failed to update income entry', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete income entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const result = await query(
      'DELETE FROM income_entry WHERE id = $1 RETURNING id',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Income entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting income entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete income entry', details: error.message },
      { status: 500 }
    );
  }
}
