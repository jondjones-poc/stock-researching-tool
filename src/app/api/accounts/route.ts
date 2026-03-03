import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Fetch all active accounts with investment_type data
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT 
        a.id,
        a.name,
        a.url,
        a.is_active,
        a.investment_type_id,
        a.created_at,
        a.updated_at,
        it.name as investment_type_name,
        it.colour as investment_type_colour,
        it."order" as investment_type_order
       FROM accounts a
       LEFT JOIN investment_type it ON a.investment_type_id = it.id
       WHERE a.is_active = TRUE
       ORDER BY 
         COALESCE(it."order", 999) ASC,
         a.name ASC`
    );

    return NextResponse.json({
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        url: row.url,
        is_active: row.is_active,
        investment_type_id: row.investment_type_id,
        investment_type_name: row.investment_type_name || null,
        investment_type_colour: row.investment_type_colour || null,
        investment_type_order: row.investment_type_order !== null && row.investment_type_order !== undefined ? parseInt(String(row.investment_type_order)) : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching accounts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accounts', details: error.message },
      { status: 500 }
    );
  }
}
