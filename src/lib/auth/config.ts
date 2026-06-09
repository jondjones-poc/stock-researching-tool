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

export function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
  }
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

export function getAuthAllowedOrigins(): string[] {
  const origins = process.env.AUTH_ALLOWED_ORIGINS
    ? process.env.AUTH_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5003',
  ];

  if (process.env.NODE_ENV !== 'production') {
    const frontendDev = process.env.FRONTEND_DEV_ORIGIN?.trim();
    if (frontendDev) devOrigins.push(frontendDev.replace(/\/$/, ''));
    return [...new Set([...origins, ...devOrigins])];
  }

  return [...new Set(origins)];
}

export function getFrontendOrigin(requestOrigin?: string | null): string {
  if (process.env.NODE_ENV !== 'production') {
    const dev = process.env.FRONTEND_DEV_ORIGIN?.trim();
    if (dev) return dev.replace(/\/$/, '');
    if (requestOrigin) return requestOrigin.replace(/\/$/, '');
    return 'http://localhost:3000';
  }

  const allowed = getAuthAllowedOrigins();
  if (requestOrigin && allowed.includes(requestOrigin.replace(/\/$/, ''))) {
    return requestOrigin.replace(/\/$/, '');
  }
  if (allowed.length > 0) return allowed[0].replace(/\/$/, '');
  throw new Error('AUTH_ALLOWED_ORIGINS must be set in production');
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
