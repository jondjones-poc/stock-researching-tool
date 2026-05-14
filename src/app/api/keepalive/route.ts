import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

function isKeepaliveAuthorized(request: NextRequest): boolean {
  const secret = process.env.KEEPALIVE_SECRET;
  if (!secret) {
    return true;
  }
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) {
    return true;
  }
  return request.headers.get('x-keepalive-secret') === secret;
}

// GET - Light query so Supabase Postgres stays active (e.g. weekly inactivity pause).
// When KEEPALIVE_SECRET is set, require Authorization: Bearer <secret> or X-Keepalive-Secret.
export async function GET(request: NextRequest) {
  if (!isKeepaliveAuthorized(request)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
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
