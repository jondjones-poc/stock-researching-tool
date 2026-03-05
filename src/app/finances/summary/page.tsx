'use client';

import { useEffect, useState } from 'react';

interface NetworthReportData {
  year: number;
  categories: string[];
  monthData: Record<number, Record<string, number>>;
  monthsWithData: number[];
  categoryRules?: Record<string, string>;
}

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

export default function SummaryPage() {
  const [networthData, setNetworthData] = useState<NetworthReportData | null>(null);
  const [incomeTypes, setIncomeTypes] = useState<IncomeType[]>([]);
  const [incomeSources, setIncomeSources] = useState<IncomeSource[]>([]);
  const [incomeEntries, setIncomeEntries] = useState<IncomeEntry[]>([]);
  const [monthlyRetirementValue, setMonthlyRetirementValue] = useState<number | null>(null);
  const [retirementCountdown, setRetirementCountdown] = useState<{ years: number; months: number; days: number } | null>(null);
  const [retirementTargetPot, setRetirementTargetPot] = useState<number | null>(null);
  const [retirementReturnRate, setRetirementReturnRate] = useState<number | null>(null);
  const [retirementAge, setRetirementAge] = useState<number | null>(null);
  const [currentAge, setCurrentAge] = useState<number | null>(null);
  const [businessIncomeTooltip, setBusinessIncomeTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  
  // Calculate previous month (for displaying last month's data)
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth < 1) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }

  // Fetch networth data for current year
  useEffect(() => {
    const fetchNetworth = async () => {
      try {
        const response = await fetch(`/api/networth-report?year=${currentYear}`);
        if (!response.ok) throw new Error('Failed to fetch networth report');
        const data = await response.json();
        setNetworthData(data);
      } catch (err: any) {
        console.error('Error fetching networth:', err);
        setError('Failed to load networth data');
      }
    };
    fetchNetworth();
  }, [currentYear]);

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
        }
      } catch (err: any) {
        console.error('Error fetching retirement value:', err);
      }
    };
    fetchRetirementValue();
  }, []);

  // Fetch income entries for current year
  useEffect(() => {
    const fetchIncomeEntries = async () => {
      try {
        const response = await fetch(`/api/income-entries?year=${currentYear}`);
        if (!response.ok) throw new Error('Failed to fetch income entries');
        const data = await response.json();
        setIncomeEntries(data.data || []);
      } catch (err: any) {
        console.error('Error fetching income entries:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIncomeEntries();
  }, [currentYear]);

  // Get previous month networth
  const getPreviousMonthNetworth = () => {
    if (!networthData) return null;
    
    const networthCategory = networthData.categories.find(cat => {
      const catLower = cat.toLowerCase().trim();
      return catLower.includes('networth') || catLower.includes('net worth');
    });
    
    const monthTotals = networthData.monthData[previousMonth] || {};
    
    if (networthCategory) {
      return monthTotals[networthCategory] || 0;
    }
    
    // Fallback: sum all categories
    return networthData.categories.reduce((sum, category) => {
      return sum + (monthTotals[category] || 0);
    }, 0);
  };

  // Calculate retirement countdown (same logic as Retirement by Target Pot page)
  useEffect(() => {
    const calculateRetirementCountdown = () => {
      if (!networthData || !retirementTargetPot || !retirementReturnRate || !currentAge || !retirementAge) {
        setRetirementCountdown(null);
        return;
      }

      const networth = getPreviousMonthNetworth();
      if (networth === null || networth <= 0) {
        setRetirementCountdown(null);
        return;
      }

      const currentNetworth = Math.abs(networth);
      const targetPot = retirementTargetPot;
      const returnRate = retirementReturnRate;
      const annualGrowthRate = returnRate / 100;

      if (currentNetworth >= targetPot) {
        setRetirementCountdown({ years: 0, months: 0, days: 0 });
        return;
      }

      // Calculate exact time to reach target pot using compound interest formula
      const exactYears = Math.log(targetPot / currentNetworth) / Math.log(1 + annualGrowthRate);
      
      // Calculate when retirement age will be reached (when pension income starts)
      const yearsToRetirementAge = retirementAge - currentAge;
      
      // Use the target pot calculation (primary goal)
      // Note: Pension income starts at retirement age (in ${yearsToRetirementAge} years)
      const targetYears = exactYears;
      
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setFullYear(today.getFullYear() + targetYears);
      
      // Calculate difference in days
      const diffTime = targetDate.getTime() - today.getTime();
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Convert to years, months, days
      let years = Math.floor(totalDays / 365.25);
      let remainingDays = totalDays - (years * 365.25);
      let months = Math.floor(remainingDays / 30.44);
      let days = Math.ceil(remainingDays - (months * 30.44));
      
      // Adjust if days >= 30
      if (days >= 30) {
        months += Math.floor(days / 30);
        days = days % 30;
      }
      
      // Adjust if months >= 12
      if (months >= 12) {
        years += Math.floor(months / 12);
        months = months % 12;
      }
      
      setRetirementCountdown({ years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) });
    };

    calculateRetirementCountdown();
  }, [networthData, retirementTargetPot, retirementReturnRate, currentAge, retirementAge, previousMonth, previousYear]);

  // Fetch retirement settings from database
  useEffect(() => {
    const fetchRetirementSettings = async () => {
      try {
        const response = await fetch('/api/settings');
        if (!response.ok) throw new Error('Failed to fetch settings');
        const data = await response.json();
        const settings = data.data || [];
        
        // Map settings to state values
        const getSetting = (key: string, defaultValue: number) => {
          const setting = settings.find((s: any) => s.key === key);
          return setting && setting.value ? parseFloat(setting.value) : defaultValue;
        };
        
        setRetirementTargetPot(getSetting('retirement_target_pot', 2000000));
        setRetirementReturnRate(getSetting('retirement_return_rate', 7));
        setRetirementAge(getSetting('retirement_age', 68));
        setCurrentAge(getSetting('retirement_current_age', 44));
      } catch (err: any) {
        console.error('Error fetching retirement settings:', err);
        // Use defaults if settings fetch fails
        setRetirementTargetPot(2000000);
        setRetirementReturnRate(7);
        setRetirementAge(68);
        setCurrentAge(44);
      }
    };
    fetchRetirementSettings();
  }, []);

  // Get entry for a specific income source and month
  const getEntry = (sourceId: number, month: number) => {
    return incomeEntries.find(
      entry => entry.income_source_id === sourceId && 
               parseInt(entry.month.toString()) === month &&
               parseInt(entry.year.toString()) === currentYear
    );
  };

  // Get total for an income type and month (sum of all sources for that type)
  const getTypeTotal = (incomeTypeId: number, month: number) => {
    const sources = incomeSources.filter(source => source.income_type_id === incomeTypeId);
    
    if (sources.length === 0) return 0;
    
    let total = 0;
    
    sources.forEach(source => {
      const entry = getEntry(source.id, month);
      if (entry) {
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
    
    return total;
  };

  // Get monthly total (sum of all business income types for that month)
  const getMonthlyTotal = (month: number) => {
    const businessIncomeTypes = incomeTypes.filter(type => type.isbusinessincome === true);
    let total = 0;
    businessIncomeTypes.forEach(type => {
      total += getTypeTotal(type.id, month);
    });
    return total;
  };


  // Get business income total for previous month
  const businessIncomeTotal = getMonthlyTotal(previousMonth);

  // Check hit target
  const hitTarget = monthlyRetirementValue !== null && businessIncomeTotal >= monthlyRetirementValue;

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-2 sm:px-4 lg:px-6">
      <div className="w-full max-w-4xl mx-auto">
        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-gray-400">Loading...</div>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400">Error: {error}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Networth Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Current Networth
              </h2>
              <div className="text-3xl font-bold text-gray-900 dark:text-white">
                {(() => {
                  const networth = getPreviousMonthNetworth();
                  if (networth === null) return 'N/A';
                  const absValue = Math.abs(networth);
                  const formatted = `£${absValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  return networth < 0 ? `-${formatted}` : formatted;
                })()}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                {monthNames[previousMonth - 1]} {previousYear}
              </div>
            </div>

            {/* Retirement Countdown Section */}
            {retirementCountdown !== null && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Time to Retire
                </h2>
                <div className="space-y-4">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {retirementCountdown.years > 0 && `${retirementCountdown.years} ${retirementCountdown.years === 1 ? 'year' : 'years'}`}
                    {retirementCountdown.years > 0 && (retirementCountdown.months > 0 || retirementCountdown.days > 0) && ', '}
                    {retirementCountdown.months > 0 && `${retirementCountdown.months} ${retirementCountdown.months === 1 ? 'month' : 'months'}`}
                    {retirementCountdown.months > 0 && retirementCountdown.days > 0 && ', '}
                    {retirementCountdown.days > 0 && `${retirementCountdown.days} ${retirementCountdown.days === 1 ? 'day' : 'days'}`}
                    {retirementCountdown.years === 0 && retirementCountdown.months === 0 && retirementCountdown.days === 0 && 'Target Reached!'}
                  </div>
                  {retirementTargetPot !== null && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Target: £{retirementTargetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {retirementReturnRate !== null && ` at ${retirementReturnRate}% return rate`}
                      {currentAge !== null && retirementAge !== null && (
                        <div className="mt-1">
                          Current Age: {currentAge} | Retirement Age: {retirementAge} | Pension starts at age {retirementAge}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cashflow Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:col-span-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Cashflow
              </h2>
              <div className="space-y-4">
                {/* Business Income Total */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Business Income Total</span>
                  <span 
                    className="text-lg font-semibold text-gray-900 dark:text-white cursor-help"
                    onMouseEnter={(e) => {
                      const tooltipText = `Business Income Total Calculation:\n\nMonth: ${monthNames[previousMonth - 1]} ${previousYear}\n\nThis figure is the sum of all business income types for ${monthNames[previousMonth - 1]} ${previousYear}.\n\nBusiness income types are income sources marked as "isbusinessincome" in the system.`;
                      setBusinessIncomeTooltip({
                        x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                        y: e.currentTarget.getBoundingClientRect().top - 10,
                        text: tooltipText
                      });
                    }}
                    onMouseLeave={() => setBusinessIncomeTooltip(null)}
                  >
                    £{businessIncomeTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Monthly Retirement Value */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Monthly Retirement Value</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    {monthlyRetirementValue !== null
                      ? `£${monthlyRetirementValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Not Set'}
                  </span>
                </div>

                {/* Hit Target */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Hit Target</span>
                  <span className={`text-lg font-semibold ${
                    monthlyRetirementValue === null
                      ? 'text-gray-500 dark:text-gray-400'
                      : hitTarget
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {monthlyRetirementValue === null
                      ? 'N/A'
                      : (() => {
                          const difference = businessIncomeTotal - (monthlyRetirementValue || 0);
                          const sign = difference >= 0 ? '+' : '';
                          return `${sign}£${Math.abs(difference).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        })()}
                  </span>
                </div>

              </div>
            </div>
          </div>
        )}
      </div>

      {/* Business Income Tooltip */}
      {businessIncomeTooltip && (
        <div
          className="fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none whitespace-pre-line"
          style={{
            left: `${businessIncomeTooltip.x}px`,
            top: `${businessIncomeTooltip.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {businessIncomeTooltip.text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      )}
    </div>
  );
}
