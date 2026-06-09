import { getFrontendOrigin } from './config';

export function validateReturnTo(returnTo: string | null, fallbackOrigin: string): string {
  const base = `${fallbackOrigin.replace(/\/$/, '')}/`;

  if (!returnTo?.trim()) {
    return base;
  }

  let parsed: URL;
  try {
    parsed = new URL(returnTo);
  } catch {
    return base;
  }

  if (parsed.pathname.startsWith('/api/')) {
    return base;
  }

  const allowedOrigin = fallbackOrigin.replace(/\/$/, '');
  if (parsed.origin !== allowedOrigin) {
    return base;
  }

  return `${parsed.origin}${parsed.pathname === '/' ? '/' : parsed.pathname}${parsed.search}`;
}

export function getOAuthRedirectTo(requestOrigin: string | null): string {
  const origin = getFrontendOrigin(requestOrigin);
  return `${origin}/`;
}
