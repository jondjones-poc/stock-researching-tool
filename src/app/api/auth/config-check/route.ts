import { NextResponse } from 'next/server';
import { getEnvAdminEmails } from '@/lib/auth/config';
import { noStoreHeaders } from '@/lib/auth/cookies';

function decodeJwtPayload(token: string): { ref?: string; role?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString(
      'utf8'
    );
    return JSON.parse(json) as { ref?: string; role?: string };
  } catch {
    return null;
  }
}

/** Public diagnostic — no secrets returned. Use after deploy to verify Netlify env. */
export async function GET() {
  const url = process.env.SUPABASE_URL?.trim() || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '') || '';
  const urlRef = url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;

  let keyType: 'missing' | 'jwt' | 'sb_secret' | 'other' = 'missing';
  let keyRole: string | null = null;
  let keyRef: string | null = null;

  if (key.startsWith('eyJ')) {
    keyType = 'jwt';
    const payload = decodeJwtPayload(key);
    keyRole = payload?.role ?? null;
    keyRef = payload?.ref ?? null;
  } else if (key.startsWith('sb_secret_')) {
    keyType = 'sb_secret';
  } else if (key) {
    keyType = 'other';
  }

  const issues: string[] = [];
  if (!url) issues.push('SUPABASE_URL is not set');
  if (!key) issues.push('SUPABASE_SERVICE_ROLE_KEY is not set');
  if (keyType === 'sb_secret') {
    issues.push('Use legacy service_role JWT (eyJ...), not sb_secret_');
  }
  if (keyType === 'jwt' && keyRole === 'anon') {
    issues.push('SUPABASE_SERVICE_ROLE_KEY is anon — use service_role');
  }
  if (keyType === 'jwt' && keyRef && urlRef && keyRef !== urlRef) {
    issues.push(`Key is for project ${keyRef} but URL is ${urlRef}`);
  }
  if (getEnvAdminEmails().length === 0) {
    issues.push('AUTH_ADMIN_EMAILS is not set');
  }

  return NextResponse.json(
    {
      ok: issues.length === 0,
      urlRef,
      keyType,
      keyRole,
      keyRefMatches: !keyRef || !urlRef || keyRef === urlRef,
      hasAdminEmails: getEnvAdminEmails().length > 0,
      issues,
    },
    { headers: noStoreHeaders() }
  );
}
