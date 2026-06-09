'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, authFlowApiUrl } from '@/lib/apiBase';

interface SessionResponse {
  authenticated: boolean;
  email: string | null;
  isAdmin: boolean;
  transient?: boolean;
  retry?: boolean;
}

interface AuthContextValue {
  userEmail: string | null;
  isAdmin: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function parseOAuthHash(): {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
} | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token) return null;
  const expires_in = params.get('expires_in');
  return {
    access_token,
    refresh_token,
    expires_in: expires_in ? parseInt(expires_in, 10) : undefined,
  };
}

function stripHashFromUrl(): void {
  if (typeof window === 'undefined') return;
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}`);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSessionWithRetry(): Promise<SessionResponse> {
  let last: SessionResponse = { authenticated: false, email: null, isAdmin: false };
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await apiFetch('/api/auth/session');
    const data = (await response.json().catch(() => ({}))) as SessionResponse;
    last = data;
    if (response.status === 503 && data.transient) {
      await sleep(Math.min(500 * 2 ** attempt, 8000));
      continue;
    }
    return data;
  }
  return last;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  const applySession = useCallback((data: SessionResponse) => {
    if (data.authenticated && data.email) {
      setUserEmail(data.email);
      setIsAdmin(!!data.isAdmin);
      setIsAuthenticated(true);
      setAuthError(null);
      return true;
    }
    setUserEmail(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
    return false;
  }, []);

  const refreshSession = useCallback(async () => {
    const data = await fetchSessionWithRetry();
    return applySession(data);
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // still clear local state
    }
    setUserEmail(null);
    setIsAdmin(false);
    setIsAuthenticated(false);
    router.replace('/');
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setIsLoading(true);
      setAuthError(null);

      if (typeof window !== 'undefined' && pathname.startsWith('/api/')) {
        const hash = window.location.hash;
        router.replace(`/${hash}`);
        return;
      }

      const oauth = parseOAuthHash();
      if (oauth) {
        try {
          const establishRes = await apiFetch('/api/auth/establish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(oauth),
          });
          const establishData = await establishRes.json().catch(() => ({}));
          stripHashFromUrl();
          if (!establishRes.ok) {
            if (!cancelled) {
              setAuthError(
                (establishData as { error?: string }).error ||
                  'Sign-in failed. Your email may not be on the allowlist.'
              );
              setIsLoading(false);
            }
            return;
          }
        } catch {
          if (!cancelled) {
            setAuthError('Sign-in failed. Please try again.');
            setIsLoading(false);
          }
          return;
        }
      }

      try {
        const data = await fetchSessionWithRetry();
        if (!cancelled) {
          applySession(data);
        }
      } catch {
        if (!cancelled) {
          setAuthError('Could not verify session. Please try again.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [pathname, router, applySession]);

  const value = useMemo(
    () => ({
      userEmail,
      isAdmin,
      isAuthenticated,
      isLoading,
      authError,
      logout,
      refreshSession,
    }),
    [userEmail, isAdmin, isAuthenticated, isLoading, authError, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

export function startGoogleSignIn(): void {
  const returnTo = `${window.location.origin}/`;
  const url = authFlowApiUrl(
    `/api/auth/google/start?return_to=${encodeURIComponent(returnTo)}`
  );
  window.location.href = url;
}
