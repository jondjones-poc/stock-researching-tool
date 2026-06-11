/** Forward auth cookies when a route handler calls other protected /api routes. */
export function internalApiHeaders(request: Request): HeadersInit {
  const headers: Record<string, string> = {};
  const cookie = request.headers.get('cookie');
  if (cookie) headers.cookie = cookie;
  return headers;
}

export function internalApiOrigin(request: Request): string {
  return request.headers.get('origin') || new URL(request.url).origin;
}

export function internalApiFetch(
  request: Request,
  path: string,
  init?: RequestInit
): Promise<Response> {
  const origin = internalApiOrigin(request);
  const url = path.startsWith('http') ? path : `${origin}${path.startsWith('/') ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      ...internalApiHeaders(request),
      ...(init?.headers ?? {}),
    },
  });
}
