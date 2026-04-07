import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch investment type categories
// Query params:
//   - investment_type_id: Get all categories for a specific investment type
//   - category_name: Get all investment types for a specific category
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const investmentTypeId = searchParams.get('investment_type_id');
    const categoryName = searchParams.get('category_name');

    let sql = '';
    const params: any[] = [];
    const paramIndex = 1;

    if (investmentTypeId) {
      // Get all categories for an investment type
      sql = `
        SELECT 
          itc.id,
          itc.investment_type_id,
          itc.category_name,
          it.id as investment_type_id,
          it.name as investment_type_name,
          it.colour as investment_type_colour,
          it."order" as investment_type_order,
          itc.created_at,
          itc.updated_at
        FROM investment_type_categories itc
        JOIN investment_type it ON itc.investment_type_id = it.id
        WHERE itc.investment_type_id = $1
        ORDER BY itc.category_name ASC
      `;
      params.push(parseInt(investmentTypeId));
    } else if (categoryName) {
      // Get all investment types for a category
      sql = `
        SELECT 
          itc.id,
          itc.investment_type_id,
          itc.category_name,
          it.id as investment_type_id,
          it.name as investment_type_name,
          it.colour as investment_type_colour,
          it."order" as investment_type_order,
          itc.created_at,
          itc.updated_at
        FROM investment_type_categories itc
        JOIN investment_type it ON itc.investment_type_id = it.id
        WHERE itc.category_name = $1
        ORDER BY it."order" ASC, it.name ASC
      `;
      params.push(categoryName);
    } else {
      // Get all relationships
      sql = `
        SELECT 
          itc.id,
          itc.investment_type_id,
          itc.category_name,
          it.id as investment_type_id,
          it.name as investment_type_name,
          it.colour as investment_type_colour,
          it."order" as investment_type_order,
          itc.created_at,
          itc.updated_at
        FROM investment_type_categories itc
        JOIN investment_type it ON itc.investment_type_id = it.id
        ORDER BY it."order" ASC, it.name ASC, itc.category_name ASC
      `;
    }

    const result = await query(sql, params);

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        investment_type_id: row.investment_type_id,
        category_name: row.category_name,
        investment_type: {
          id: row.investment_type_id,
          name: row.investment_type_name,
          colour: row.investment_type_colour,
          order: row.investment_type_order,
        },
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching investment type categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch investment type categories', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Create a new link between investment type and category
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { investment_type_id, category_name } = body;

    if (!investment_type_id || !category_name) {
      return NextResponse.json(
        { error: 'investment_type_id and category_name are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO investment_type_categories (investment_type_id, category_name)
       VALUES ($1, $2)
       ON CONFLICT (investment_type_id, category_name) DO NOTHING
       RETURNING id, investment_type_id, category_name, created_at, updated_at`,
      [investment_type_id, category_name]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Link already exists or failed to create' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error creating investment type category link:', error);
    return NextResponse.json(
      { error: 'Failed to create link', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove a link between investment type and category
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const investmentTypeId = searchParams.get('investment_type_id');
    const categoryName = searchParams.get('category_name');

    if (id) {
      const result = await query(
        `DELETE FROM investment_type_categories WHERE id = $1 RETURNING id`,
        [parseInt(id)]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Link not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } else if (investmentTypeId && categoryName) {
      const result = await query(
        `DELETE FROM investment_type_categories 
         WHERE investment_type_id = $1 AND category_name = $2 
         RETURNING id`,
        [parseInt(investmentTypeId), categoryName]
      );

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Link not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Either id or (investment_type_id and category_name) is required' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error deleting investment type category link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link', details: error.message },
      { status: 500 }
    );
  }
}
