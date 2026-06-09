import { NextRequest, NextResponse } from 'next/server';
import { applyCorsHeaders, getRequestOrigin } from '@/lib/auth/cors';
import { getOAuthRedirectTo, validateReturnTo } from '@/lib/auth/return-to';
import { getSupabaseAdmin } from '@/lib/auth/supabase-admin';
import { noStoreHeaders } from '@/lib/auth/cookies';

export async function GET(request: NextRequest) {
  try {
    const requestOrigin = getRequestOrigin(request);
    const returnToParam = request.nextUrl.searchParams.get('return_to');
    const frontendOrigin = getOAuthRedirectTo(requestOrigin).replace(/\/$/, '');
    const redirectTo = validateReturnTo(returnToParam, frontendOrigin);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      console.error('Google OAuth start failed:', error);
      const res = NextResponse.json(
        { error: error?.message || 'Failed to start Google sign-in' },
        { status: 500, headers: noStoreHeaders() }
      );
      return applyCorsHeaders(request, res);
    }

    const res = NextResponse.redirect(data.url);
    res.headers.set('Cache-Control', 'no-store');
    return applyCorsHeaders(request, res);
  } catch (err) {
    console.error('auth/google/start:', err);
    const res = NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to start Google sign-in' },
      { status: 500, headers: noStoreHeaders() }
    );
    return applyCorsHeaders(request, res);
  }
}
