'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();
  
  // Determine which tab is active based on pathname
  const isFinancesTab = pathname?.startsWith('/finances') || false;
  const isResearchTab = pathname?.startsWith('/research') && pathname !== '/research/dividend-fcf-analysis' || false;
  const isReportingTab = pathname?.startsWith('/reporting') || false;
  const isStocksTab = !isFinancesTab && !isReportingTab && (
    pathname === '/watchlist' ||
    pathname === '/compare' ||
    pathname === '/dcf' ||
    pathname === '/ddm' ||
    pathname === '/graphs' ||
    pathname === '/' ||
    pathname === '/monthly-watchlist' ||
    pathname === '/research/dividend-fcf-analysis'
  ) || false;


  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        {/* Tab Navigation */}
        <div className="flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
          <div className="flex">
            <Link
              href="/finances/summary"
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                isFinancesTab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              💰 Finances
            </Link>
            <Link
              href="/"
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                isStocksTab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              📈 Stocks
            </Link>
            <Link
              href="/reporting/networth"
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                isReportingTab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              📋 Reporting
            </Link>
            <Link
              href="/research/world-alerts"
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                isResearchTab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              🔍 Research
            </Link>
          </div>
          <Link
            href="/settings"
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              pathname === '/settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
            }`}
            aria-label="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>

        {/* Menu Items - Show based on active tab */}
        <div className="flex justify-between items-center py-3">
          <div className="flex items-center flex-nowrap gap-x-5">
            {isFinancesTab && (
              <>
                <Link 
                  href="/finances/summary" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/summary'
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📊 Summary
                </Link>
                <Link 
                  href="/finances" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances'
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 Finances
                </Link>
                <Link 
                  href="/finances/networth-report" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/networth-report' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📊 Networth
                </Link>
                <Link 
                  href="/finances/24-7-wage" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/24-7-wage' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💵 24/7 Wage
                </Link>
                <Link 
                  href="/finances/retirement-by-target-pot" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/retirement-by-target-pot' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  🎯 Retirement
                </Link>
                <Link 
                  href="/finances/cashflow" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/cashflow' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💼 Cashflow
                </Link>
                <Link 
                  href="/finances/investment-tracker" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/investment-tracker' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📈 Investing
                </Link>
                <Link 
                  href="/finances/dividends" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/finances/dividends' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 Portfolio
                </Link>
              </>
            )}
            {isResearchTab && (
              <>
                <Link 
                  href="/research/world-alerts" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/research/world-alerts' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  🌍 World Alerts
                </Link>
              </>
            )}
            {isReportingTab && (
              <>
                <Link 
                  href="/reporting/networth" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/reporting/networth' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Networth
                </Link>
                <Link 
                  href="/reporting/portfolio" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/reporting/portfolio' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Portfolio
                </Link>
                <Link 
                  href="/reporting" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/reporting' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  Retirement
                </Link>
              </>
            )}
            {isStocksTab && (
              <>
                <Link 
                  href="/" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📊 Dashboard
                </Link>
                <Link 
                  href="/monthly-watchlist" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/monthly-watchlist' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📅 Watchlist
                </Link>
                <Link 
                  href="/watchlist" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/watchlist' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  📋 Companies
                </Link>
                <Link 
                  href="/compare" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/compare' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  ⚖️ Compare
                </Link>
                <Link 
                  href="/dcf" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/dcf' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 DCF
                </Link>
                <Link 
                  href="/ddm" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/ddm' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💎 DDM
                </Link>
                <Link 
                  href="/research/dividend-fcf-analysis" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
                    pathname === '/research/dividend-fcf-analysis' 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
                  }`}
                >
                  💰 Dividend & FCF Analysis
                </Link>
                <Link 
                  href="/graphs" 
                  className={`text-sm font-semibold whitespace-nowrap transition-colors ${
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
        </div>
      </div>
    </nav>
  );
}