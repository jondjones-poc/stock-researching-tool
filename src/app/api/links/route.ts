import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

interface Link {
  id?: number;
  link: string;
  date_added?: string;
  stock_valuations_id: number;
}

// GET - Fetch links by stock_valuations_id
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const stock_valuations_id = searchParams.get('stock_valuations_id');
    const id = searchParams.get('id');

    if (!stock_valuations_id && !id) {
      return NextResponse.json(
        { error: 'Either stock_valuations_id or id parameter is required' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await query(
        'SELECT * FROM links WHERE id = $1 ORDER BY date_added DESC',
        [id]
      );
    } else {
      result = await query(
        'SELECT * FROM links WHERE stock_valuations_id = $1 ORDER BY date_added DESC',
        [stock_valuations_id]
      );
    }

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        link: row.link,
        date_added: row.date_added,
        stock_valuations_id: row.stock_valuations_id,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create new link
export async function POST(request: NextRequest) {
  try {
    const body: Link = await request.json();

    // Validate required fields
    if (!body.link || !body.stock_valuations_id) {
      return NextResponse.json(
        { error: 'Link and stock_valuations_id are required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.link);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO links (link, stock_valuations_id, date_added)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       RETURNING id, link, date_added, stock_valuations_id`,
      [body.link, body.stock_valuations_id]
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        link: result.rows[0].link,
        date_added: result.rows[0].date_added,
        stock_valuations_id: result.rows[0].stock_valuations_id,
      },
    });
  } catch (error: any) {
    console.error('Error creating link:', error);
    return NextResponse.json(
      { error: 'Failed to create link', details: error.message },
      { status: 500 }
    );
  }
}

// PUT - Update existing link
export async function PUT(request: NextRequest) {
  try {
    const body: Link & { id?: number } = await request.json();
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id') || body.id?.toString();

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required for update' },
        { status: 400 }
      );
    }

    if (!body.link) {
      return NextResponse.json(
        { error: 'Link is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(body.link);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE links SET link = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, link, date_added, stock_valuations_id`,
      [body.link, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: result.rows[0].id,
        link: result.rows[0].link,
        date_added: result.rows[0].date_added,
        stock_valuations_id: result.rows[0].stock_valuations_id,
      },
    });
  } catch (error: any) {
    console.error('Error updating link:', error);
    return NextResponse.json(
      { error: 'Failed to update link', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete link by ID
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID parameter is required' },
        { status: 400 }
      );
    }

    const result = await query('DELETE FROM links WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, id: result.rows[0].id });
  } catch (error: any) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link', details: error.message },
      { status: 500 }
    );
  }
}
