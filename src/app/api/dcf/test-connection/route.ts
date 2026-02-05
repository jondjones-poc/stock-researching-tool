import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '../../../utils/db';

// GET - Test database connection
export async function GET(_request: NextRequest) {
  try {
    const password = process.env.SUPABASE_DB_PASSWORD;
    const connectionString = `postgresql://postgres:${encodeURIComponent(
      password || ''
    )}@db.wnazcizhbqjxvbyffyhp.supabase.co:5432/postgres`;

    return NextResponse.json({
      passwordSet: !!password,
      passwordLength: password?.length || 0,
      connectionString: connectionString.replace(/:[^:@]+@/, ':****@'),
      message: 'Connection details (password hidden)'
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      passwordSet: !!process.env.SUPABASE_DB_PASSWORD
    }, { status: 500 });
  }
}
