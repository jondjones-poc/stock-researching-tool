const PUBLIC_API_ROUTES: Array<{ method: string | '*'; path: string }> = [
  { method: 'GET', path: '/api/auth/google/start' },
  { method: 'POST', path: '/api/auth/establish' },
  { method: 'GET', path: '/api/auth/session' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'GET', path: '/api/keepalive' },
  { method: 'GET', path: '/api/db-ping' },
  { method: 'GET', path: '/api/db-keepalive' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/api/auth/config-check' },
];

export function isPublicApiRoute(pathname: string, method: string): boolean {
  const upper = method.toUpperCase();
  return PUBLIC_API_ROUTES.some(
    (route) =>
      route.path === pathname && (route.method === '*' || route.method.toUpperCase() === upper)
  );
}
