import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

// GET - Test database connection directly
export async function GET(_request: NextRequest) {
  let pool: Pool | null = null;
  
  try {
    const supabasePassword = process.env.SUPABASE_DB_PASSWORD;
    
    if (!supabasePassword) {
      return NextResponse.json({
        error: 'SUPABASE_DB_PASSWORD is not set',
        passwordSet: false
      }, { status: 500 });
    }

    const encodedPassword = encodeURIComponent(supabasePassword);
    const projectRef = 'wnazcizhbqjxvbyffyhp';
    const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;

    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      connectionTimeoutMillis: 10000,
    });

    // Try to connect
    const client = await pool.connect();
    
    try {
      const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
      const row = result.rows[0];
      
      return NextResponse.json({
        success: true,
        connected: true,
        currentTime: row.current_time,
        pgVersion: row.pg_version.substring(0, 50) + '...',
        message: 'Database connection successful'
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Database connection test error:', error);
    let hint = 'Check database connection settings';
    if (error.code === 'ECONNREFUSED') {
      hint = 'Connection refused. Common causes: 1) Database is PAUSED in Supabase dashboard (most common) - go to Settings → Database and resume it, 2) Try using connection pooler instead of direct connection, 3) Check if database host is correct';
    } else if (error.code === 'ETIMEDOUT') {
      hint = 'Connection timeout - check network/firewall settings';
    } else if (error.code === '28P01') {
      hint = 'Password authentication failed - check SUPABASE_DB_PASSWORD';
    }

    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message,
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      hint: hint,
      troubleshooting: {
        step1: 'Check Supabase dashboard → Settings → Database → Status (should be "Active", not "Paused")',
        step2: 'If paused, click "Resume" to activate the database',
        step3: 'Verify connection string in Supabase dashboard matches: db.wnazcizhbqjxvbyffyhp.supabase.co:5432',
        step4: 'If still failing, try connection pooler (port 6543) instead of direct connection (port 5432)'
      }
    }, { status: 500 });
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}
