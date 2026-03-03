import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - List all income types
export async function GET(_request: NextRequest) {
  try {
    // Check if hexcolour and Is247wage columns exist (check both cases)
    const columnCheck = await query(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = 'income_type' 
       AND (LOWER(column_name) = 'hexcolour' OR LOWER(column_name) = 'is247wage')`,
      []
    );

    const hasHexcolour = columnCheck.rows.some(row => row.column_name.toLowerCase() === 'hexcolour');
    const hasIs247wage = columnCheck.rows.some(row => row.column_name.toLowerCase() === 'is247wage');
    
    // Get the actual column names from the database (PostgreSQL may store them in different cases)
    const hexcolourColName = columnCheck.rows.find(row => row.column_name.toLowerCase() === 'hexcolour')?.column_name;
    const is247wageColName = columnCheck.rows.find(row => row.column_name.toLowerCase() === 'is247wage')?.column_name;
    
    const selectColumns = [
      'id',
      'name',
      ...(hasHexcolour && hexcolourColName ? [`"${hexcolourColName}"`] : []),
      ...(hasIs247wage && is247wageColName ? [`"${is247wageColName}"`] : [])
    ].join(', ');

    const result = await query(
      `SELECT ${selectColumns} FROM income_type ORDER BY id`,
      []
    );

    // Add missing columns as null if they don't exist
    // Normalize column names (PostgreSQL returns unquoted identifiers in lowercase)
    const data = result.rows.map(row => {
      const normalizedRow: any = {
        id: row.id,
        name: row.name
      };
      
      // Handle hexcolour - use the actual column name from database
      if (hasHexcolour && hexcolourColName) {
        normalizedRow.hexcolour = row[hexcolourColName] !== undefined ? row[hexcolourColName] : null;
      } else {
        normalizedRow.hexcolour = null;
      }
      
      // Handle Is247wage - use the actual column name from database
      if (hasIs247wage && is247wageColName) {
        normalizedRow.Is247wage = row[is247wageColName] !== undefined ? row[is247wageColName] : null;
      } else {
        normalizedRow.Is247wage = null;
      }
      
      return normalizedRow;
    });

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('Error fetching income types:', error);
    return NextResponse.json(
      { error: 'Failed to fetch income types', details: error.message },
      { status: 500 }
    );
  }
}
