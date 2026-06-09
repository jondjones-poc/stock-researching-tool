/** Desktop app default — shorter than long-lived mobile/other-app sessions. Override via AUTH_SESSION_MAX_AGE_DAYS. */
const DEFAULT_SESSION_MAX_AGE_DAYS = 7;

export const AUTH_COOKIE_NAME = 'rbauth';

export function getSessionMaxAgeSeconds(): number {
  const days = parseInt(process.env.AUTH_SESSION_MAX_AGE_DAYS || '', 10);
  const valid = Number.isFinite(days) && days > 0 ? days : DEFAULT_SESSION_MAX_AGE_DAYS;
  return valid * 24 * 60 * 60;
}

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) {
    throw new Error('SUPABASE_URL is not configured');
  }
  return url.replace(/\/$/, '');
}

function supabaseProjectRef(url: string): string | null {
  return url.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null;
}

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

/** Catch common Netlify/Render misconfig before Supabase returns "Invalid API key". */
export function validateSupabaseKeyPair(url: string, key: string): void {
  const ref = supabaseProjectRef(url);

  if (key.startsWith('sb_secret_') || key.startsWith('sb_publishable_')) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be the legacy service_role JWT (starts with eyJ), not sb_secret_. In Supabase: Project Settings → API → Legacy API Keys → service_role → Reveal.'
    );
  }

  if (key.startsWith('eyJ')) {
    const payload = decodeJwtPayload(key);
    if (payload?.role === 'anon') {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is the anon key. Use service_role from Legacy API Keys instead.'
      );
    }
    if (payload?.ref && ref && payload.ref !== ref) {
      throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY is for project "${payload.ref}" but SUPABASE_URL is "${ref}". Both must match.`
      );
    }
  }
}

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim().replace(/^["']|["']$/g, '');
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
  validateSupabaseKeyPair(getSupabaseUrl(), key);
  return key;
}

export function parseEmailList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function getEnvAdminEmails(): string[] {
  return parseEmailList(process.env.AUTH_ADMIN_EMAILS);
}

export function getEnvAllowedEmails(): string[] {
  return parseEmailList(process.env.ALLOWED_AUTH_EMAILS);
}

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/$/, '');
}

function platformOrigins(): string[] {
  const out: string[] = [];
  for (const raw of [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
  ]) {
    if (raw?.trim()) out.push(normalizeOrigin(raw));
  }
  return out;
}

export function getAuthAllowedOrigins(): string[] {
  const fromList = process.env.AUTH_ALLOWED_ORIGINS
    ? process.env.AUTH_ALLOWED_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
    : [];

  const single =
    process.env.FRONTEND_ORIGIN?.trim() || process.env.FRONTEND_DEV_ORIGIN?.trim() || '';

  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5003',
  ];

  if (process.env.NODE_ENV !== 'production') {
    const frontendDev = process.env.FRONTEND_DEV_ORIGIN?.trim();
    if (frontendDev) devOrigins.push(normalizeOrigin(frontendDev));
    return [...new Set([...fromList, ...(single ? [normalizeOrigin(single)] : []), ...platformOrigins(), ...devOrigins])];
  }

  return [...new Set([...fromList, ...(single ? [normalizeOrigin(single)] : []), ...platformOrigins()])];
}

export function getFrontendOrigin(requestOrigin?: string | null): string {
  if (process.env.NODE_ENV !== 'production') {
    const dev = process.env.FRONTEND_DEV_ORIGIN?.trim();
    if (dev) return normalizeOrigin(dev);
    if (requestOrigin) return normalizeOrigin(requestOrigin);
    return 'http://localhost:3000';
  }

  const allowed = getAuthAllowedOrigins();
  const normalizedRequest = requestOrigin ? normalizeOrigin(requestOrigin) : null;

  if (normalizedRequest && allowed.includes(normalizedRequest)) {
    return normalizedRequest;
  }
  if (allowed.length > 0) return allowed[0];
  throw new Error(
    'Set AUTH_ALLOWED_ORIGINS (or FRONTEND_ORIGIN) on Render, e.g. https://stock-researching-tool.netlify.app'
  );
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/** Same-origin Netlify deploy uses Lax; set AUTH_CROSS_SITE_COOKIES=true for Netlify UI + Render API. */
export function getCookieSameSite(): 'lax' | 'none' | 'strict' {
  const explicit = process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase();
  if (explicit === 'none' || explicit === 'lax' || explicit === 'strict') {
    return explicit;
  }
  if (process.env.AUTH_CROSS_SITE_COOKIES === 'true') {
    return 'none';
  }
  return 'lax';
}
