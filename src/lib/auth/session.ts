import { NextResponse, type NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import {
  applyAuthCookie,
  readAuthCookieFromRequest,
  type AuthCookiePayload,
} from './cookies';
import { resolveRoleForEmail } from './allowlist';
import { getSupabaseAdmin } from './supabase-admin';

export type AuthResolveResult =
  | { kind: 'ok'; user: User; email: string; isAdmin: boolean; tokens: AuthCookiePayload }
  | { kind: 'none' }
  | { kind: 'transient'; message?: string };

function isDefinitiveAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid_grant') ||
    lower.includes('refresh_token') ||
    lower.includes('invalid refresh') ||
    lower.includes('token has been revoked') ||
    lower.includes('user not found') ||
    lower.includes('session not found')
  );
}

function isTransientError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return true;
  const e = err as { message?: string; status?: number; code?: string };
  const msg = (e.message || '').toLowerCase();
  if (e.status && e.status >= 500) return true;
  if (msg.includes('fetch') || msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')) {
    return true;
  }
  if (isDefinitiveAuthError(msg)) return false;
  return true;
}

async function getUserFromAccessToken(accessToken: string): Promise<{ user: User | null; error?: string }> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error) return { user: null, error: error.message };
  return { user: data.user ?? null };
}

async function refreshTokens(refreshToken: string): Promise<{
  accessToken?: string;
  refreshToken?: string;
  user?: User | null;
  error?: string;
  definitive?: boolean;
}> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
  if (error) {
    return {
      error: error.message,
      definitive: isDefinitiveAuthError(error.message),
    };
  }
  return {
    accessToken: data.session?.access_token,
    refreshToken: data.session?.refresh_token ?? refreshToken,
    user: data.user,
  };
}

function isEdgeRuntime(): boolean {
  return process.env.NEXT_RUNTIME === 'edge';
}

async function resolveRoleSafe(email: string): Promise<'admin' | 'user' | null> {
  if (isEdgeRuntime()) {
    const { getEnvAdminEmails } = await import('./config');
    if (getEnvAdminEmails().includes(email.toLowerCase())) return 'admin';
    return 'user';
  }
  return resolveRoleForEmail(email);
}

export async function resolveAuthUserFromRequest(request: NextRequest): Promise<AuthResolveResult> {
  const cookie = readAuthCookieFromRequest(request);
  if (!cookie) return { kind: 'none' };

  try {
    const first = await getUserFromAccessToken(cookie.a);
    if (first.user?.email) {
      const email = first.user.email.toLowerCase();
      const role = await resolveRoleSafe(email);
      if (!role) return { kind: 'none' };
      const admin = role === 'admin';
      return {
        kind: 'ok',
        user: first.user,
        email,
        isAdmin: admin,
        tokens: cookie,
      };
    }

    const refreshed = await refreshTokens(cookie.r);
    if (refreshed.error) {
      if (refreshed.definitive) return { kind: 'none' };
      return { kind: 'transient', message: refreshed.error };
    }

    if (!refreshed.accessToken || !refreshed.user?.email) {
      return { kind: 'none' };
    }

    const email = refreshed.user.email.toLowerCase();
    const role = await resolveRoleSafe(email);
    if (!role && !isEdgeRuntime()) return { kind: 'none' };
    const admin = role === 'admin' || (isEdgeRuntime() && (await import('./config')).getEnvAdminEmails().includes(email));
    return {
      kind: 'ok',
      user: refreshed.user,
      email,
      isAdmin: admin,
      tokens: {
        a: refreshed.accessToken,
        r: refreshed.refreshToken ?? cookie.r,
      },
    };
  } catch (err) {
    console.error('resolveAuthUserFromRequest error:', err);
    if (isTransientError(err)) {
      return { kind: 'transient', message: err instanceof Error ? err.message : 'Auth service unavailable' };
    }
    return { kind: 'none' };
  }
}

export function attachRefreshedCookieIfNeeded(
  response: NextResponse,
  request: NextRequest,
  resolved: Extract<AuthResolveResult, { kind: 'ok' }>
): void {
  const current = readAuthCookieFromRequest(request);
  if (
    !current ||
    current.a !== resolved.tokens.a ||
    current.r !== resolved.tokens.r
  ) {
    applyAuthCookie(response, resolved.tokens);
  }
}

export { unauthorizedResponse, transientAuthResponse } from './responses';
