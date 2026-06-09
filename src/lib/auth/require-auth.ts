import { NextResponse, type NextRequest } from 'next/server';
import {
  attachRefreshedCookieIfNeeded,
  resolveAuthUserFromRequest,
  transientAuthResponse,
  unauthorizedResponse,
} from './session';

export interface AuthenticatedUser {
  email: string;
  isAdmin: boolean;
}

export async function requireAuthUser(
  request: NextRequest
): Promise<{ user: AuthenticatedUser; response?: never } | { user?: never; response: NextResponse }> {
  const resolved = await resolveAuthUserFromRequest(request);
  if (resolved.kind === 'transient') {
    return { response: transientAuthResponse(resolved.message) };
  }
  if (resolved.kind === 'none') {
    return { response: unauthorizedResponse(true) };
  }
  return {
    user: { email: resolved.email, isAdmin: resolved.isAdmin },
  };
}

export async function requireAuthAdmin(
  request: NextRequest
): Promise<{ user: AuthenticatedUser; response?: never } | { user?: never; response: NextResponse }> {
  const auth = await requireAuthUser(request);
  if ('response' in auth && auth.response) return auth;
  if (!auth.user.isAdmin) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: { 'Cache-Control': 'no-store' } }),
    };
  }
  return auth;
}

export function withRefreshedCookie(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  void (async () => {
    const resolved = await resolveAuthUserFromRequest(request);
    if (resolved.kind === 'ok') {
      attachRefreshedCookieIfNeeded(response, request, resolved);
    }
  })();
  return response;
}
