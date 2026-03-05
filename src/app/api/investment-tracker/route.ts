import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List investment tracker entries, optionally filtered by year
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    let result;
    if (year) {
      result = await query(
        `SELECT 
          id,
          month,
          description,
          invested,
          created_at,
          updated_at
        FROM investment_tracker
        WHERE month LIKE $1 || '%'
        ORDER BY month DESC, id DESC`,
        [year]
      );
    } else {
      result = await query(
        `SELECT 
          id,
          month,
          description,
          invested,
          created_at,
          updated_at
        FROM investment_tracker
        ORDER BY month DESC, id DESC`,
        []
      );
    }

    return NextResponse.json({ data: result.rows });
  } catch (error: any) {
    console.error('Error fetching investment tracker entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment tracker entries', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new investment tracker entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, description, invested } = body;

    if (!month || invested === undefined || invested === null) {
      return NextResponse.json(
        { error: 'Month and invested amount are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO investment_tracker (month, description, invested)
       VALUES ($1, $2, $3)
       RETURNING id, month, description, invested, created_at, updated_at`,
      [month, description || null, parseFloat(invested)]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating investment tracker entry:', error);
    return NextResponse.json(
      { error: 'Failed to create investment tracker entry', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update an existing investment tracker entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, month, description, invested } = body;

    if (!id || !month || invested === undefined || invested === null) {
      return NextResponse.json(
        { error: 'ID, month, and invested amount are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE investment_tracker
       SET month = $1, description = $2, invested = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, month, description, invested, created_at, updated_at`,
      [month, description || null, parseFloat(invested), id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Investment tracker entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error: any) {
    console.error('Error updating investment tracker entry:', error);
    return NextResponse.json(
      { error: 'Failed to update investment tracker entry', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete an investment tracker entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    const result = await query(
      `DELETE FROM investment_tracker WHERE id = $1 RETURNING id`,
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Investment tracker entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Investment tracker entry deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting investment tracker entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete investment tracker entry', details: error.message },
      { status: 500 }
    );
  }
}
