'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '../contexts/ThemeContext';

export default function Navigation() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  
  // Determine which tab is active based on pathname
  const isFinancesTab = pathname?.startsWith('/finances') || false;
  const isStocksTab = !isFinancesTab && (
    pathname === '/watchlist' || 
    pathname === '/research' || 
    pathname === '/compare' ||
    pathname === '/dcf' ||
    pathname === '/ddm' ||
    pathname === '/graphs' ||
    pathname === '/' ||
    pathname === '/monthly-watchlist'
  );


  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <Link
            href="/finances"
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              isFinancesTab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            💰 Finances
          </Link>
          <Link
            href="/watchlist"
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              isStocksTab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
          >
            📈 Stocks
          </Link>
        </div>

        {/* Menu Items - Show based on active tab */}
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            {isFinancesTab && (
              <>
                <Link 
                  href="/finances/networth-report" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/finances/networth-report' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📊 Networth
                </Link>
                <Link 
                  href="/finances" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/finances' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 Finances
                </Link>
                <Link 
                  href="/finances/24-7-wage" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/finances/24-7-wage' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💵 24/7 Wage
                </Link>
                <Link 
                  href="/finances/statement" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/finances/statement' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📄 Statement
                </Link>
              </>
            )}
            {isStocksTab && (
              <>
                <Link 
                  href="/" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📊 Dashboard
                </Link>
                <Link 
                  href="/monthly-watchlist" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/monthly-watchlist' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📅 Watchlist
                </Link>
                <Link 
                  href="/watchlist" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/watchlist' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📋 Companies
                </Link>
                <Link 
                  href="/research" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/research' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  🔍 Research
                </Link>
                <Link 
                  href="/compare" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/compare' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  ⚖️ Compare
                </Link>
                <Link 
                  href="/dcf" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/dcf' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 DCF
                </Link>
                <Link 
                  href="/ddm" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/ddm' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💎 DDM
                </Link>
                <Link 
                  href="/graphs" 
                  className={`text-lg font-semibold transition-colors ${
                    pathname === '/graphs' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📈 Graphs
                </Link>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            <div className="text-sm text-gray-500 dark:text-gray-400">
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}