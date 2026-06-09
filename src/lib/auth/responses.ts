import { NextResponse } from 'next/server';
import { clearAuthCookie } from './cookies';

export function unauthorizedResponse(clearCookie = false): NextResponse {
  const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (clearCookie) clearAuthCookie(res);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export function transientAuthResponse(message?: string): NextResponse {
  return NextResponse.json(
    { transient: true, retry: true, error: message || 'Auth service temporarily unavailable' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
