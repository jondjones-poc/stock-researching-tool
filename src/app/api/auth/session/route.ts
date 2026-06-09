import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { noStoreHeaders } from '@/lib/auth/cookies';
import {
  attachRefreshedCookieIfNeeded,
  resolveAuthUserFromRequest,
  transientAuthResponse,
} from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const resolved = await resolveAuthUserFromRequest(request);

  if (resolved.kind === 'transient') {
    return applyCorsHeaders(request, transientAuthResponse(resolved.message));
  }

  if (resolved.kind === 'none') {
    const res = NextResponse.json(
      { authenticated: false, email: null, isAdmin: false },
      { headers: noStoreHeaders() }
    );
    return applyCorsHeaders(request, res);
  }

  const response = NextResponse.json(
    {
      authenticated: true,
      email: resolved.email,
      isAdmin: resolved.isAdmin,
    },
    { headers: noStoreHeaders() }
  );
  attachRefreshedCookieIfNeeded(response, request, resolved);
  return applyCorsHeaders(request, response);
}
