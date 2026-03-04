import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List all settings
export async function GET(_request: NextRequest) {
  try {
    const result = await query(
      `SELECT id, key, value, created_at, updated_at 
       FROM settings 
       ORDER BY key ASC`,
      []
    );

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new setting
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.key) {
      return NextResponse.json(
        { error: 'key is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO settings (key, value)
       VALUES ($1, $2)
       RETURNING id, key, value, created_at, updated_at`,
      [body.key, body.value || null]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating setting:', error);
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'Setting with this key already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create setting', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update an existing setting
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id || body.key === undefined) {
      return NextResponse.json(
        { error: 'id and key are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE settings 
       SET key = $1, value = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, key, value, created_at, updated_at`,
      [body.key, body.value || null, body.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating setting:', error);
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'Setting with this key already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update setting', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete a setting
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
      `DELETE FROM settings WHERE id = $1 RETURNING id`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Setting deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting setting:', error);
    return NextResponse.json(
      { error: 'Failed to delete setting', details: error.message },
      { status: 500 }
    );
  }
}
