'use client';

import { ThemeProvider } from '../contexts/ThemeContext';
import { AuthProvider, startGoogleSignIn, useAuth } from '../contexts/AuthContext';
import Navigation from './Navigation';

function LoginScreen() {
  const { isLoading, authError } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/80 shadow-2xl backdrop-blur p-8">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">📊</div>
          <h1 className="text-2xl font-bold text-white">Stock Research Platform</h1>
          <p className="text-slate-400 mt-2 text-sm">Sign in with your Google account to continue</p>
        </div>

        {authError && (
          <div className="mb-4 rounded-lg border border-red-500/40 bg-red-950/50 px-4 py-3 text-sm text-red-200">
            {authError}
          </div>
        )}

        <button
          type="button"
          onClick={() => startGoogleSignIn()}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-3 rounded-xl bg-white text-slate-900 font-semibold py-3 px-4 hover:bg-slate-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoading ? 'Checking session…' : 'Continue with Google'}
        </button>
      </div>
    </div>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <ThemeProvider>
      <Navigation />
      {children}
    </ThemeProvider>
  );
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AppShell>{children}</AppShell>
    </AuthProvider>
  );
}
