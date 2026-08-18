import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

/** GET — list salary history (newest first). Optional ?year=&month= for that month's payments. */
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get('year');
    const month = request.nextUrl.searchParams.get('month');

    if (year && month) {
      const result = await query(
        `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
         FROM salary_history
         WHERE year = $1 AND month = $2
         ORDER BY id ASC`,
        [parseInt(year, 10), parseInt(month, 10)]
      );
      return NextResponse.json({ data: result.rows });
    }

    const result = await query(
      `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
       FROM salary_history
       ORDER BY year DESC, month DESC, id ASC`
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: unknown) {
    console.error('salary-history GET failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load salary history' },
      { status: 500 }
    );
  }
}

/** POST — add a salary payment for a calendar month (multiple per month allowed). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const year = parseInt(String(body.year), 10);
    const month = parseInt(String(body.month), 10);
    const monthlySalary = parseFloat(String(body.monthly_salary));
    const notes = body.notes != null ? String(body.notes) : null;

    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: 'Valid year and month (1–12) are required' }, { status: 400 });
    }
    if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
      return NextResponse.json({ error: 'monthly_salary must be a non-negative number' }, { status: 400 });
    }

    const result = await query(
      `INSERT INTO salary_history (year, month, monthly_salary, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, year, month, monthly_salary, notes, created_at, updated_at`,
      [year, month, monthlySalary, notes]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: unknown) {
    console.error('salary-history POST failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save salary' },
      { status: 500 }
    );
  }
}

/** PUT — update an existing salary row (amount and/or year-month). */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = parseInt(String(body.id), 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const year =
      body.year != null ? parseInt(String(body.year), 10) : null;
    const month =
      body.month != null ? parseInt(String(body.month), 10) : null;
    const monthlySalary =
      body.monthly_salary != null ? parseFloat(String(body.monthly_salary)) : null;

    if (year != null && !Number.isFinite(year)) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }
    if (month != null && (!Number.isFinite(month) || month < 1 || month > 12)) {
      return NextResponse.json({ error: 'Month must be 1–12' }, { status: 400 });
    }
    if (monthlySalary != null && (!Number.isFinite(monthlySalary) || monthlySalary < 0)) {
      return NextResponse.json({ error: 'monthly_salary must be a non-negative number' }, { status: 400 });
    }

    const existing = await query(`SELECT id FROM salary_history WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 });
    }

    const result = await query(
      `UPDATE salary_history SET
         year = COALESCE($2, year),
         month = COALESCE($3, month),
         monthly_salary = COALESCE($4, monthly_salary),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, year, month, monthly_salary, notes, created_at, updated_at`,
      [id, year, month, monthlySalary]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: unknown) {
    console.error('salary-history PUT failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update salary' },
      { status: 500 }
    );
  }
}

/** DELETE — remove a salary row by id. */
export async function DELETE(request: NextRequest) {
  try {
    const idParam = request.nextUrl.searchParams.get('id');
    const id = parseInt(String(idParam), 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const result = await query(
      `DELETE FROM salary_history WHERE id = $1
       RETURNING id, year, month, monthly_salary`,
      [id]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Salary entry not found' }, { status: 404 });
    }
    return NextResponse.json({ data: result.rows[0] });
  } catch (error: unknown) {
    console.error('salary-history DELETE failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete salary' },
      { status: 500 }
    );
  }
}
