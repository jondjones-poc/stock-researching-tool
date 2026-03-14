import { NextResponse } from 'next/server';

// GET - Simple health check (no DB). Use /api/dcf/test-db to verify database.
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: 'share-research-app',
    timestamp: new Date().toISOString(),
  });
}
