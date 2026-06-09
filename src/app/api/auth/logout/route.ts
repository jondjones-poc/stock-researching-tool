import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { clearAuthCookie, noStoreHeaders } from '@/lib/auth/cookies';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true }, { headers: noStoreHeaders() });
  clearAuthCookie(response);
  return applyCorsHeaders(request, response);
}
