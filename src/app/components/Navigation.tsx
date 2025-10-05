'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-8">
            <Link 
              href="/" 
              className={`text-lg font-semibold transition-colors ${
                pathname === '/' 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              📊 Company Research
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
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Stock Research Platform
          </div>
        </div>
      </div>
    </nav>
  );
}
