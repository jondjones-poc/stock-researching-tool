import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

// GET - Keep database connection alive
// This endpoint can be pinged by a serverless function/cron job to prevent the database from going to sleep
export async function GET(_request: NextRequest) {
  try {
    // Perform a simple query to keep the connection active
    const result = await query('SELECT NOW() as timestamp, 1 as status');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection is active',
      timestamp: result.rows[0].timestamp,
      status: 'ok'
    }, { status: 200 });
  } catch (error: any) {
    console.error('Keepalive endpoint error:', error);
    return NextResponse.json({
      success: false,
      message: 'Database connection failed',
      error: error.message || 'Unknown error'
    }, { status: 500 });
  }
}
