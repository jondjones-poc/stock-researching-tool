'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface NetworthReportData {
  year: number;
  categories: string[];
  monthData: Record<number, Record<string, number>>;
  monthsWithData: number[];
  categoryRules?: Record<string, string>; // Maps category name to calculation rule
}

export default function NetworthReportPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [reportData, setReportData] = useState<NetworthReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/monthly-account-balances/years');
        if (!response.ok) throw new Error('Failed to fetch years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        if (data.years && data.years.length > 0) {
          setSelectedYear(Math.max(...data.years));
        }
      } catch (err: any) {
        console.error('Error fetching years:', err);
        setAvailableYears([new Date().getFullYear(), new Date().getFullYear() - 1]);
      }
    };
    fetchYears();
  }, []);

  // Fetch networth report data for selected year
  useEffect(() => {
    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/networth-report?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to fetch networth report');
        const data = await response.json();
        
        // Debug: Log the received data
        console.log('[Client] Networth report data received:', data);
        console.log('[Client] Categories:', data.categories);
        console.log('[Client] Month data sample:', Object.keys(data.monthData).slice(0, 3).map(m => ({
          month: m,
          data: data.monthData[parseInt(m)]
        })));
        
        // Debug: Check for pension values specifically
        const pensionCategory = data.categories?.find((cat: string) => 
          cat.toLowerCase().includes('pension')
        );
        if (pensionCategory) {
          console.log(`[Client] Found pension category: "${pensionCategory}"`);
          Object.keys(data.monthData).forEach(month => {
            const monthNum = parseInt(month);
            const pensionValue = data.monthData[monthNum]?.[pensionCategory];
            if (pensionValue !== undefined) {
              console.log(`[Client] Month ${month} (${monthNum}): ${pensionCategory} = ${pensionValue}`);
            }
          });
        } else {
          console.log('[Client] No pension category found. Available categories:', data.categories);
        }
        
        setReportData(data);
      } catch (err: any) {
        console.error('Error fetching networth report:', err);
        let errorMessage = 'Failed to load data';
        if (err.message) {
          errorMessage = err.message;
        } else if (err.error) {
          errorMessage = err.error;
          if (err.details) {
            errorMessage += `: ${err.details}`;
          }
        }
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    if (selectedYear) {
      fetchReportData();
    }
  }, [selectedYear]);

  // Handle horizontal scrolling detection
  useEffect(() => {
    let lastScrollLeft = 0;
    
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const currentScrollLeft = target.scrollLeft;
      
      // Only trigger if horizontal scroll has changed
      if (currentScrollLeft !== lastScrollLeft) {
        setIsScrolling(true);
        lastScrollLeft = currentScrollLeft;
        
        // Clear existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
        
        // Set scrolling to false after scrolling stops
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 150);
      }
    };

    // Find the scrollable container
    const tableContainer = document.querySelector('.overflow-x-auto');
    if (tableContainer) {
      tableContainer.addEventListener('scroll', handleScroll);
      return () => {
        tableContainer.removeEventListener('scroll', handleScroll);
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }
      };
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-2 sm:px-4 lg:px-6">
      <div className="w-full">
        {/* Year Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            {availableYears.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                  selectedYear === year
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {/* Data Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400">Error: {error}</div>
          </div>
        ) : !reportData || reportData.categories.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">No data available for {selectedYear}</div>
          </div>
        ) : (
          <div className="rounded-lg p-6 overflow-x-auto relative">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {/* Month - Fixed on left */}
                  <th className="pl-4 pr-0 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-30 bg-gray-50 dark:bg-gray-700 relative" style={{ verticalAlign: 'middle', lineHeight: '3', width: '112px', minWidth: '112px', maxWidth: '112px' }}>
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                    Month
                  </th>
                  {/* Networth - Fixed */}
                  <th className={`pl-4 pr-0 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky z-30 bg-gray-50 dark:bg-gray-700 relative group transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'}`} style={{ verticalAlign: 'middle', lineHeight: '3', left: '112px', width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                    <div className="flex items-center justify-center gap-1">
                      <span>Networth</span>
                      {reportData.categoryRules && (() => {
                        const networthCategory = reportData.categories.find(cat => {
                          const catLower = cat.toLowerCase().trim();
                          return catLower.includes('networth') || catLower.includes('net worth');
                        });
                        const hasRule = networthCategory && reportData.categoryRules[networthCategory];
                        return hasRule ? (
                          <div className="relative">
                            <svg 
                              className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" 
                              fill="currentColor" 
                              viewBox="0 0 20 20"
                            >
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                              <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                <div className="font-semibold mb-1">{networthCategory}</div>
                                <div className="text-gray-300">{reportData.categoryRules[networthCategory]}</div>
                                <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </th>
                  {/* Networth Increase - Fixed */}
                  <th className={`pl-4 pr-0 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky z-30 bg-gray-50 dark:bg-gray-700 relative transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'}`} style={{ verticalAlign: 'middle', lineHeight: '3', left: '272px', width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                    Networth Increase
                  </th>
                  {/* Percent Difference - Fixed */}
                  <th className={`pl-4 pr-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky z-30 bg-gray-50 dark:bg-gray-700 relative transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'}`} style={{ verticalAlign: 'middle', lineHeight: '3', left: '452px', width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                    <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                    Percent Difference
                  </th>
                  {/* Category columns - Scrollable */}
                  {reportData.categories
                    .filter(category => {
                      const categoryLower = category.toLowerCase().trim();
                      return !categoryLower.includes('networth') && 
                             !categoryLower.includes('net worth');
                    })
                    .map((category) => {
                      const hasRule = reportData.categoryRules && reportData.categoryRules[category];
                      return (
                        <th
                          key={category}
                          className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap relative group"
                        >
                          <div className="flex items-center justify-center gap-1">
                            <span>{category}</span>
                            {hasRule && (
                              <div className="relative">
                                <svg 
                                  className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" 
                                  fill="currentColor" 
                                  viewBox="0 0 20 20"
                                >
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50">
                                <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg py-2 px-3 shadow-lg whitespace-nowrap">
                                  <div className="font-semibold mb-1">{category}</div>
                                  <div className="text-gray-300">{reportData.categoryRules?.[category] || ''}</div>
                                    <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  {/* Edit column */}
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Edit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {monthNames.map((monthName, monthIndex) => {
                  const monthNumber = monthIndex + 1;
                  const hasData = reportData.monthsWithData.includes(monthNumber);
                  const monthTotals = reportData.monthData[monthNumber] || {};

                  // Get networth from category id 10
                  const networthCategory = reportData.categories.find(cat => {
                    const catLower = cat.toLowerCase().trim();
                    return catLower.includes('networth') || catLower.includes('net worth');
                  });
                  
                  const networth = networthCategory 
                    ? (monthTotals[networthCategory] || 0)
                    : reportData.categories.reduce((sum, category) => {
                        return sum + (monthTotals[category] || 0);
                      }, 0);

                  const previousMonthNumber = monthNumber - 1;
                  const previousMonthTotals = previousMonthNumber > 0 ? reportData.monthData[previousMonthNumber] || {} : {};
                  const previousNetworth = previousMonthNumber > 0 
                    ? (networthCategory 
                        ? (previousMonthTotals[networthCategory] || 0)
                        : reportData.categories.reduce((sum, category) => {
                            return sum + (previousMonthTotals[category] || 0);
                          }, 0))
                    : 0;

                  const changeInPounds = previousMonthNumber > 0 ? networth - previousNetworth : 0;
                  const changePercent = previousMonthNumber > 0 && previousNetworth !== 0
                    ? ((networth - previousNetworth) / Math.abs(previousNetworth)) * 100
                    : 0;

                  const networthIsPositive = networth > 0;
                  const networthIsNegative = networth < 0;
                  const changeIsPositive = changeInPounds > 0;
                  const changeIsNegative = changeInPounds < 0;

                  return (
                    <tr
                      key={monthNumber}
                      className={`border-b border-gray-200 dark:border-gray-700 ${
                        !hasData
                          ? 'opacity-50'
                          : ''
                      }`}
                    >
                      {/* Month - Fixed on left */}
                      <td className="pl-4 pr-0 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center sticky left-0 z-30 bg-white dark:bg-gray-800 relative" style={{ lineHeight: '1.5', verticalAlign: 'middle', width: '112px', minWidth: '112px', maxWidth: '112px' }}>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        {monthName}
                      </td>
                      {/* Networth - Fixed */}
                      <td className={`pl-4 pr-0 py-3 whitespace-nowrap text-sm text-center font-semibold sticky z-30 bg-white dark:bg-gray-800 relative transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'} ${
                        !hasData
                          ? 'text-gray-400 dark:text-gray-600'
                          : networthIsNegative
                          ? 'text-red-600 dark:text-red-400'
                          : networthIsPositive
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`} style={{ lineHeight: '1.5', verticalAlign: 'middle', left: '112px', width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        {(() => {
                          const absValue = Math.abs(networth);
                          const formatted = `£${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          return networthIsNegative ? `-${formatted}` : formatted;
                        })()}
                      </td>
                      {/* Networth Increase - Fixed */}
                      <td className={`pl-4 pr-0 py-3 whitespace-nowrap text-sm text-center sticky z-30 bg-white dark:bg-gray-800 relative transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'} ${
                        !hasData
                          ? 'text-gray-400 dark:text-gray-600'
                          : changeIsNegative
                          ? 'text-red-600 dark:text-red-400'
                          : changeIsPositive
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`} style={{ lineHeight: '1.5', verticalAlign: 'middle', left: '272px', width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        {(() => {
                          const absValue = Math.abs(changeInPounds);
                          const formatted = `£${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          return changeIsNegative ? `-${formatted}` : changeInPounds > 0 ? `+${formatted}` : formatted;
                        })()}
                      </td>
                      {/* Percent Difference - Fixed */}
                      <td className={`pl-4 pr-4 py-3 whitespace-nowrap text-sm text-center sticky z-30 bg-white dark:bg-gray-800 relative transition-opacity duration-300 ${isScrolling ? 'opacity-0' : 'opacity-100'} ${
                        !hasData
                          ? 'text-gray-400 dark:text-gray-600'
                          : changePercent < 0
                          ? 'text-red-600 dark:text-red-400'
                          : changePercent > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-600 dark:text-gray-400'
                      }`} style={{ lineHeight: '1.5', verticalAlign: 'middle', left: '452px', width: '160px', minWidth: '160px', maxWidth: '160px' }}>
                        <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-gray-300 dark:bg-gray-600"></div>
                        {changePercent !== 0 ? (
                          `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`
                        ) : (
                          '0.00%'
                        )}
                      </td>
                      {/* Category columns - Scrollable */}
                      {reportData.categories
                        .filter(category => {
                          const categoryLower = category.toLowerCase().trim();
                          return !categoryLower.includes('networth') && 
                                 !categoryLower.includes('net worth');
                        })
                        .map((category) => {
                          const value = monthTotals[category] || 0;
                          
                          const previousMonthNumber = monthNumber - 1;
                          const previousMonthTotals = previousMonthNumber > 0 ? reportData.monthData[previousMonthNumber] || {} : {};
                          const previousValue = previousMonthNumber > 0 ? (previousMonthTotals[category] || 0) : null;
                          
                          let textColorClass = 'text-white';
                          if (!hasData) {
                            textColorClass = 'text-gray-400 dark:text-gray-600 opacity-50';
                          } else if (previousValue === null || previousValue === undefined) {
                            textColorClass = 'text-white';
                          } else if (value > previousValue) {
                            textColorClass = 'text-green-600 dark:text-green-400';
                          } else if (value < previousValue) {
                            textColorClass = 'text-red-600 dark:text-red-400';
                          } else {
                            textColorClass = 'text-white';
                          }

                          return (
                            <td
                              key={category}
                              className={`px-4 py-3 whitespace-nowrap text-sm text-center ${textColorClass}`}
                            >
                              {(() => {
                                const absValue = Math.abs(value);
                                const formatted = `£${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                                return value < 0 ? `-${formatted}` : formatted;
                              })()}
                            </td>
                          );
                        })}
                      {/* Edit column */}
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => {
                            router.push(`/finances?year=${selectedYear}&month=${monthName}&edit=true`);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                          title={`Edit ${monthName} ${selectedYear}`}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
