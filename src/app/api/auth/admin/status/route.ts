import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { noStoreHeaders } from '@/lib/auth/cookies';
import { requireAuthUser } from '@/lib/auth/require-auth';
import {
  attachRefreshedCookieIfNeeded,
  resolveAuthUserFromRequest,
} from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (auth.response) {
    return applyCorsHeaders(request, auth.response);
  }

  const resolved = await resolveAuthUserFromRequest(request);
  const response = NextResponse.json(
    {
      authenticated: true,
      email: auth.user.email,
      isAdmin: auth.user.isAdmin,
    },
    { headers: noStoreHeaders() }
  );

  if (resolved.kind === 'ok') {
    attachRefreshedCookieIfNeeded(response, request, resolved);
  }

  return applyCorsHeaders(request, response);
}
