import { NextRequest, NextResponse } from 'next/server';
import { readAuthCookieFromRequest } from '@/lib/auth/cookies';
import { applyCorsHeaders, corsPreflightResponse } from '@/lib/auth/cors';
import { isPublicApiRoute } from '@/lib/auth/public-routes';
import { unauthorizedResponse } from '@/lib/auth/responses';

/**
 * Edge-safe API guard: public routes pass through; protected routes require rbauth cookie.
 * Full Supabase token validation runs in Node route handlers (session, establish, etc.).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (request.method === 'OPTIONS') {
    return corsPreflightResponse(request);
  }

  if (isPublicApiRoute(pathname, request.method)) {
    return applyCorsHeaders(request, NextResponse.next());
  }

  const cookie = readAuthCookieFromRequest(request);
  if (!cookie) {
    return applyCorsHeaders(request, unauthorizedResponse(false));
  }

  return applyCorsHeaders(request, NextResponse.next());
}

export const config = {
  matcher: '/api/:path*',
};
