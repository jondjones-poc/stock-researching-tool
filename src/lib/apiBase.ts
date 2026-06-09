/**
 * API helpers — production uses same-origin /api/* (Netlify proxies to Render).
 * Full-page OAuth navigations use authFlowApiUrl (direct backend in dev).
 */

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function getAuthFlowApiOrigin(): string {
  if (typeof window === 'undefined') return '';
  const configured = process.env.NEXT_PUBLIC_AUTH_FLOW_API_ORIGIN?.trim();
  if (process.env.NODE_ENV === 'development' && configured) {
    return configured.replace(/\/$/, '');
  }
  return window.location.origin;
}

/** Full-page browser navigation (OAuth start) — bypasses SPA fallback in dev. */
export function authFlowApiUrl(path: string): string {
  const normalized = normalizePath(path);
  if (typeof window === 'undefined') return normalized;
  const origin = getAuthFlowApiOrigin();
  return `${origin}${normalized}`;
}

/** Authenticated fetch via same-origin /api (credentials included). */
export async function sameOriginApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(normalizePath(path), {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers || {}),
    },
  });
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return sameOriginApiFetch(path, init);
}

export async function apiFetchJson<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: string }).error || response.statusText || 'Request failed';
    throw new Error(message);
  }
  return data as T;
}
