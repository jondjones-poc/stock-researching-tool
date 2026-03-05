import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../utils/db';

// GET - Get available years from investment tracker
export async function GET(request: NextRequest) {
  try {
    const result = await query(
      `SELECT DISTINCT 
        CASE 
          WHEN month ~ '^[0-9]{4}' THEN SUBSTRING(month FROM 1 FOR 4)
          ELSE TO_CHAR(created_at, 'YYYY')
        END as year
      FROM investment_tracker
      ORDER BY year DESC`,
      []
    );

    const years = result.rows.map(row => parseInt(row.year)).filter(year => !isNaN(year));
    
    // If no years found, return current year
    if (years.length === 0) {
      const currentYear = new Date().getFullYear();
      return NextResponse.json({ years: [currentYear] });
    }

    return NextResponse.json({ years });
  } catch (error: any) {
    console.error('Error fetching investment tracker years:', error);
    const currentYear = new Date().getFullYear();
    return NextResponse.json({ years: [currentYear, currentYear - 1] });
  }
}
