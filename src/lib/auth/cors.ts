import { NextResponse, type NextRequest } from 'next/server';
import { getAuthAllowedOrigins } from './config';

export function getRequestOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (origin) return origin;
  const referer = request.headers.get('referer');
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, '');
  return getAuthAllowedOrigins().some((o) => o.replace(/\/$/, '') === normalized);
}

export function applyCorsHeaders(request: NextRequest, response: NextResponse): NextResponse {
  const origin = getRequestOrigin(request);
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}

export function corsPreflightResponse(request: NextRequest): NextResponse {
  const origin = request.headers.get('origin');
  const response = new NextResponse(null, { status: 204 });
  if (origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      request.headers.get('access-control-request-headers') || 'Content-Type, Authorization'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
    response.headers.set('Vary', 'Origin');
  }
  return response;
}
