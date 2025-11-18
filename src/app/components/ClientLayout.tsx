'use client';

import { ThemeProvider } from '../contexts/ThemeContext';
import Navigation from './Navigation';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      // Don't check auth on login page
      if (pathname === '/login') {
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/check');
        const data = await response.json();
        
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch (error) {
        setIsAuthenticated(false);
        router.push('/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Show nothing while checking auth (prevents flash of content)
  if (isLoading || isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">
          {isLoading ? 'Loading...' : 'Redirecting to login...'}
        </div>
      </div>
    );
  }

  // Don't show navigation on login page
  const showNavigation = pathname !== '/login';

  return (
    <ThemeProvider>
      {showNavigation && <Navigation />}
      {children}
    </ThemeProvider>
  );
}

