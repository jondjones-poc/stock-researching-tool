'use client';

import { useEffect, useState } from 'react';

interface IncomeType {
  id: number;
  name: string;
  isbusinessincome?: boolean | null;
}

interface IncomeSource {
  id: number;
  name: string;
  income_type_id: number;
  account_id?: number | null;
}

interface IncomeEntry {
  id: number;
  income_source_id: number;
  add_date: string;
  price: number | string;
  income_source_name: string;
  income_type_id: number;
  income_type_name: string;
  year: number | string;
  month: number | string;
  account_id?: number | null;
  current_month_balance?: number | string | null;
  previous_month_balance?: number | string | null;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];

export default function CashflowPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyRetirementValue, setMonthlyRetirementValue] = useState<number | null>(null);

  // Fetch available years
  useEffect(() => {
    const fetchYears = async () => {
      try {
        const response = await fetch('/api/income-entries/years');
        if (!response.ok) throw new Error('Failed to fetch years');
        const data = await response.json();
        setAvailableYears(data.years || []);
        if (data.years && data.years.length > 0) {
          setSelectedYear(Math.max(...data.years));
        } else {
          const currentYear = new Date().getFullYear();
          setAvailableYears([currentYear]);
          setSelectedYear(currentYear);
        }
      } catch (err: any) {
        console.error('Error fetching years:', err);
        const currentYear = new Date().getFullYear();
        setAvailableYears([currentYear, currentYear - 1]);
      }
    };
    fetchYears();
  }, []);

  // Fetch income types
  useEffect(() => {
    const fetchIncomeTypes = async () => {
      try {
        const response = await fetch('/api/income-types');
        if (!response.ok) throw new Error('Failed to fetch income types');
        const data = await response.json();
        setIncomeTypes(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income types:', err);
        setError('Failed to load income types');
      }
    };
    fetchIncomeTypes();
  }, []);

  // Fetch income sources
  useEffect(() => {
    const fetchIncomeSources = async () => {
      try {
        const response = await fetch('/api/income-sources');
        if (!response.ok) throw new Error('Failed to fetch income sources');
        const data = await response.json();
        setIncomeSources(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income sources:', err);
        setError('Failed to load income sources');
      }
    };
    fetchIncomeSources();
  }, []);

  // Fetch monthly retirement value from settings
  useEffect(() => {
    const fetchRetirementValue = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        const retirementSetting = data.data?.find((s: any) => s.key === 'MONTHLY_RETIERMENT_VALUE');
        if (retirementSetting && retirementSetting.value) {
          setMonthlyRetirementValue(parseFloat(retirementSetting.value));
        } else {
          setMonthlyRetirementValue(null);
        }
      } catch (err: any) {
        console.error('Error fetching retirement value:', err);
        setMonthlyRetirementValue(null);
      }
    };
    fetchRetirementValue();
  }, []);

  // Fetch income entries for selected year
  useEffect(() => {
    const fetchIncomeEntries = async () => {
      if (!selectedYear) return;
      
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/income-entries?year=${selectedYear}`);
        if (!response.ok) throw new Error('Failed to fetch income entries');
        const data = await response.json();
        setIncomeEntries(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income entries:', err);
        setError('Failed to load income entries');
      } finally {
        setLoading(false);
      }
    };
    fetchIncomeEntries();
  }, [selectedYear]);

  // Get entry for a specific income source and month
  const getEntry = (sourceId: number, month: number) => {
    return incomeEntries.find(
      entry => entry.income_source_id === sourceId && 
               parseInt(entry.month.toString()) === month &&
               parseInt(entry.year.toString()) === selectedYear
    );
  };

  // Get total for an income type and month (sum of all sources for that type)
  // Uses account balance difference if account_id exists, otherwise uses price
  const getTypeTotal = (incomeTypeId: number, month: number) => {
    const sources = incomeSources.filter(source => source.income_type_id === incomeTypeId);
    
    if (sources.length === 0) return null;
    
    let total = 0;
    let hasAnyEntry = false;
    
    sources.forEach(source => {
      const entry = getEntry(source.id, month);
      if (entry) {
        hasAnyEntry = true;
        // If entry has account_id and balance data, use account balance difference
        if (entry.account_id && entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
          const current = parseFloat(entry.current_month_balance.toString());
          const previous = parseFloat(entry.previous_month_balance.toString());
          total += (current - previous);
        } else {
          // Otherwise, use the price value
          total += parseFloat(entry.price.toString());
        }
      }
    });
    
    return hasAnyEntry ? total : null;
  };

  // Filter income types to only those with isbusinessincome = true
  const businessIncomeTypes = incomeTypes.filter(type => type.isbusinessincome === true);

  // Get monthly total (sum of all income types for that month)
  const getMonthlyTotal = (month: number) => {
    let total = 0;
    businessIncomeTypes.forEach(type => {
      const typeTotal = getTypeTotal(type.id, month);
      if (typeTotal !== null) {
        total += typeTotal;
      }
    });
    return total;
  };

  // Get percentage difference between total and retirement value
  const getPercentageDifference = (month: number) => {
    const total = getMonthlyTotal(month);
    if (monthlyRetirementValue === null || monthlyRetirementValue === 0) {
      return null;
    }
    const difference = total - monthlyRetirementValue;
    const percentage = (difference / monthlyRetirementValue) * 100;
    return percentage;
  };

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
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {/* Income Type header on the left */}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider sticky left-0 z-10 bg-gray-50 dark:bg-gray-700">
                    Income Type
                  </th>
                  {/* Month columns */}
                  {monthNames.map((month) => (
                    <th
                      key={month}
                      className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap"
                    >
                      {month}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {businessIncomeTypes.map((type) => {
                  return (
                    <tr key={type.id}>
                      {/* Income Type name on the left */}
                      <td 
                        className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-white sticky left-0 z-10 bg-white dark:bg-gray-800 whitespace-nowrap"
                      >
                        {type.name}
                      </td>
                      {/* Month columns with values */}
                      {monthNames.map((_, monthIndex) => {
                        const month = monthIndex + 1;
                        const total = getTypeTotal(type.id, month);
                        const hasEntry = total !== null;
                        return (
                          <td
                            key={`${type.id}-${month}`}
                            className={`px-4 py-3 text-center text-sm whitespace-nowrap ${
                              hasEntry
                                ? 'text-gray-900 dark:text-white'
                                : 'text-gray-400 dark:text-gray-600 opacity-50'
                            }`}
                          >
                            {hasEntry
                              ? `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '£0.00'
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                
                {/* Blank row for spacing */}
                <tr>
                  <td className="px-4 py-3 sticky left-0 z-10 bg-white dark:bg-gray-800"></td>
                  {monthNames.map((_, monthIndex) => (
                    <td key={`blank-${monthIndex}`} className="px-4 py-3"></td>
                  ))}
                </tr>

                {/* Total row */}
                <tr className="font-bold bg-gray-200 dark:bg-gray-600">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-200 dark:bg-gray-600 whitespace-nowrap">
                    Total
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const total = getMonthlyTotal(month);
                    return (
                      <td
                        key={`total-${month}`}
                        className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-200 dark:bg-gray-600 whitespace-nowrap"
                      >
                        £{total.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    );
                  })}
                </tr>

                {/* Monthly Retirement Value row */}
                <tr className="font-semibold bg-gray-100 dark:bg-gray-700">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 whitespace-nowrap">
                    Monthly Retirement Value
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    return (
                      <td
                        key={`retirement-${monthIndex}`}
                        className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 whitespace-nowrap"
                      >
                        {monthlyRetirementValue !== null
                          ? `£${monthlyRetirementValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                          : 'Not Set'
                        }
                      </td>
                    );
                  })}
                </tr>

                {/* Hit Target row */}
                <tr className="font-semibold bg-gray-100 dark:bg-gray-700">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 whitespace-nowrap">
                    Hit Target
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const total = getMonthlyTotal(month);
                    const hasData = total > 0;
                    const hitTarget = monthlyRetirementValue !== null && total >= monthlyRetirementValue;
                    
                    return (
                      <td
                        key={`hit-target-${month}`}
                        className={`px-4 py-3 text-center text-sm font-semibold whitespace-nowrap ${
                          !hasData
                            ? 'text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-700'
                            : monthlyRetirementValue === null
                            ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700'
                            : hitTarget
                            ? 'text-green-600 dark:text-green-400 bg-gray-100 dark:bg-gray-700'
                            : 'text-red-600 dark:text-red-400 bg-gray-100 dark:bg-gray-700'
                        }`}
                      >
                        {!hasData
                          ? ''
                          : monthlyRetirementValue === null
                          ? 'N/A'
                          : hitTarget
                          ? '✓ Hit'
                          : '✗ Miss'
                        }
                      </td>
                    );
                  })}
                </tr>

                {/* Percentage Difference row */}
                <tr className="font-semibold bg-gray-100 dark:bg-gray-700">
                  <td className="px-4 py-3 text-gray-900 dark:text-white sticky left-0 z-10 bg-gray-100 dark:bg-gray-700 whitespace-nowrap">
                    % Difference
                  </td>
                  {monthNames.map((_, monthIndex) => {
                    const month = monthIndex + 1;
                    const total = getMonthlyTotal(month);
                    const hasData = total > 0;
                    const percentageDiff = getPercentageDifference(month);
                    const isPositive = percentageDiff !== null && percentageDiff >= 0;
                    
                    return (
                      <td
                        key={`percentage-${month}`}
                        className={`px-4 py-3 text-center text-sm whitespace-nowrap bg-gray-100 dark:bg-gray-700 ${
                          !hasData
                            ? 'text-gray-400 dark:text-gray-600'
                            : percentageDiff === null
                            ? 'text-gray-500 dark:text-gray-400'
                            : isPositive
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {!hasData
                          ? ''
                          : percentageDiff === null
                          ? 'N/A'
                          : `${isPositive ? '+' : ''}${percentageDiff.toFixed(1)}%`
                        }
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Table */}
        {!loading && !error && (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Summary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Hit Target
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white">
                    {monthlyRetirementValue === null
                      ? 'N/A'
                      : (() => {
                          let hitCount = 0;
                          monthNames.forEach((_, monthIndex) => {
                            const month = monthIndex + 1;
                            const total = getMonthlyTotal(month);
                            if (total >= (monthlyRetirementValue || 0)) {
                              hitCount++;
                            }
                          });
                          return `${hitCount}/${monthNames.length}`;
                        })()
                    }
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Total Monthly % Difference
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-900 dark:text-white">
                    {monthlyRetirementValue === null
                      ? 'N/A'
                      : (() => {
                          let totalPercentage = 0;
                          let validMonths = 0;
                          monthNames.forEach((_, monthIndex) => {
                            const month = monthIndex + 1;
                            const percentageDiff = getPercentageDifference(month);
                            if (percentageDiff !== null) {
                              totalPercentage += percentageDiff;
                              validMonths++;
                            }
                          });
                          if (validMonths === 0) return 'N/A';
                          const avgPercentage = totalPercentage / validMonths;
                          const isPositive = avgPercentage >= 0;
                          return (
                            <span className={isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {isPositive ? '+' : ''}{avgPercentage.toFixed(1)}%
                            </span>
                          );
                        })()
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
