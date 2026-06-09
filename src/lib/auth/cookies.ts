import type { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE_NAME, getCookieSameSite, getSessionMaxAgeSeconds, isProduction } from './config';

export interface AuthCookiePayload {
  a: string;
  r: string;
}

export function encodeAuthCookie(payload: AuthCookiePayload): string {
  return encodeURIComponent(JSON.stringify(payload));
}

export function decodeAuthCookie(raw: string | undefined | null): AuthCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as AuthCookiePayload;
    if (parsed?.a && parsed?.r) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function readAuthCookieFromRequest(request: NextRequest): AuthCookiePayload | null {
  return decodeAuthCookie(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}

export function applyAuthCookie(response: NextResponse, payload: AuthCookiePayload): void {
  const maxAge = getSessionMaxAgeSeconds();
  response.cookies.set(AUTH_COOKIE_NAME, encodeAuthCookie(payload), {
    httpOnly: true,
    path: '/',
    maxAge,
    sameSite: getCookieSameSite(),
    secure: isProduction(),
  });
  response.headers.set('Cache-Control', 'no-store');
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    sameSite: getCookieSameSite(),
    secure: isProduction(),
  });
  response.headers.set('Cache-Control', 'no-store');
}

export function noStoreHeaders(): HeadersInit {
  return { 'Cache-Control': 'no-store' };
}
