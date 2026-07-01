'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StocksLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortfolio = pathname === '/stocks/portfolio' || pathname === '/stocks';
  const isWatchlist = pathname === '/stocks/watchlist';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-0 mb-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <Link
            href="/stocks/portfolio"
            className={`px-4 py-3 text-sm font-semibold text-center transition-colors ${
              isPortfolio
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            My Portfolio
          </Link>
          <Link
            href="/stocks/watchlist"
            className={`px-4 py-3 text-sm font-semibold text-center transition-colors border-l border-gray-200 dark:border-gray-700 ${
              isWatchlist
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            Watchlist
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
