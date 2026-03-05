import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// PUT - Update settings by key (upsert - insert if doesn't exist, update if exists)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.key || body.value === undefined) {
      return NextResponse.json(
        { error: 'key and value are required' },
        { status: 400 }
      );
    }

    // Use INSERT ... ON CONFLICT to upsert
    const result = await query(
      `INSERT INTO settings (key, value, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) 
       DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP
       RETURNING id, key, value, created_at, updated_at`,
      [body.key, body.value || null]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating setting by key:', error);
    return NextResponse.json(
      { error: 'Failed to update setting', details: error.message },
      { status: 500 }
    );
  }
}
