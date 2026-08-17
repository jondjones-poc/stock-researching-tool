import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

/** GET — list salary history (newest first). Optional ?year=&month= for one row. */
export async function GET(request: NextRequest) {
  try {
    const year = request.nextUrl.searchParams.get('year');
    const month = request.nextUrl.searchParams.get('month');

    if (year && month) {
      const result = await query(
        `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
         FROM salary_history
         WHERE year = $1 AND month = $2`,
        [parseInt(year, 10), parseInt(month, 10)]
      );
      return NextResponse.json({ data: result.rows[0] ?? null });
    }

    const result = await query(
      `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
       FROM salary_history
       ORDER BY year DESC, month DESC`
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

/** POST — upsert monthly salary for a calendar month. */
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
       ON CONFLICT (year, month) DO UPDATE SET
         monthly_salary = EXCLUDED.monthly_salary,
         notes = COALESCE(EXCLUDED.notes, salary_history.notes),
         updated_at = NOW()
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
