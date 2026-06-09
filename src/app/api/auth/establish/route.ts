import { NextRequest, NextResponse } from 'next/server';
import { isEmailAllowed } from '@/lib/auth/allowlist';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { applyAuthCookie, noStoreHeaders } from '@/lib/auth/cookies';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const accessToken = body.access_token?.trim();
    const refreshToken = body.refresh_token?.trim();

    if (!accessToken || !refreshToken) {
      const res = NextResponse.json(
        { error: 'access_token and refresh_token are required' },
        { status: 400, headers: noStoreHeaders() }
      );
      return applyCorsHeaders(request, res);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user?.email) {
      const msg = error?.message || 'Invalid access token';
      const friendly =
        msg.toLowerCase().includes('invalid api key')
          ? 'Invalid Supabase API key on the server. On Netlify set SUPABASE_SERVICE_ROLE_KEY to the legacy service_role JWT (eyJ...) from project wnazcizhbqjxvbyffyhp — not sb_secret_ and not from another project.'
          : msg;
      const res = NextResponse.json({ error: friendly }, { status: 401, headers: noStoreHeaders() });
      return applyCorsHeaders(request, res);
    }

    const email = data.user.email.toLowerCase();
    const allowed = await isEmailAllowed(email);
    if (!allowed) {
      const res = NextResponse.json(
        { error: 'This email is not allowed to sign in. Contact an administrator.' },
        { status: 403, headers: noStoreHeaders() }
      );
      return applyCorsHeaders(request, res);
    }

    const response = NextResponse.json(
      { success: true, email },
      { headers: noStoreHeaders() }
    );
    applyAuthCookie(response, { a: accessToken, r: refreshToken });
    return applyCorsHeaders(request, response);
  } catch (err) {
    console.error('auth/establish:', err);
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to establish session' },
      { status: 500, headers: noStoreHeaders() }
    );
    return applyCorsHeaders(request, res);
  }
}
