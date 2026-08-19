import { NextResponse } from 'next/server';
import { query } from '../../utils/db';

export async function GET() {
  try {
    const result = await query(
      `SELECT id, slug, name, sort_order, is_default
       FROM portfolios
       ORDER BY sort_order ASC, id ASC`
    );
    return NextResponse.json({ data: result.rows });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'portfolios table does not exist',
          hint: 'Run node scripts/apply-named-portfolios.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to load portfolios', details: err.message },
      { status: 500 }
    );
  }
}
