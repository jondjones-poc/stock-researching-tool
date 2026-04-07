'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { RetirementByDividends } from '../retirement-by-dividends/page';

interface NetworthReportData {
  year: number;
  categories: string[];
  monthData: Record<number, Record<string, number>>;
  monthsWithData: number[];
}

interface YearProjection {
  year: number;
  potValue: number;
  reached: boolean;
}

interface CashflowProjection {
  year: number;
  monthlyCashflow: number;
  reached: boolean;
}

// Retirement by Cashflow Component
function RetirementByCashflow() {
  const [requiredCashflow, setRequiredCashflow] = useState<number>(5000);
  const [cashflowIncrease, setCashflowIncrease] = useState<number>(5);
  const [averageMonthlyCashflow, setAverageMonthlyCashflow] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ years: number; months: number; days: number } | null>(null);
  const [projections, setProjections] = useState<CashflowProjection[]>([]);
  const [copied, setCopied] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1; // 1-12

  // Calculate previous months (for getting last 2 months with data)
  let month1 = currentMonth - 1;
  let month2 = currentMonth - 2;
  let year1 = currentYear;
  let year2 = currentYear;
  
  if (month1 < 1) {
    month1 = 12;
    year1 = currentYear - 1;
  }
  if (month2 < 1) {
    month2 = 12;
    year2 = currentYear - 1;
  }

  // Fetch settings on load
  useEffect(() => {
    const fetchSettings = async () => {
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
        
        setRequiredCashflow(getSetting('retirement_required_cashflow', 5000));
        setCashflowIncrease(getSetting('retirement_cashflow_increase', 5));
        
        setSettingsLoaded(true);
      } catch (err: any) {
        console.error('Error fetching settings:', err);
        // Use defaults if settings fetch fails
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  // Fetch average monthly cashflow from Cashflow
  useEffect(() => {
    const fetchCashflow = async () => {
      try {
        // Get current year and previous year data
        const currentYearResponse = await fetch(`/api/income-entries?year=${currentYear}`);
        const prevYearResponse = await fetch(`/api/income-entries?year=${currentYear - 1}`);
        
        if (!currentYearResponse.ok || !prevYearResponse.ok) {
          throw new Error('Failed to fetch income entries');
        }
        
        const currentYearData = await currentYearResponse.json();
        const prevYearData = await prevYearResponse.json();
        
        // Get income types and sources
        const typesResponse = await fetch('/api/income-types');
        const sourcesResponse = await fetch('/api/income-sources');
        
        if (!typesResponse.ok || !sourcesResponse.ok) {
          throw new Error('Failed to fetch income types/sources');
        }
        
        const typesData = await typesResponse.json();
        const sourcesData = await sourcesResponse.json();
        
        const businessIncomeTypes = typesData.data.filter((type: any) => type.isbusinessincome === true);
        const incomeSources = sourcesData.data || [];
        const allEntries = [...currentYearData.data, ...prevYearData.data];
        
        // Helper to get entry for a source and month
        const getEntry = (sourceId: number, month: number, year: number) => {
          return allEntries.find(
            (entry: any) => entry.income_source_id === sourceId && 
            parseInt(entry.month.toString()) === month &&
            parseInt(entry.year.toString()) === year
          );
        };
        
        // Helper to get total for a month
        const getMonthlyTotal = (month: number, year: number) => {
          let total = 0;
          let hasAnyEntry = false;
          
          businessIncomeTypes.forEach((type: any) => {
            const sources = incomeSources.filter((s: any) => s.income_type_id === type.id);
            sources.forEach((source: any) => {
              const entry = getEntry(source.id, month, year);
              if (entry) {
                hasAnyEntry = true;
                if (entry.account_id && entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
                  const current = parseFloat(entry.current_month_balance.toString());
                  const previous = parseFloat(entry.previous_month_balance.toString());
                  total += (current - previous);
                } else {
                  total += parseFloat(entry.price.toString());
                }
              }
            });
          });
          
          return hasAnyEntry ? total : null;
        };
        
        // Get last 2 months with calculated values
        const month1Total = getMonthlyTotal(month1, year1);
        const month2Total = getMonthlyTotal(month2, year2);
        
        const validTotals: number[] = [];
        if (month1Total !== null && month1Total > 0) validTotals.push(month1Total);
        if (month2Total !== null && month2Total > 0) validTotals.push(month2Total);
        
        if (validTotals.length > 0) {
          const average = validTotals.reduce((sum, val) => sum + val, 0) / validTotals.length;
          setAverageMonthlyCashflow(average);
        } else {
          setAverageMonthlyCashflow(null);
        }
      } catch (err: any) {
        console.error('Error fetching cashflow:', err);
        setError('Failed to load cashflow data');
      } finally {
        setLoading(false);
      }
    };
    fetchCashflow();
  }, [currentYear, currentMonth, month1, month2, year1, year2]);

  // Calculate countdown and projections
  useEffect(() => {
    if (averageMonthlyCashflow === null || averageMonthlyCashflow <= 0) {
      setCountdown(null);
      setProjections([]);
      return;
    }

    const annualIncreaseRate = cashflowIncrease / 100;
    let yearsToTarget = 0;
    let projectedCashflow = averageMonthlyCashflow;
    
    const projectionList: CashflowProjection[] = [];
    const maxYears = 100;
    
    for (let year = currentYear; year <= currentYear + maxYears; year++) {
      if (projectedCashflow >= requiredCashflow) {
        yearsToTarget = year - currentYear;
        projectionList.push({
          year,
          monthlyCashflow: projectedCashflow,
          reached: true,
        });
        break;
      }
      
      projectionList.push({
        year,
        monthlyCashflow: projectedCashflow,
        reached: false,
      });
      
      projectedCashflow = projectedCashflow * (1 + annualIncreaseRate);
    }
    
    // Reverse the list to show target at top
    setProjections([...projectionList].reverse());
    
    // Calculate countdown
    if (yearsToTarget > 0) {
      const annualIncreaseRate = cashflowIncrease / 100;
      const exactYears = Math.log(requiredCashflow / averageMonthlyCashflow) / Math.log(1 + annualIncreaseRate);
      
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setFullYear(today.getFullYear() + exactYears);
      
      const diffTime = targetDate.getTime() - today.getTime();
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let years = Math.floor(totalDays / 365.25);
      const remainingDays = totalDays - (years * 365.25);
      let months = Math.floor(remainingDays / 30.44);
      let days = Math.ceil(remainingDays - (months * 30.44));
      
      if (days >= 30) {
        months += Math.floor(days / 30);
        days = days % 30;
      }
      
      if (months >= 12) {
        years += Math.floor(months / 12);
        months = months % 12;
      }
      
      setCountdown({ years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) });
    } else {
      setCountdown(null);
    }
  }, [averageMonthlyCashflow, requiredCashflow, cashflowIncrease, currentYear]);

  if (loading || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Left Sidebar */}
      <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="space-y-6">
          {/* Required Monthly Cashflow */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Monthly Cashflow Required
            </label>
            <input
              type="number"
              value={requiredCashflow}
              onChange={(e) => setRequiredCashflow(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              step="100"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              £{requiredCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          {/* Average Monthly Cashflow */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Average Monthly Cashflow
            </label>
            <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
              {averageMonthlyCashflow !== null ? (
                <div className="text-lg font-semibold">
                  £{averageMonthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              ) : (
                <div className="text-gray-400">No data available</div>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Average of last 2 months with data
            </div>
          </div>

          {/* Cashflow Increase Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cashflow Increase (%)
            </label>
            <input
              type="number"
              value={cashflowIncrease}
              onChange={(e) => setCashflowIncrease(parseFloat(e.target.value) || 0)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              min="0"
              max="100"
              step="0.1"
            />
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {cashflowIncrease}% annual increase
            </div>
          </div>

          {/* Progress */}
          {averageMonthlyCashflow !== null && averageMonthlyCashflow > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Progress to Target
              </label>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (averageMonthlyCashflow / requiredCashflow) * 100)}%`,
                  }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {((averageMonthlyCashflow / requiredCashflow) * 100).toFixed(2)}% of target
              </div>
            </div>
          )}

          {/* Ask AI Button */}
          <div className="pt-4 border-t border-gray-300 dark:border-gray-600">
            <button
              onClick={async () => {
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth() + 1;
                
                // Calculate previous months
                let month1 = currentMonth - 1;
                let month2 = currentMonth - 2;
                let year1 = currentYear;
                let year2 = currentYear;
                if (month1 < 1) {
                  month1 = 12;
                  year1 = currentYear - 1;
                }
                if (month2 < 1) {
                  month2 = 12;
                  year2 = currentYear - 1;
                }

                // Calculate time to target
                let timeToTarget = 'N/A';
                if (countdown) {
                  timeToTarget = `${countdown.years} years, ${countdown.months} months, ${countdown.days} days`;
                }

                // Get target year from projections
                const targetYear = projections.find(p => p.reached)?.year || 'Not calculated';

                const prompt = `I'm planning for retirement based on cashflow. Please analyze my situation and provide feedback:

**Current Situation:**
- Required Monthly Cashflow: £${requiredCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Average Monthly Cashflow (last 2 months): £${averageMonthlyCashflow !== null ? averageMonthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
- Cashflow Increase Rate: ${cashflowIncrease}% per year
- Current Progress: ${averageMonthlyCashflow !== null && averageMonthlyCashflow > 0 ? ((averageMonthlyCashflow / requiredCashflow) * 100).toFixed(2) : '0.00'}% of target

**Projections:**
- Time to Target: ${timeToTarget}
- Target Year: ${targetYear}
- Current Year: ${currentYear}

**Year-by-Year Projections:**
${projections.slice(0, 10).map(p => `- ${p.year}: £${p.monthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.reached ? '(TARGET REACHED)' : ''}`).join('\n')}
${projections.length > 10 ? `\n... and ${projections.length - 10} more years` : ''}

**Please:**
1. Validate the mathematics - check if the calculations are correct
2. Assess if the goal is realistic - is achieving ${cashflowIncrease}% annual cashflow growth feasible?
3. Suggest ways I can improve my cashflow figure and hit the target quicker
4. Provide actionable recommendations based on my current situation

Thank you!`;

                try {
                  await navigator.clipboard.writeText(prompt);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 3000);
                } catch (err) {
                  console.error('Failed to copy:', err);
                  alert('Failed to copy to clipboard. Please try again.');
                }
              }}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Ask AI
                </>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        {/* Countdown Timer */}
        {countdown && (
          <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
            <h2 className="text-xl font-semibold mb-4">Time to Target</h2>
            <div className="flex gap-8">
              <div className="text-center">
                <div className="text-4xl font-bold">{countdown.years}</div>
                <div className="text-sm opacity-90">Years</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold">{countdown.months}</div>
                <div className="text-sm opacity-90">Months</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-bold">{countdown.days}</div>
                <div className="text-sm opacity-90">Days</div>
              </div>
            </div>
          </div>
        )}

        {!countdown && averageMonthlyCashflow !== null && averageMonthlyCashflow > 0 && (
          <div className="mb-8 p-6 bg-yellow-500 rounded-lg text-white">
            <h2 className="text-xl font-semibold">Target Already Reached!</h2>
            <p className="mt-2">Your current cashflow exceeds your required cashflow.</p>
          </div>
        )}

        {/* Year by Year Projections */}
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Year by Year Projection
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Projected Monthly Cashflow
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {projections.map((projection) => (
                  <tr
                    key={projection.year}
                    className={projection.reached ? 'bg-green-50 dark:bg-green-900/20' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {projection.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      £{projection.monthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {projection.reached ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">
                          Target Reached
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                          In Progress
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DrawdownProjection {
  year: number;
  portfolioValue: number;
  portfolioWithBusiness?: number;
  withdrawalAmount: number;
  taxAmount: number;
  netWithdrawal: number;
  statePensionAmount: number;
  totalIncome: number;
  previousValue?: number;
  growthAmount?: number;
  // Portfolio with business calculation details
  portfolioWithBusinessStart?: number;
  portfolioWithBusinessGrowth?: number;
  portfolioWithBusinessAfterGrowth?: number;
  businessCashflowThisYear?: number;
  portfolioWithBusinessFinal?: number;
}

// Retirement by Target Pot Component (existing content)
function RetirementByTargetPot() {
  const [targetPot, setTargetPot] = useState<number>(2000000);
  const [returnRate, setReturnRate] = useState<number>(7);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4);
  const [inflation, setInflation] = useState<number>(3);
  const [tax, setTax] = useState<number>(20);
  const [currentAge, setCurrentAge] = useState<number>(44);
  const [retirementAge, setRetirementAge] = useState<number>(68);
  const [statePensionWeekly, setStatePensionWeekly] = useState<number>(221.20);
  const [deathAge, setDeathAge] = useState<number>(85);
  const [currentNetworth, setCurrentNetworth] = useState<number | null>(null);
  const [networthData, setNetworthData] = useState<NetworthReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ years: number; months: number; days: number } | null>(null);
  const [projections, setProjections] = useState<YearProjection[]>([]);
  const [drawdownProjections, setDrawdownProjections] = useState<DrawdownProjection[]>([]);
  const [drawdownTooltip, setDrawdownTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [drawdownCopied, setDrawdownCopied] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Fetch settings on load
  useEffect(() => {
    const fetchSettings = async () => {
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
        
        setTargetPot(getSetting('retirement_target_pot', 2000000));
        setReturnRate(getSetting('retirement_return_rate', 7));
        setSafeWithdrawalRate(getSetting('retirement_withdrawal_rate', 4));
        setInflation(getSetting('retirement_inflation', 3));
        setTax(getSetting('retirement_tax', 20));
        setCurrentAge(getSetting('retirement_current_age', 44));
        setRetirementAge(getSetting('retirement_age', 68));
        setStatePensionWeekly(getSetting('retirement_state_pension_weekly', 221.20));
        setDeathAge(getSetting('retirement_death_age', 85));
        
        setSettingsLoaded(true);
      } catch (err: any) {
        console.error('Error fetching settings:', err);
        // Use defaults if settings fetch fails
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  // Fetch networth data
  useEffect(() => {
    const fetchNetworth = async () => {
      try {
        const response = await fetch(`/api/networth-report?year=${previousYear}`);
        if (!response.ok) throw new Error('Failed to fetch networth report');
        const data = await response.json();
        setNetworthData(data);
        
        // Get previous month HNWI (category 9) instead of networth (category 10)
        // Category 10 (Networth) = Category 8 + Category 9 (HNWI)
        // We can extract Category 9 from the categoryRules
        const monthTotals = data.monthData[previousMonth] || {};
        
        let hnwiValue = 0;
        
        // First, try to find HNWI category by name
        let hnwiCategory = data.categories.find((cat: string) => {
          const catLower = cat.toLowerCase().trim();
          return catLower.includes('hnwi') || catLower.includes('high net worth');
        });
        
        // If not found by name, extract from categoryRules
        // Networth rule should be: "Category8 + Category9"
        if (!hnwiCategory && data.categoryRules) {
          const networthCategoryName = data.categories.find((cat: string) => {
            const catLower = cat.toLowerCase().trim();
            return catLower.includes('networth') || catLower.includes('net worth');
          });
          
          if (networthCategoryName && data.categoryRules[networthCategoryName]) {
            const rule = data.categoryRules[networthCategoryName] as string;
            const parts = rule.split('+').map(s => s.trim());
            if (parts.length === 2) {
              // parts[0] is category 8, parts[1] is category 9 (HNWI)
              hnwiCategory = parts[1];
            }
          }
        }
        
        // Get the HNWI value
        if (hnwiCategory && monthTotals[hnwiCategory] !== undefined) {
          hnwiValue = monthTotals[hnwiCategory] || 0;
        } else {
          // Fallback: if we can't find HNWI, use networth as before
          const networthCategory = data.categories.find((cat: string) => {
            const catLower = cat.toLowerCase().trim();
            return catLower.includes('networth') || catLower.includes('net worth');
          });
          
          if (networthCategory) {
            hnwiValue = monthTotals[networthCategory] || 0;
          } else {
            // Ultimate fallback: sum all categories
            hnwiValue = data.categories.reduce((sum: number, category: string) => {
              return sum + (monthTotals[category] || 0);
            }, 0);
          }
        }
        
        setCurrentNetworth(hnwiValue);
      } catch (err: any) {
        console.error('Error fetching networth:', err);
        setError('Failed to load networth data');
      } finally {
        setLoading(false);
      }
    };
    fetchNetworth();
  }, [previousYear, previousMonth]);

  // Calculate countdown and projections
  useEffect(() => {
    if (currentNetworth === null || currentNetworth <= 0) {
      setCountdown(null);
      setProjections([]);
      return;
    }

    // Calculate when we'll reach the target
    const annualGrowthRate = returnRate / 100;
    let yearsToTarget = 0;
    let projectedValue = currentNetworth;
    
    const projectionList: YearProjection[] = [];
    const maxYears = 100; // Safety limit
    
    for (let year = currentYear; year <= currentYear + maxYears; year++) {
      if (projectedValue >= targetPot) {
        yearsToTarget = year - currentYear;
        projectionList.push({
          year,
          potValue: projectedValue,
          reached: true,
        });
        break;
      }
      
      projectionList.push({
        year,
        potValue: projectedValue,
        reached: false,
      });
      
      projectedValue = projectedValue * (1 + annualGrowthRate);
    }
    
    // Reverse to show target year at top, current year at bottom
    setProjections([...projectionList].reverse());
    
    // Calculate exact countdown (years, months, days)
    if (yearsToTarget > 0) {
      // Calculate exact time to reach target using compound interest formula
      // targetPot = currentNetworth * (1 + rate)^years
      // years = ln(targetPot / currentNetworth) / ln(1 + rate)
      const exactYears = Math.log(targetPot / currentNetworth) / Math.log(1 + annualGrowthRate);
      
      const today = new Date();
      const targetDate = new Date(today);
      targetDate.setFullYear(today.getFullYear() + exactYears);
      
      // Calculate difference in days
      const diffTime = targetDate.getTime() - today.getTime();
      const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Convert to years, months, days
      let years = Math.floor(totalDays / 365.25);
      const remainingDays = totalDays - (years * 365.25);
      let months = Math.floor(remainingDays / 30.44); // Average days per month
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
      
      setCountdown({ years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) });
    } else {
      setCountdown(null);
    }
  }, [currentNetworth, targetPot, returnRate, currentYear]);

  // Calculate drawdown projections
  useEffect(() => {
    // Find the retirement year (when target is reached)
    const targetYear = projections.find(p => p.reached)?.year;
    
    if (!targetYear || !deathAge || !retirementAge) {
      setDrawdownProjections([]);
      return;
    }
    
    if (retirementAge >= deathAge) {
      setDrawdownProjections([]);
      return;
    }

    // Calculate retirement year based on retirement age
    // We need to find when the user will reach retirement age
    // For now, use the target year as retirement year (when pot reaches target)
    const retirementYear = targetYear;

    const drawdownList: DrawdownProjection[] = [];
    const annualReturnRate = returnRate / 100;
    const withdrawalRate = safeWithdrawalRate / 100;
    const inflationRate = inflation / 100;
    const taxRate = tax / 100;
    
    // Calculate state pension yearly (weekly * 52)
    const statePensionYearly = statePensionWeekly * 52;
    
    // Start with target pot at retirement
    let portfolioValue = targetPot;
    const baseWithdrawal = portfolioValue * withdrawalRate;
    
    // Calculate years from retirement to death
    const yearsInRetirement = deathAge - retirementAge;
    
    for (let i = 0; i <= yearsInRetirement; i++) {
      const year = retirementYear + i;
      
      // Store previous value before calculations
      const previousValue = portfolioValue;
      
      // Calculate gross withdrawal for this year (adjusted for inflation)
      const withdrawalAmount = baseWithdrawal * Math.pow(1 + inflationRate, i);
      
      // Calculate tax on the withdrawal
      const taxAmount = withdrawalAmount * taxRate;
      
      // Net withdrawal after tax
      const netWithdrawal = withdrawalAmount - taxAmount;
      
      // Calculate state pension for this year (adjusted for inflation)
      // State pension only starts at retirement age
      const ageAtYear = currentAge + (year - currentYear);
      const statePensionAmount = ageAtYear >= retirementAge 
        ? statePensionYearly * Math.pow(1 + inflationRate, i) 
        : 0;
      
      // Total income = net withdrawal (after tax) + state pension
      const totalIncome = netWithdrawal + statePensionAmount;
      
      // Portfolio grows first
      const growthAmount = portfolioValue * annualReturnRate;
      portfolioValue = portfolioValue * (1 + annualReturnRate);
      
      // Then gross withdrawal is taken from portfolio (tax is paid on withdrawal)
      portfolioValue = portfolioValue - withdrawalAmount;
      
      // Don't show negative portfolio values
      if (portfolioValue < 0) {
        portfolioValue = 0;
      }
      
      drawdownList.push({
        year,
        portfolioValue: Math.max(0, portfolioValue),
        withdrawalAmount,
        taxAmount,
        netWithdrawal,
        statePensionAmount,
        totalIncome,
        previousValue,
        growthAmount,
      });
    }
    
    setDrawdownProjections(drawdownList);
  }, [projections, targetPot, returnRate, safeWithdrawalRate, inflation, tax, currentAge, retirementAge, statePensionWeekly, deathAge, currentYear]);

  if (loading || !settingsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-6">
        {/* Tooltip */}
        {drawdownTooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none whitespace-pre-line"
          style={{
            left: `${drawdownTooltip.x}px`,
            top: `${drawdownTooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {drawdownTooltip.text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      )}
        {/* Left Sidebar */}
        <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="space-y-6">
              {/* Target Pot */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retirement Target Pot
                </label>
                <input
                  type="text"
                  value={targetPot === 0 ? '' : `£${targetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  onChange={(e) => {
                    // Remove currency symbols and format
                    const rawValue = e.target.value.replace(/[£,]/g, '');
                    setTargetPot(parseFloat(rawValue) || 0);
                  }}
                  onBlur={(e) => {
                    // Format on blur
                    const rawValue = e.target.value.replace(/[£,]/g, '');
                    const numValue = parseFloat(rawValue) || 0;
                    setTargetPot(numValue);
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="£0.00"
                />
              </div>

              {/* Current HNWI Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current HNWI Number
                </label>
                <div className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white">
                  {currentNetworth !== null ? (
                    <div className="text-lg font-semibold">
                      £{currentNetworth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  ) : (
                    <div className="text-gray-400">No data available</div>
                  )}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Based on {previousMonth}/{previousYear}
                </div>
              </div>

              {/* Return Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Average Return Rate (%)
                </label>
                <input
                  type="number"
                  value={returnRate}
                  onChange={(e) => setReturnRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                  step="0.1"
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {returnRate}% annual growth
                </div>
              </div>

              {/* Safe Withdrawal Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Withdrawal Rate (%)
                </label>
                <input
                  type="number"
                  value={safeWithdrawalRate}
                  onChange={(e) => setSafeWithdrawalRate(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              {/* Inflation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Inflation (%)
                </label>
                <input
                  type="number"
                  value={inflation}
                  onChange={(e) => setInflation(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="100"
                  step="0.1"
                />
              </div>

              {/* Current Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Age
                </label>
                <input
                  type="number"
                  value={currentAge}
                  onChange={(e) => setCurrentAge(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="150"
                  step="1"
                />
              </div>

              {/* Retirement Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Retirement Age
                </label>
                <input
                  type="number"
                  value={retirementAge}
                  onChange={(e) => setRetirementAge(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="150"
                  step="1"
                />
              </div>

              {/* State Pension */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State Pension (Weekly)
                </label>
                <input
                  type="number"
                  value={statePensionWeekly}
                  onChange={(e) => setStatePensionWeekly(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  step="0.01"
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  £{statePensionWeekly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/week
                  <br />
                  (£{(statePensionWeekly * 52).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year)
                </div>
              </div>

              {/* Death Age */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Death Age
                </label>
                <input
                  type="number"
                  value={deathAge}
                  onChange={(e) => setDeathAge(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="0"
                  max="150"
                  step="1"
                />
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Age {deathAge}
                </div>
              </div>

              {/* Progress */}
              {currentNetworth !== null && currentNetworth > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Progress to Target
                  </label>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
                    <div
                      className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, (currentNetworth / targetPot) * 100)}%`,
                      }}
                    ></div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {((currentNetworth / targetPot) * 100).toFixed(2)}% of target
                  </div>
                </div>
              )}

              {/* Ask AI Button */}
              <div className="pt-4 border-t border-gray-300 dark:border-gray-600">
                <button
                  onClick={async () => {
                    const currentDate = new Date();
                    const currentYear = currentDate.getFullYear();
                    const currentMonth = currentDate.getMonth() + 1;
                    
                    // Calculate previous month
                    let previousMonth = currentMonth - 1;
                    let previousYear = currentYear;
                    if (previousMonth < 1) {
                      previousMonth = 12;
                      previousYear = currentYear - 1;
                    }

                    // Calculate time to target
                    let timeToTarget = 'N/A';
                    if (countdown) {
                      timeToTarget = `${countdown.years} years, ${countdown.months} months, ${countdown.days} days`;
                    }

                    // Get target year from projections
                    const targetYear = projections.find(p => p.reached)?.year || 'Not calculated';
                    const retirementYear = drawdownProjections.length > 0 ? drawdownProjections[0].year : 'Not calculated';
                    const statePensionYearly = statePensionWeekly * 52;

                    // Format projections
                    const projectionsText = projections.slice(0, 15).map(p => 
                      `  ${p.year}: £${p.potValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.reached ? '(TARGET REACHED)' : ''}`
                    ).join('\n');

                    // Format drawdown projections
                    const drawdownText = drawdownProjections.slice(0, 20).map(p => 
                      `  ${p.year}: Portfolio £${p.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Gross Withdrawal £${p.withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Tax -£${p.taxAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Net Withdrawal £${p.netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, State Pension £${p.statePensionAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Total Income £${p.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    ).join('\n');

                    const prompt = `I'm planning for retirement based on target pot value. Please analyze my situation and provide comprehensive feedback:

**Current Situation:**
- Current Age: ${currentAge} years
- Current HNWI Number: £${currentNetworth !== null ? currentNetworth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'} (based on ${previousMonth}/${previousYear})
- Retirement Target Pot: £${targetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Current Progress: ${currentNetworth !== null && currentNetworth > 0 ? ((currentNetworth / targetPot) * 100).toFixed(2) : '0.00'}% of target
- Current Year: ${currentYear}

**Growth Assumptions:**
- Average Return Rate: ${returnRate}% per year
- Withdrawal Rate: ${safeWithdrawalRate}% per year
- Inflation Rate: ${inflation}% per year
- Tax Rate: ${tax}% on portfolio withdrawals
- Retirement Age: ${retirementAge} years
- Death Age: ${deathAge} years
- State Pension: £${statePensionWeekly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/week (£${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year) - Note: State pension starts at retirement age (${retirementAge} years old), before that it is £0

**Timeline:**
- Current Age: ${currentAge} years
- Time to Target: ${timeToTarget}
- Target Year: ${targetYear}
- Retirement Year: ${retirementYear}
- Years to Retirement: ${retirementAge - currentAge} years
- Years in Retirement: ${deathAge - retirementAge} years

**Year-by-Year Growth Projections (to reach target):**
${projectionsText}
${projections.length > 15 ? `\n... and ${projections.length - 15} more years` : ''}

**Retirement Drawdown Projections (from retirement to death):**
Each year shows: Portfolio Value, Gross Withdrawal (before tax), Tax Amount, Net Withdrawal (after tax), State Pension (starts at retirement age), and Total Income (Net Withdrawal + State Pension)
${drawdownText}
${drawdownProjections.length > 20 ? `\n... and ${drawdownProjections.length - 20} more years` : ''}

**Please:**
1. Validate all the numbers and calculations - check if the mathematics are correct
2. Validate the dates and timeline - are the retirement age and death age calculations reasonable?
3. Evaluate if the metrics are sensible:
   - Is a ${returnRate}% annual return rate realistic for the portfolio?
   - Is a ${safeWithdrawalRate}% withdrawal rate appropriate?
   - Is ${inflation}% inflation rate reasonable for long-term planning?
   - Is ${tax}% tax rate on withdrawals realistic for retirement income?
   - Is retiring at age ${retirementAge} (in ${retirementAge - currentAge} years from now at age ${currentAge}) and planning to age ${deathAge} realistic?
   - Is the state pension amount of £${statePensionWeekly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/week accurate, and is the timing correct (starting at retirement age ${retirementAge})?
4. Assess the drawdown strategy - will the portfolio last until death age with the combined income from net portfolio withdrawals (after tax) and state pension? Note that state pension is £0 until retirement age ${retirementAge}, then it starts.
5. Provide actionable recommendations:
   - Should I adjust any of the assumptions?
   - Are there risks I should be aware of?
   - What changes would improve the plan?
   - Any alternative strategies I should consider?

Thank you for your comprehensive analysis!`;

                    try {
                      await navigator.clipboard.writeText(prompt);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 3000);
                    } catch (err) {
                      console.error('Failed to copy:', err);
                      alert('Failed to copy to clipboard. Please try again.');
                    }
                  }}
                  className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                      Ask AI
                    </>
                  )}
                </button>
              </div>

            </div>
          </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {/* Countdown Timer */}
          {countdown && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg text-white">
                <h2 className="text-xl font-semibold mb-4">Time to Target</h2>
                <div className="flex gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold">{countdown.years}</div>
                    <div className="text-sm opacity-90">Years</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold">{countdown.months}</div>
                    <div className="text-sm opacity-90">Months</div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold">{countdown.days}</div>
                    <div className="text-sm opacity-90">Days</div>
                  </div>
                </div>
              </div>
            )}

          {!countdown && currentNetworth !== null && currentNetworth > 0 && (
            <div className="mb-8 p-6 bg-yellow-500 rounded-lg text-white">
              <h2 className="text-xl font-semibold">Target Already Reached!</h2>
              <p className="mt-2">Your current networth exceeds your target pot.</p>
            </div>
          )}

          {/* Year by Year Projections */}
          <div>
            <div className="overflow-x-auto">
                <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Year
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Projected Pot Value
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {projections.map((projection) => (
                      <tr
                        key={projection.year}
                        className={projection.reached ? 'bg-green-50 dark:bg-green-900/20' : ''}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {projection.year}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          £{projection.potValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {projection.reached ? (
                            <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">
                              Target Reached
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full">
                              In Progress
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          {/* Drawdown Projections */}
          {drawdownProjections.length > 0 && (
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Retirement Drawdown Projection
                  </h2>
                  <button
                    onClick={async () => {
                      const currentDate = new Date();
                      const currentYear = currentDate.getFullYear();
                      const statePensionYearly = statePensionWeekly * 52;
                      
                      // Find retirement year and starting portfolio value
                      const targetYear = projections.find(p => p.reached)?.year;
                      const retirementYear = targetYear || currentYear;
                      const retirementAgeYear = currentYear + (retirementAge - currentAge);
                      const actualRetirementAge = currentAge + (retirementYear - currentYear);
                      const targetReachedProjection = projections.find(p => p.reached);
                      const startingPortfolioValue = targetReachedProjection ? targetReachedProjection.potValue || currentNetworth || 0 : currentNetworth || 0;
                      const baseWithdrawal = startingPortfolioValue * (safeWithdrawalRate / 100);
                      
                      // Format all drawdown projection data with detailed breakdown
                      const drawdownText = drawdownProjections.map((p, index) => {
                        const ageAtYear = currentAge + (p.year - currentYear);
                        const yearsSinceDrawdown = index;
                        const expectedWithdrawal = baseWithdrawal * Math.pow(1 + (inflation / 100), yearsSinceDrawdown);
                        const expectedTax = expectedWithdrawal * (tax / 100);
                        const expectedNet = expectedWithdrawal - expectedTax;
                        const yearsSincePensionStarted = ageAtYear >= retirementAge ? p.year - retirementAgeYear : -1;
                        const expectedPension = ageAtYear >= retirementAge ? statePensionYearly * Math.pow(1 + (inflation / 100), Math.max(0, yearsSincePensionStarted)) : 0;
                        
                        return `Year ${p.year} (Age ${ageAtYear}):
  - Portfolio Value (start of year): £${p.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  - Withdrawal Amount: £${p.withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Tax: -£${p.taxAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: -£${expectedTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Net Withdrawal: £${p.netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedNet.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - State Pension: £${p.statePensionAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedPension.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Total Income: £${p.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      }).join('\n\n');

                      const prompt = `I need you to VALIDATE THE MATHEMATICS of my retirement drawdown projection. Please check EVERY calculation against the formulas I provide below.

**ALL INPUT PARAMETERS:**
- Current Year: ${currentYear}
- Current Age: ${currentAge} years
- Retirement Age: ${retirementAge} years (state pension starts at this age)
- Death Age: ${deathAge} years
- Target Pot: £${targetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Current Networth (HNWI): £${currentNetworth ? currentNetworth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
- Return Rate (Portfolio Growth): ${returnRate}% per year
- Withdrawal Rate: ${safeWithdrawalRate}% per year (of starting portfolio value, adjusted for inflation)
- Inflation Rate: ${inflation}% per year
- Tax Rate: ${tax}% on portfolio withdrawals
- State Pension: £${statePensionWeekly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/week = £${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year

**RETIREMENT TIMELINE:**
- Target Pot Reached: Year ${retirementYear} (Age ${actualRetirementAge})
- Retirement Age Reached: Year ${retirementAgeYear} (Age ${retirementAge})
- Starting Portfolio Value at Drawdown: £${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Base Withdrawal Amount (Year 1): £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${safeWithdrawalRate}% of £${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Years in Drawdown: ${deathAge - actualRetirementAge} years

**CALCULATION FORMULAS (VERIFY EACH YEAR):**

For each year in the drawdown projection:
1. **Portfolio Value (start of year)**: This is the portfolio value at the BEGINNING of the year
2. **Portfolio Growth**: Portfolio Value × (1 + ${returnRate / 100}) = Portfolio Value × ${1 + (returnRate / 100)}
3. **Gross Withdrawal**: Base Withdrawal × (1 + ${inflation / 100})^years_since_drawdown_started
   - Year 0: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^0 = £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Year 1: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^1 = £${(baseWithdrawal * (1 + inflation / 100)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Year 2: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^2 = £${(baseWithdrawal * Math.pow(1 + inflation / 100, 2)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
4. **Tax Amount**: Gross Withdrawal × ${tax / 100}
5. **Net Withdrawal**: Gross Withdrawal - Tax Amount
6. **State Pension**: 
   - If age < ${retirementAge}: £0
   - If age >= ${retirementAge}: £${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^years_since_pension_started
   - Pension starts in year ${retirementAgeYear} (when age reaches ${retirementAge})
7. **Total Income**: Net Withdrawal + State Pension
8. **Portfolio Value (end of year)**: (Portfolio Value × (1 + ${returnRate / 100})) - Gross Withdrawal
   - This becomes the Portfolio Value (start of year) for the NEXT year

**DRAWDOWN PROJECTION DATA (VALIDATE EACH ROW):**

${drawdownText}

**YOUR TASK - VALIDATE THE MATHEMATICS:**

For EACH year in the projection above, please:
1. **Calculate the expected values** using the formulas above
2. **Compare** the calculated values with the actual values shown
3. **Identify any discrepancies** - if the numbers don't match, tell me exactly which year and which calculation is wrong
4. **Verify the logic**:
   - Does the portfolio growth calculation match? (Portfolio Value × ${1 + (returnRate / 100)})
   - Does the withdrawal amount match? (Base × (1 + ${inflation / 100})^years)
   - Does the tax calculation match? (Gross × ${tax / 100})
   - Does the state pension start at the correct age (${retirementAge})?
   - Does the state pension inflation adjustment start from the correct year (${retirementAgeYear})?
   - Does the portfolio value decrease correctly after withdrawal?

**ADDITIONAL ANALYSIS:**
- Is the portfolio sustainable? Will it last until death age ${deathAge}?
- Are the assumptions realistic? (${returnRate}% return, ${safeWithdrawalRate}% withdrawal rate, ${inflation}% inflation)
- Are there any red flags or concerns?
- What improvements would you suggest?

Please provide a detailed mathematical validation showing your calculations for at least the first 3 years, then confirm if the rest of the projection is correct.`;

                      try {
                        await navigator.clipboard.writeText(prompt);
                        setDrawdownCopied(true);
                        setTimeout(() => setDrawdownCopied(false), 3000);
                      } catch (err) {
                        console.error('Failed to copy:', err);
                        alert('Failed to copy to clipboard. Please try again.');
                      }
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                  >
                    {drawdownCopied ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        Ask AI
                      </>
                    )}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Year
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Portfolio Value
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Withdrawal Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Tax
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Net Withdrawal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          State Pension
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Total Income
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {drawdownProjections.map((projection) => (
                        <tr
                          key={projection.year}
                          className={projection.portfolioValue === 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                            {projection.year}
                          </td>
                          <td 
                            className={`px-6 py-4 whitespace-nowrap text-sm cursor-help ${
                              projection.portfolioValue === 0 
                                ? 'text-red-600 dark:text-red-400 font-semibold' 
                                : 'text-gray-900 dark:text-white'
                            }`}
                            onMouseEnter={(e) => {
                              if (projection.previousValue !== undefined && projection.growthAmount !== undefined) {
                                const previousVal = projection.previousValue;
                                const growth = projection.growthAmount;
                                const grossWithdrawal = projection.withdrawalAmount;
                                const taxAmt = projection.taxAmount;
                                const netWithdrawal = projection.netWithdrawal;
                                const statePension = projection.statePensionAmount;
                                const totalIncome = projection.totalIncome;
                                const finalVal = projection.portfolioValue;
                                
                                const tooltipText = `Portfolio Value Calculation (${projection.year}):\n\nStarting Value: £${previousVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nGrowth (${returnRate}%): +£${growth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nWithdrawal Amount: -£${grossWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nFinal Portfolio Value: £${finalVal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nTotal Income Breakdown:\nWithdrawal Amount: £${grossWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTax (${tax}%): -£${taxAmt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nNet Portfolio Withdrawal: £${netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nState Pension: £${statePension.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTotal Income: £${totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nFormula: (Starting × ${(1 + returnRate / 100).toFixed(4)}) - Gross Withdrawal = Final`;
                                
                                setDrawdownTooltip({
                                  x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                                  y: e.currentTarget.getBoundingClientRect().top - 10,
                                  text: tooltipText
                                });
                              }
                            }}
                            onMouseLeave={() => setDrawdownTooltip(null)}
                          >
                            £{projection.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            £{projection.withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400">
                            -£{projection.taxAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            £{projection.netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            £{projection.statePensionAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                            £{projection.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Retirement Summary Component
function RetirementSummary() {
  const [targetPot, setTargetPot] = useState<number>(2000000);
  const [returnRate, setReturnRate] = useState<number>(7);
  const [safeWithdrawalRate, setSafeWithdrawalRate] = useState<number>(4);
  const [inflation, setInflation] = useState<number>(3);
  const [tax, setTax] = useState<number>(20);
  const [currentAge, setCurrentAge] = useState<number>(44);
  const [retirementAge, setRetirementAge] = useState<number>(68);
  const [statePensionWeekly, setStatePensionWeekly] = useState<number>(221.20);
  const [deathAge, setDeathAge] = useState<number>(85);
  const [currentNetworth, setCurrentNetworth] = useState<number | null>(null);
  const [networthData, setNetworthData] = useState<NetworthReportData | null>(null);
  const [averageMonthlyCashflow, setAverageMonthlyCashflow] = useState<number | null>(null);
  const [cashflowIncrease, setCashflowIncrease] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<{ years: number; months: number; days: number } | null>(null);
  const [projections, setProjections] = useState<YearProjection[]>([]);
  const [combinedProjections, setCombinedProjections] = useState<YearProjection[]>([]);
  const [drawdownProjections, setDrawdownProjections] = useState<DrawdownProjection[]>([]);
  const [preRetirementData, setPreRetirementData] = useState<Array<{
    year: number;
    yearlyCashflow: number;
    portfolioValueWithoutCashflow: number;
    totalPortfolioValue: number;
    previousTotalPortfolioValue: number;
    growthAmount: number;
  }>>([]);
  const [postRetirementData, setPostRetirementData] = useState<Array<{
    year: number;
    portfolioValue: number;
    portfolioWithBusiness: number;
    withdrawalAmount: number;
    taxAmount: number;
    netWithdrawal: number;
    statePensionAmount: number;
    totalIncome: number;
    portfolioWithBusinessStart?: number;
    portfolioWithBusinessGrowth?: number;
    portfolioWithBusinessAfterGrowth?: number;
    businessCashflowThisYear?: number;
    portfolioWithBusinessFinal?: number;
  }>>([]);
  const [preRetirementTooltip, setPreRetirementTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [preRetirementCopied, setPreRetirementCopied] = useState(false);
  const [drawdownSummaryCopied, setDrawdownSummaryCopied] = useState(false);
  const [portfolioWithBusinessTooltip, setPortfolioWithBusinessTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [portfolioValueTooltip, setPortfolioValueTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  
  // Editable values for Summary tab
  const [currentHNWIInput, setCurrentHNWIInput] = useState<string>('');
  const [targetPotInput, setTargetPotInput] = useState<string>('');
  const [monthlyCashflowInput, setMonthlyCashflowInput] = useState<string>('');
  const [yearlyCashflowCalculated, setYearlyCashflowCalculated] = useState<number>(0);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth < 1) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }

  // Fetch settings on load
  useEffect(() => {
    const fetchSettings = async () => {
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
        
        setTargetPot(getSetting('retirement_target_pot', 2000000));
        setReturnRate(getSetting('retirement_return_rate', 7));
        setSafeWithdrawalRate(getSetting('retirement_withdrawal_rate', 4));
        setInflation(getSetting('retirement_inflation', 3));
        setTax(getSetting('retirement_tax', 20));
        setCurrentAge(getSetting('retirement_current_age', 44));
        setRetirementAge(getSetting('retirement_age', 68));
        setStatePensionWeekly(getSetting('retirement_state_pension_weekly', 221.20));
        setDeathAge(getSetting('retirement_death_age', 85));
        setCashflowIncrease(getSetting('retirement_cashflow_increase', 5));
        
        // Initialize target pot input
        setTargetPotInput(getSetting('retirement_target_pot', 2000000).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        
        setSettingsLoaded(true);
      } catch (err: any) {
        console.error('Error fetching settings:', err);
        // Use defaults if settings fetch fails
        setSettingsLoaded(true);
      }
    };
    fetchSettings();
  }, []);

  // Fetch HNWI data (same as RetirementByTargetPot)
  useEffect(() => {
    const fetchNetworth = async () => {
      try {
        const response = await fetch(`/api/networth-report?year=${previousYear}`);
        if (!response.ok) throw new Error('Failed to fetch networth report');
        const data = await response.json();
        setNetworthData(data);
        
        const monthTotals = data.monthData[previousMonth] || {};
        let hnwiValue = 0;
        
        let hnwiCategory = data.categories.find((cat: string) => {
          const catLower = cat.toLowerCase().trim();
          return catLower.includes('hnwi') || catLower.includes('high net worth');
        });
        
        if (!hnwiCategory && data.categoryRules) {
          const networthCategoryName = data.categories.find((cat: string) => {
            const catLower = cat.toLowerCase().trim();
            return catLower.includes('networth') || catLower.includes('net worth');
          });
          
          if (networthCategoryName && data.categoryRules[networthCategoryName]) {
            const rule = data.categoryRules[networthCategoryName] as string;
            const parts = rule.split('+').map(s => s.trim());
            if (parts.length === 2) {
              hnwiCategory = parts[1];
            }
          }
        }
        
        if (hnwiCategory && monthTotals[hnwiCategory] !== undefined) {
          hnwiValue = monthTotals[hnwiCategory] || 0;
        } else {
          const networthCategory = data.categories.find((cat: string) => {
            const catLower = cat.toLowerCase().trim();
            return catLower.includes('networth') || catLower.includes('net worth');
          });
          if (networthCategory) {
            hnwiValue = monthTotals[networthCategory] || 0;
          }
        }
        
        setCurrentNetworth(hnwiValue);
        // Initialize HNWI input
        if (hnwiValue > 0) {
          setCurrentHNWIInput(hnwiValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        }
      } catch (err: any) {
        console.error('Error fetching networth:', err);
        setError('Failed to load networth data');
      }
    };
    fetchNetworth();
  }, [previousYear, previousMonth]);

  // Fetch cashflow data (same as RetirementByCashflow)
  useEffect(() => {
    const fetchCashflow = async () => {
      try {
        const currentYearResponse = await fetch(`/api/income-entries?year=${currentYear}`);
        const prevYearResponse = await fetch(`/api/income-entries?year=${currentYear - 1}`);
        
        if (!currentYearResponse.ok || !prevYearResponse.ok) {
          throw new Error('Failed to fetch income entries');
        }
        
        const currentYearData = await currentYearResponse.json();
        const prevYearData = await prevYearResponse.json();
        
        const typesResponse = await fetch('/api/income-types');
        const sourcesResponse = await fetch('/api/income-sources');
        
        if (!typesResponse.ok || !sourcesResponse.ok) {
          throw new Error('Failed to fetch income types/sources');
        }
        
        const typesData = await typesResponse.json();
        const sourcesData = await sourcesResponse.json();
        
        const businessIncomeTypes = typesData.data.filter((type: any) => type.isbusinessincome === true);
        const incomeSources = sourcesData.data || [];
        const allEntries = [...currentYearData.data, ...prevYearData.data];
        
        const getEntry = (sourceId: number, month: number, year: number) => {
          return allEntries.find(
            (entry: any) => entry.income_source_id === sourceId && 
            parseInt(entry.month.toString()) === month &&
            parseInt(entry.year.toString()) === year
          );
        };
        
        const getMonthlyTotal = (month: number, year: number) => {
          let total = 0;
          let hasAnyEntry = false;
          
          businessIncomeTypes.forEach((type: any) => {
            const sources = incomeSources.filter((s: any) => s.income_type_id === type.id);
            sources.forEach((source: any) => {
              const entry = getEntry(source.id, month, year);
              if (entry) {
                hasAnyEntry = true;
                if (entry.account_id && entry.current_month_balance !== null && entry.current_month_balance !== undefined && entry.previous_month_balance !== null && entry.previous_month_balance !== undefined) {
                  const current = parseFloat(entry.current_month_balance.toString());
                  const previous = parseFloat(entry.previous_month_balance.toString());
                  total += (current - previous);
                } else {
                  total += parseFloat(entry.price.toString());
                }
              }
            });
          });
          
          return hasAnyEntry ? total : null;
        };
        
        let month1 = currentMonth - 1;
        let month2 = currentMonth - 2;
        let year1 = currentYear;
        let year2 = currentYear;
        
        if (month1 < 1) {
          month1 = 12;
          year1 = currentYear - 1;
        }
        if (month2 < 1) {
          month2 = 12;
          year2 = currentYear - 1;
        }
        
        const month1Total = getMonthlyTotal(month1, year1);
        const month2Total = getMonthlyTotal(month2, year2);
        
        const validTotals: number[] = [];
        if (month1Total !== null && month1Total > 0) validTotals.push(month1Total);
        if (month2Total !== null && month2Total > 0) validTotals.push(month2Total);
        
        if (validTotals.length > 0) {
          const average = validTotals.reduce((sum, val) => sum + val, 0) / validTotals.length;
          setAverageMonthlyCashflow(average);
          setMonthlyCashflowInput(average.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setYearlyCashflowCalculated(average * 12);
        } else {
          setAverageMonthlyCashflow(null);
        }
      } catch (err: any) {
        console.error('Error fetching cashflow:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCashflow();
  }, [currentYear, currentMonth]);

  // Calculate projections with business cashflow (Column 3)
  useEffect(() => {
    if (currentNetworth === null || currentNetworth <= 0) {
      setCountdown(null);
      setProjections([]);
      setCombinedProjections([]);
      return;
    }

    const annualGrowthRate = returnRate / 100;
    const yearlyCashflow = yearlyCashflowCalculated > 0 ? yearlyCashflowCalculated : (averageMonthlyCashflow ? averageMonthlyCashflow * 12 : 0);
    
    let yearsToTarget = 0;
    let projectedValue = currentNetworth;
    
    const projectionList: YearProjection[] = [];
    const combinedProjectionList: YearProjection[] = [];
    const maxYears = 100;
    
    // Calculate retirement year based on current age and retirement age
    const retirementYear = currentYear + (retirementAge - currentAge);
    
    for (let year = currentYear; year <= currentYear + maxYears; year++) {
      // Standard projection (Column 1) - just growth
      const standardValue = currentNetworth * Math.pow(1 + annualGrowthRate, year - currentYear);
      
      // Combined projection (Column 3) - growth + cashflow contributions
      // Only add cashflow until retirement age
      if (year === currentYear) {
        projectedValue = currentNetworth;
      } else {
        // Previous year value grows
        projectedValue = projectedValue * (1 + annualGrowthRate);
        // Add cashflow only if before retirement age
        if (year < retirementYear) {
          projectedValue = projectedValue + yearlyCashflow;
        }
      }
      
      // Standard projection
      if (standardValue >= targetPot && !projectionList.find(p => p.reached)) {
        yearsToTarget = year - currentYear;
        projectionList.push({
          year,
          potValue: standardValue,
          reached: true,
        });
      } else if (!projectionList.find(p => p.reached)) {
        projectionList.push({
          year,
          potValue: standardValue,
          reached: false,
        });
      }
      
      // Combined projection
      if (projectedValue >= targetPot && !combinedProjectionList.find(p => p.reached)) {
        combinedProjectionList.push({
          year,
          potValue: projectedValue,
          reached: true,
        });
      } else if (!combinedProjectionList.find(p => p.reached)) {
        combinedProjectionList.push({
          year,
          potValue: projectedValue,
          reached: false,
        });
      }
    }
    
    setProjections([...projectionList].reverse());
    setCombinedProjections([...combinedProjectionList].reverse());
  }, [currentNetworth, targetPot, returnRate, currentYear, averageMonthlyCashflow, currentAge, retirementAge]);

  // Calculate drawdown for combined projection
  useEffect(() => {
    if (!deathAge || !retirementAge || preRetirementData.length === 0) {
      setDrawdownProjections([]);
      return;
    }
    
    // Find the year when target was reached (or use the last year in pre-retirement data)
    const targetReachedData = preRetirementData.find(p => p.totalPortfolioValue >= targetPot);
    const retirementYear = targetReachedData ? targetReachedData.year : preRetirementData[preRetirementData.length - 1]?.year;
    
    if (!retirementYear) {
      setDrawdownProjections([]);
      return;
    }
    
    // Calculate actual retirement age at the year target was reached
    const actualRetirementAge = currentAge + (retirementYear - currentYear);
    
    if (actualRetirementAge >= deathAge) {
      setDrawdownProjections([]);
      return;
    }

    const drawdownList: DrawdownProjection[] = [];
    const annualReturnRate = returnRate / 100;
    const withdrawalRate = safeWithdrawalRate / 100;
    const inflationRate = inflation / 100;
    const taxRate = tax / 100;
    
    const statePensionYearly = statePensionWeekly * 52;
    const yearlyCashflow = yearlyCashflowCalculated > 0 ? yearlyCashflowCalculated : (averageMonthlyCashflow ? averageMonthlyCashflow * 12 : 0);
    
    // Get the Total Portfolio Value at retirement year from pre-retirement data
    const retirementData = preRetirementData.find(p => p.year === retirementYear);
    let portfolioValue = retirementData ? retirementData.totalPortfolioValue : (preRetirementData[preRetirementData.length - 1]?.totalPortfolioValue || targetPot);
    const baseWithdrawal = portfolioValue * withdrawalRate;
    const yearsInRetirement = deathAge - actualRetirementAge;
    
    // Get the yearly cashflow from the retirement year (when target was reached) as baseline for business income
    const baselineYearlyCashflow = retirementData ? retirementData.yearlyCashflow : (preRetirementData[preRetirementData.length - 1]?.yearlyCashflow || 0);
    const cashflowIncreaseRate = cashflowIncrease / 100;
    
    // Portfolio with business starts at the same value as portfolio value
    let portfolioWithBusiness = portfolioValue;
    
    // Calculate the year when retirement age is reached
    const retirementAgeYear = currentYear + (retirementAge - currentAge);
    
    for (let i = 0; i <= yearsInRetirement; i++) {
      const year = retirementYear + i;
      
      // Portfolio Value starts from the calculated portfolioValue (without business cashflow)
      // This ensures the base portfolio calculation is correct
      const startingValue = portfolioValue; // Always use the calculated portfolioValue
      const startingValueWithBusiness = portfolioWithBusiness; // Portfolio with business at the start of the year
      
      const withdrawalAmount = baseWithdrawal * Math.pow(1 + inflationRate, i);
      const taxAmount = withdrawalAmount * taxRate;
      const netWithdrawal = withdrawalAmount - taxAmount;
      
      const ageAtYear = currentAge + (year - currentYear);
      // State pension starts at retirement age, inflation adjustment is based on years since pension started
      const yearsSincePensionStarted = ageAtYear >= retirementAge ? year - retirementAgeYear : -1;
      const statePensionAmount = ageAtYear >= retirementAge 
        ? statePensionYearly * Math.pow(1 + inflationRate, Math.max(0, yearsSincePensionStarted)) 
        : 0;
      
      // Calculate business cashflow for this year
      // Business cashflow grows at cashflowIncrease rate until retirement age, then stays constant
      const yearsSinceRetirement = year - retirementYear;
      const yearsUntilRetirementAge = retirementAgeYear - retirementYear;
      
      // If we haven't reached retirement age yet, continue growing
      // If we've reached retirement age, use the value at retirement age (constant)
      let businessCashflowThisYear;
      if (year < retirementAgeYear) {
        // Still growing: baseline * (1 + growth rate)^years_since_retirement
        businessCashflowThisYear = baselineYearlyCashflow * Math.pow(1 + cashflowIncreaseRate, yearsSinceRetirement);
      } else {
        // Reached retirement age: use the value at retirement age (stops growing)
        const cashflowAtRetirementAge = baselineYearlyCashflow * Math.pow(1 + cashflowIncreaseRate, yearsUntilRetirementAge);
        businessCashflowThisYear = cashflowAtRetirementAge;
      }
      
      // Total income is only net withdrawal + state pension (business cashflow is added to portfolio, not income)
      const totalIncome = netWithdrawal + statePensionAmount;
      
      const growthAmount = startingValue * annualReturnRate;
      // Calculate portfolio value after growth and withdrawal for next year
      // This is the base portfolio value (without business cashflow)
      portfolioValue = startingValue * (1 + annualReturnRate) - withdrawalAmount;
      
      if (portfolioValue < 0) {
        portfolioValue = 0;
      }
      
      // Calculate growth on portfolio with business
      const growthAmountWithBusiness = startingValueWithBusiness * annualReturnRate;
      const portfolioAfterGrowth = startingValueWithBusiness * (1 + annualReturnRate);
      
      // Portfolio with business: grows, adds business cashflow, then subtracts withdrawal
      portfolioWithBusiness = portfolioAfterGrowth + businessCashflowThisYear - withdrawalAmount;
      
      if (portfolioWithBusiness < 0) {
        portfolioWithBusiness = 0;
      }
      
      drawdownList.push({
        year,
        portfolioValue: portfolioValue, // Show ENDING value for this year (after growth and withdrawal) - this makes it clearer if portfolio is growing or shrinking
        portfolioWithBusiness: portfolioWithBusiness, // Show FINAL value (after growth, business cashflow, and withdrawal)
        withdrawalAmount,
        taxAmount,
        netWithdrawal,
        statePensionAmount,
        totalIncome,
        previousValue: startingValue,
        growthAmount,
        // Store calculation details for tooltip
        portfolioWithBusinessStart: startingValueWithBusiness,
        portfolioWithBusinessGrowth: growthAmountWithBusiness,
        portfolioWithBusinessAfterGrowth: portfolioAfterGrowth,
        businessCashflowThisYear: businessCashflowThisYear,
        portfolioWithBusinessFinal: portfolioWithBusiness,
      });
    }
    
    setDrawdownProjections(drawdownList);
  }, [combinedProjections, targetPot, returnRate, safeWithdrawalRate, inflation, tax, currentAge, retirementAge, statePensionWeekly, deathAge, currentYear, averageMonthlyCashflow, yearlyCashflowCalculated, cashflowIncrease, preRetirementData]);

  // Calculate pre-retirement data with cashflow
  useEffect(() => {
    if (currentNetworth === null || currentNetworth <= 0 || averageMonthlyCashflow === null) {
      setPreRetirementData([]);
      return;
    }

    const annualGrowthRate = returnRate / 100;
    const cashflowIncreaseRate = cashflowIncrease / 100;
    const retirementYear = currentYear + (retirementAge - currentAge);
    
    let portfolioValueWithoutCashflow = currentNetworth;
    let totalPortfolioValue = currentNetworth;
    let previousTotalPortfolioValue = currentNetworth;
    let currentMonthlyCashflow = averageMonthlyCashflow;
    const preRetirement: Array<{
      year: number;
      yearlyCashflow: number;
      portfolioValueWithoutCashflow: number;
      totalPortfolioValue: number;
      previousTotalPortfolioValue: number;
      growthAmount: number;
    }> = [];
    
    // Calculate years from current to retirement age
    const yearsToRetirement = retirementAge - currentAge;
    for (let i = 0; i <= yearsToRetirement; i++) {
      const year = currentYear + i;
      
      if (i === 0) {
        // Current year - use average monthly cashflow
        const yearlyCashflow = currentMonthlyCashflow * 12;
        preRetirement.push({
          year,
          yearlyCashflow,
          portfolioValueWithoutCashflow: portfolioValueWithoutCashflow,
          totalPortfolioValue: totalPortfolioValue,
          previousTotalPortfolioValue: previousTotalPortfolioValue,
          growthAmount: 0, // No growth in current year
        });
        
        // Check if target is already reached in current year
        if (totalPortfolioValue >= targetPot) {
          break;
        }
      } else {
        // Future years - cashflow increases
        currentMonthlyCashflow = currentMonthlyCashflow * (1 + cashflowIncreaseRate);
        const yearlyCashflow = currentMonthlyCashflow * 12;
        
        // Store previous value before calculations
        previousTotalPortfolioValue = totalPortfolioValue;
        
        // Portfolio value without cashflow (just growth)
        portfolioValueWithoutCashflow = portfolioValueWithoutCashflow * (1 + annualGrowthRate);
        
        // Calculate growth amount
        const growthAmount = totalPortfolioValue * annualGrowthRate;
        
        // Total portfolio value (cumulative: previous total + growth + new cashflow)
        totalPortfolioValue = totalPortfolioValue * (1 + annualGrowthRate) + yearlyCashflow;
        
        preRetirement.push({
          year,
          yearlyCashflow,
          portfolioValueWithoutCashflow,
          totalPortfolioValue,
          previousTotalPortfolioValue,
          growthAmount,
        });
        
        // Stop calculating once target is reached
        if (totalPortfolioValue >= targetPot) {
          break;
        }
      }
    }
    
    setPreRetirementData(preRetirement);
    
    // Calculate countdown based on Total Portfolio Value reaching target
    if (preRetirement.length > 0) {
      const targetReached = preRetirement.find(p => p.totalPortfolioValue >= targetPot);
      
      if (targetReached) {
        const targetYear = targetReached.year;
        const targetDate = new Date(targetYear, 0, 1); // January 1st of target year
        
        const today = new Date();
        const diffTime = targetDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          const years = Math.floor(diffDays / 365.25);
          const remainingDays = diffDays - (years * 365.25);
          const months = Math.floor(remainingDays / 30.44);
          const days = Math.ceil(remainingDays - (months * 30.44));
          
          let finalYears = years;
          let finalMonths = months;
          let finalDays = days;
          
          if (finalDays >= 30) {
            finalMonths += Math.floor(finalDays / 30);
            finalDays = finalDays % 30;
          }
          
          if (finalMonths >= 12) {
            finalYears += Math.floor(finalMonths / 12);
            finalMonths = finalMonths % 12;
          }
          
          setCountdown({ years: Math.max(0, finalYears), months: Math.max(0, finalMonths), days: Math.max(0, finalDays) });
        } else {
          setCountdown({ years: 0, months: 0, days: 0 });
        }
      } else {
        setCountdown(null);
      }
    } else {
      setCountdown(null);
    }
  }, [currentNetworth, returnRate, currentYear, currentAge, retirementAge, averageMonthlyCashflow, cashflowIncrease, targetPot]);

  // Calculate post-retirement data (drawdown)
  useEffect(() => {
    const postRetirement: Array<{
      year: number;
      portfolioValue: number;
      portfolioWithBusiness: number;
      withdrawalAmount: number;
      taxAmount: number;
      netWithdrawal: number;
      statePensionAmount: number;
      totalIncome: number;
      portfolioWithBusinessStart?: number;
      portfolioWithBusinessGrowth?: number;
      portfolioWithBusinessAfterGrowth?: number;
      businessCashflowThisYear?: number;
      portfolioWithBusinessFinal?: number;
    }> = [];
    
    drawdownProjections.forEach(d => {
      postRetirement.push({
        year: d.year,
        portfolioValue: d.portfolioValue,
        portfolioWithBusiness: d.portfolioWithBusiness || d.portfolioValue,
        withdrawalAmount: d.withdrawalAmount,
        taxAmount: d.taxAmount,
        netWithdrawal: d.netWithdrawal,
        statePensionAmount: d.statePensionAmount,
        totalIncome: d.totalIncome,
        portfolioWithBusinessStart: d.portfolioWithBusinessStart,
        portfolioWithBusinessGrowth: d.portfolioWithBusinessGrowth,
        portfolioWithBusinessAfterGrowth: d.portfolioWithBusinessAfterGrowth,
        businessCashflowThisYear: d.businessCashflowThisYear,
        portfolioWithBusinessFinal: d.portfolioWithBusinessFinal,
      });
    });
    
    setPostRetirementData(postRetirement);
  }, [drawdownProjections]);

  if (loading || !settingsLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  const yearlyCashflow = averageMonthlyCashflow ? averageMonthlyCashflow * 12 : 0;

  return (
    <div className="space-y-6">
      {/* Tooltip */}
      {preRetirementTooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none whitespace-pre-line"
          style={{
            left: `${preRetirementTooltip.x}px`,
            top: `${preRetirementTooltip.y}px`,
            transform: 'translate(-50%, -100%)'
          }}
        >
          {preRetirementTooltip.text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
        </div>
      )}
      {portfolioWithBusinessTooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none whitespace-pre-line max-w-md"
          style={{
            left: `${portfolioWithBusinessTooltip.x}px`,
            top: `${portfolioWithBusinessTooltip.y}px`,
          }}
        >
          {portfolioWithBusinessTooltip.text}
        </div>
      )}
      {portfolioValueTooltip && (
        <div
          className="fixed z-50 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded shadow-lg pointer-events-none whitespace-pre-line max-w-md"
          style={{
            left: `${portfolioValueTooltip.x}px`,
            top: `${portfolioValueTooltip.y}px`,
          }}
        >
          {portfolioValueTooltip.text}
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Column 1: Retirement by Target Pot Data */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Retirement by Target Pot
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Current HNWI Number</label>
            <input
              type="text"
              value={currentHNWIInput ? `£${currentHNWIInput}` : ''}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setCurrentHNWIInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setCurrentNetworth(numValue);
              }}
              onBlur={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setCurrentHNWIInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setCurrentNetworth(numValue);
              }}
              className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full mt-1 px-2 py-1"
            />
          </div>
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Target Pot</label>
            <input
              type="text"
              value={targetPotInput ? `£${targetPotInput}` : ''}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setTargetPotInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setTargetPot(numValue);
              }}
              onBlur={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setTargetPotInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setTargetPot(numValue);
              }}
              className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full mt-1 px-2 py-1"
            />
          </div>
        </div>
        {/* Reload Button */}
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() => {
              // Set reloading state for visual feedback
              setReloading(true);
              
              // Parse values from inputs
              const hnwiValue = parseFloat(currentHNWIInput.replace(/[£,\s]/g, '')) || currentNetworth || 0;
              const targetPotValue = parseFloat(targetPotInput.replace(/[£,\s]/g, '')) || targetPot;
              const monthlyCashflowValue = parseFloat(monthlyCashflowInput.replace(/[£,\s]/g, '')) || (averageMonthlyCashflow || 0);
              
              // Update state values directly - React will trigger useEffect hooks based on dependencies
              setCurrentNetworth(hnwiValue);
              setTargetPot(targetPotValue);
              setAverageMonthlyCashflow(monthlyCashflowValue);
              setYearlyCashflowCalculated(monthlyCashflowValue * 12);
              
              // Reset reloading state after a brief delay
              setTimeout(() => {
                setReloading(false);
              }, 300);
            }}
            className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-150 font-medium text-sm flex items-center justify-center gap-2 ${
              reloading ? 'scale-95 shadow-inner' : 'scale-100 shadow-md'
            }`}
          >
            <svg 
              className={`w-5 h-5 transition-transform duration-150 ${reloading ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {reloading ? 'Reloading...' : 'Reload'}
          </button>
        </div>
      </div>

      {/* Column 2: Cashflow Income */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Cashflow Income
        </h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-500 dark:text-gray-400">Monthly Cashflow</label>
            <input
              type="text"
              value={monthlyCashflowInput ? `£${monthlyCashflowInput}` : ''}
              onChange={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setMonthlyCashflowInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setAverageMonthlyCashflow(numValue);
                setYearlyCashflowCalculated(numValue * 12);
              }}
              onBlur={(e) => {
                const cleaned = e.target.value.replace(/[£,\s]/g, '');
                const numValue = parseFloat(cleaned) || 0;
                setMonthlyCashflowInput(numValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                setAverageMonthlyCashflow(numValue);
                setYearlyCashflowCalculated(numValue * 12);
              }}
              className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none w-full mt-1 px-2 py-1"
            />
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Cashflow Income</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              £{yearlyCashflowCalculated.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Column 3: Combined Retirement Calculations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Combined Retirement
        </h2>
        <div className="space-y-3 flex-grow">
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Annual Portfolio Income</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {currentNetworth !== null
                ? `£${(currentNetworth * (returnRate / 100)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'N/A'}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              ({returnRate}% of £{currentNetworth !== null ? currentNetworth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'})
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Yearly Business Cashflow</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              £{yearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Yearly Income</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">
              {currentNetworth !== null
                ? `£${(currentNetworth * (returnRate / 100) + yearlyCashflow).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : 'N/A'}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Portfolio Income + Yearly Business Cashflow
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Pre-Retirement Table */}
      {preRetirementData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Pre-Retirement Projection
            </h2>
            <button
              onClick={async () => {
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const currentMonth = currentDate.getMonth() + 1;
                
                // Calculate previous month
                let previousMonth = currentMonth - 1;
                let previousYear = currentYear;
                if (previousMonth < 1) {
                  previousMonth = 12;
                  previousYear = currentYear - 1;
                }

                // Get data from the three columns
                const currentHNWI = currentNetworth !== null ? currentNetworth : 0;
                const targetPotValue = targetPot;
                const timeToTarget = countdown 
                  ? `${countdown.years} years, ${countdown.months} months, ${countdown.days} days`
                  : 'N/A';
                
                const monthlyCashflow = averageMonthlyCashflow || 0;
                const yearlyCashflowValue = monthlyCashflow * 12;
                const cashflowIncreasePercent = cashflowIncrease;
                
                // Format pre-retirement data
                const preRetirementText = preRetirementData.map(p => 
                  `  ${p.year}: Cashflow Income £${p.yearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Portfolio Value (without cashflow) £${p.portfolioValueWithoutCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, Total Portfolio Value £${p.totalPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ).join('\n');

                // Find target reached year
                const targetReached = preRetirementData.find(p => p.totalPortfolioValue >= targetPot);
                const targetYear = targetReached ? targetReached.year : 'Not reached';

                const prompt = `I'm planning for retirement using a combined approach with business cashflow. Please analyze my pre-retirement projection and provide comprehensive feedback:

**Input Parameters:**

**Column 1 - Retirement by Target Pot:**
- Current HNWI Number: £${currentHNWI.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (based on ${previousMonth}/${previousYear})
- Target Pot: £${targetPotValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Time to Target: ${timeToTarget}
- Return Rate: ${returnRate}% per year
- Current Age: ${currentAge} years
- Retirement Age: ${retirementAge} years

**Column 2 - Cashflow Income:**
- Average Monthly Cashflow: £${monthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Cashflow Income: £${yearlyCashflowValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Cashflow Increase: ${cashflowIncreasePercent}% per year

**Column 3 - Combined Retirement:**
- Starting Value: £${currentHNWI.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Yearly Business Cashflow: £${yearlyCashflowValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Time to Target (with cashflow): ${timeToTarget}

**Pre-Retirement Projection Data:**
Each year shows: Year, Cashflow Income, Portfolio Value (without cashflow contributions), Total Portfolio Value (cumulative with cashflow)
${preRetirementText}

**Target Achievement:**
- Target Pot: £${targetPotValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Target Reached Year: ${targetYear}
${targetReached ? `- Total Portfolio Value at Target: £${targetReached.totalPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}

**Calculation Logic:**
- Portfolio Value (without cashflow) = Previous Portfolio Value × (1 + ${returnRate}%)
- Total Portfolio Value = Previous Total Portfolio Value × (1 + ${returnRate}%) + Cashflow Income
- Cashflow Income increases by ${cashflowIncreasePercent}% each year
- Projection stops when Total Portfolio Value reaches or exceeds the Target Pot

**Please:**
1. Validate all the numbers and calculations - check if the mathematics are correct for each year
2. Verify the calculation logic:
   - Is the Portfolio Value (without cashflow) calculation correct?
   - Is the Total Portfolio Value calculation correct (cumulative with cashflow)?
   - Is the cashflow increase applied correctly each year?
3. Evaluate if the metrics are sensible:
   - Is a ${returnRate}% annual return rate realistic?
   - Is a ${cashflowIncreasePercent}% annual cashflow increase realistic?
   - Is the target pot of £${targetPotValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} appropriate?
   - Is retiring at age ${retirementAge} (in ${retirementAge - currentAge} years from now at age ${currentAge}) realistic?
4. Assess the timeline:
   - Is reaching the target in ${timeToTarget} realistic given the starting value and assumptions?
   - Are there any risks or concerns with the projection?
5. Provide actionable recommendations:
   - Should I adjust any of the assumptions (return rate, cashflow increase, target pot)?
   - Are there risks I should be aware of?
   - What changes would improve the plan?
   - Any alternative strategies I should consider?
   - How can I reach the target faster or more reliably?

Thank you for your comprehensive analysis!`;

                try {
                  await navigator.clipboard.writeText(prompt);
                  setPreRetirementCopied(true);
                  setTimeout(() => setPreRetirementCopied(false), 3000);
                } catch (err) {
                  console.error('Failed to copy:', err);
                  alert('Failed to copy to clipboard. Please try again.');
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              {preRetirementCopied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Ask AI
                </>
              )}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Cashflow Income
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Portfolio Value
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Portfolio Value
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {preRetirementData.map((data) => {
                  const ageAtYear = currentAge + (data.year - currentYear);
                  return (
                  <tr key={data.year}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center">
                      {data.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      {ageAtYear}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      £{(data.yearlyCashflow || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      £{(data.portfolioValueWithoutCashflow || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-center cursor-help"
                      onMouseEnter={(e) => {
                        const previousValue = data.previousTotalPortfolioValue || currentNetworth || 0;
                        const growthAmount = data.growthAmount || 0;
                        const yearlyCashflow = data.yearlyCashflow || 0;
                        const finalValue = data.totalPortfolioValue || 0;
                        const isFirstYear = data.year === currentYear;
                        
                        let tooltipText;
                        if (isFirstYear) {
                          tooltipText = `Total Portfolio Value (${data.year}):\n\nStarting Portfolio Value: £${previousValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nCashflow Income: £${yearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nNote: This is the starting value. Growth and cashflow contributions will be applied in subsequent years.`;
                        } else {
                          tooltipText = `Total Portfolio Value Calculation (${data.year}):\n\nPrevious Total Portfolio Value: £${previousValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nGrowth (${returnRate}%): +£${growthAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nCashflow Income: +£${yearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nTotal Portfolio Value: £${finalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nCalculation:\n£${previousValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${returnRate}%) + £${yearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n= £${finalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        
                        setPreRetirementTooltip({
                          x: e.currentTarget.getBoundingClientRect().left + e.currentTarget.offsetWidth / 2,
                          y: e.currentTarget.getBoundingClientRect().top - 10,
                          text: tooltipText
                        });
                      }}
                      onMouseLeave={() => setPreRetirementTooltip(null)}
                    >
                      £{(data.totalPortfolioValue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Post-Retirement Table */}
      {postRetirementData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Retirement Drawdown Projection
            </h2>
            <button
              onClick={async () => {
                const currentDate = new Date();
                const currentYear = currentDate.getFullYear();
                const statePensionYearly = statePensionWeekly * 52;
                
                // Find retirement year and starting portfolio value
                const targetReachedData = preRetirementData.find(p => p.totalPortfolioValue >= targetPot);
                const retirementYear = targetReachedData ? targetReachedData.year : (preRetirementData.length > 0 ? preRetirementData[preRetirementData.length - 1].year : currentYear);
                const retirementAgeYear = currentYear + (retirementAge - currentAge);
                const startingPortfolioValue = targetReachedData ? targetReachedData.totalPortfolioValue : (preRetirementData.length > 0 ? preRetirementData[preRetirementData.length - 1].totalPortfolioValue : 0);
                const actualRetirementAge = currentAge + (retirementYear - currentYear);
                const baseWithdrawal = startingPortfolioValue * (safeWithdrawalRate / 100);
                
                // Get baseline yearly cashflow for business income
                const retirementData = preRetirementData.find(p => p.year === retirementYear);
                const baselineYearlyCashflow = retirementData ? retirementData.yearlyCashflow : (preRetirementData[preRetirementData.length - 1]?.yearlyCashflow || 0);
                
                // Format all post-retirement drawdown projection data with detailed breakdown
                const drawdownText = postRetirementData.map((p, index) => {
                  const ageAtYear = currentAge + (p.year - currentYear);
                  const yearsSinceDrawdown = index;
                  const expectedWithdrawal = baseWithdrawal * Math.pow(1 + (inflation / 100), yearsSinceDrawdown);
                  const expectedTax = expectedWithdrawal * (tax / 100);
                  const expectedNet = expectedWithdrawal - expectedTax;
                  const yearsSincePensionStarted = ageAtYear >= retirementAge ? p.year - retirementAgeYear : -1;
                  const expectedPension = ageAtYear >= retirementAge ? statePensionYearly * Math.pow(1 + (inflation / 100), Math.max(0, yearsSincePensionStarted)) : 0;
                  
                  // Calculate expected business cashflow
                  const yearsSinceRetirement = p.year - retirementYear;
                  const expectedBusinessCashflow = baselineYearlyCashflow * Math.pow(1 + (cashflowIncrease / 100), yearsSinceRetirement);
                  
                  // Calculate expected portfolio with business
                  const prevPortfolioWithBusiness = index === 0 ? startingPortfolioValue : (postRetirementData[index - 1]?.portfolioWithBusinessFinal || startingPortfolioValue);
                  const expectedPortfolioWithBusinessGrowth = prevPortfolioWithBusiness * (returnRate / 100);
                  const expectedPortfolioWithBusinessAfterGrowth = prevPortfolioWithBusiness * (1 + returnRate / 100);
                  const expectedPortfolioWithBusinessFinal = expectedPortfolioWithBusinessAfterGrowth + expectedBusinessCashflow - expectedWithdrawal;
                  
                  return `Year ${p.year} (Age ${ageAtYear}):
  - Portfolio Value (start of year): £${p.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  - Portfolio with Business (start of year): £${p.portfolioWithBusiness.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  - Withdrawal Amount: £${p.withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Tax: -£${p.taxAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: -£${expectedTax.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Net Withdrawal: £${p.netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedNet.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - State Pension: £${p.statePensionAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedPension.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Business Cashflow: £${(p.businessCashflowThisYear || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Expected: £${expectedBusinessCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
  - Total Income: £${p.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                }).join('\n\n');

                const prompt = `I need you to VALIDATE THE MATHEMATICS of my retirement drawdown projection. Please check EVERY calculation against the formulas I provide below.

**ALL INPUT PARAMETERS:**
- Current Year: ${currentYear}
- Current Age: ${currentAge} years
- Retirement Age: ${retirementAge} years (state pension starts at this age)
- Death Age: ${deathAge} years
- Target Pot: £${targetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Current Networth (HNWI): £${currentNetworth ? currentNetworth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
- Average Monthly Cashflow: £${averageMonthlyCashflow ? averageMonthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'}
- Cashflow Increase Rate: ${cashflowIncrease}% per year
- Return Rate (Portfolio Growth): ${returnRate}% per year
- Withdrawal Rate: ${safeWithdrawalRate}% per year (of starting portfolio value, adjusted for inflation)
- Inflation Rate: ${inflation}% per year
- Tax Rate: ${tax}% on portfolio withdrawals
- State Pension: £${statePensionWeekly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/week = £${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/year

**RETIREMENT TIMELINE:**
- Target Pot Reached: Year ${retirementYear} (Age ${actualRetirementAge})
- Retirement Age Reached: Year ${retirementAgeYear} (Age ${retirementAge})
- Starting Portfolio Value at Drawdown: £${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Base Withdrawal Amount (Year 1): £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${safeWithdrawalRate}% of £${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
- Years in Drawdown: ${deathAge - actualRetirementAge} years
- Baseline Business Cashflow: £${baselineYearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (from retirement year ${retirementYear})

**CALCULATION FORMULAS (VERIFY EACH YEAR):**

For each year in the drawdown projection:

**PORTFOLIO VALUE (without business):**
1. **Portfolio Value (start of year)**: 
   - Year 1 (first year): Starting portfolio value from retirement (£${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
   - Year 2+: Previous year's Portfolio with Business FINAL value (includes accumulated business cashflow)
2. **Portfolio Growth**: Portfolio Value × (1 + ${returnRate / 100}) = Portfolio Value × ${1 + (returnRate / 100)}
3. **Portfolio Value (end of year)**: (Portfolio Value × (1 + ${returnRate / 100})) - Gross Withdrawal
   - This becomes the Portfolio Value (start of year) for the NEXT year
   - NOTE: The displayed "Portfolio Value" shows the START of year value

**PORTFOLIO WITH BUSINESS:**
1. **Portfolio with Business (start of year)**: 
   - Year 1: Same as Portfolio Value start (£${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
   - Year 2+: Previous year's Portfolio with Business FINAL value
2. **Portfolio Growth**: Portfolio with Business (start) × (1 + ${returnRate / 100})
3. **Business Cashflow Added**: 
   - If year < ${retirementAgeYear} (before retirement age ${retirementAge}): Baseline Cashflow × (1 + ${cashflowIncrease / 100})^years_since_retirement
   - If year >= ${retirementAgeYear} (at/after retirement age ${retirementAge}): Cashflow stops growing, stays constant at the value reached at retirement age
   - Baseline Cashflow: £${baselineYearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (from retirement year ${retirementYear})
   - Cashflow at retirement age: £${baselineYearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${cashflowIncrease / 100})^${retirementAgeYear - retirementYear} = £${(baselineYearlyCashflow * Math.pow(1 + cashflowIncrease / 100, retirementAgeYear - retirementYear)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
4. **Portfolio with Business (end of year)**: (Portfolio with Business (start) × (1 + ${returnRate / 100})) + Business Cashflow - Gross Withdrawal
   - This becomes the Portfolio with Business (start of year) for the NEXT year
   - NOTE: The displayed "Portfolio with Business" shows the END of year value (final value after all calculations)

**WITHDRAWAL & INCOME:**
1. **Gross Withdrawal**: Base Withdrawal × (1 + ${inflation / 100})^years_since_drawdown_started
   - Base Withdrawal: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${safeWithdrawalRate}% of starting portfolio)
   - Year 0: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^0 = £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Year 1: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^1 = £${(baseWithdrawal * (1 + inflation / 100)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Year 2: £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^2 = £${(baseWithdrawal * Math.pow(1 + inflation / 100, 2)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
2. **Tax Amount**: Gross Withdrawal × ${tax / 100}
3. **Net Withdrawal**: Gross Withdrawal - Tax Amount
4. **State Pension**: 
   - If age < ${retirementAge}: £0
   - If age >= ${retirementAge}: £${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${inflation / 100})^years_since_pension_started
   - Pension starts in year ${retirementAgeYear} (when age reaches ${retirementAge})
   - Years since pension started = year - ${retirementAgeYear}
5. **Total Income**: Net Withdrawal + State Pension

**DRAWDOWN PROJECTION DATA (VALIDATE EACH ROW):**

${drawdownText}

**YOUR TASK - VALIDATE THE MATHEMATICS:**

For EACH year in the projection above, please:

**CRITICAL VALIDATION CHECKS:**

1. **INFLATION VALIDATION:**
   - Verify withdrawal amount increases by ${inflation}% each year: Year N withdrawal = Base × (1 + ${inflation / 100})^N
   - Verify state pension (when it starts) increases by ${inflation}% each year: Year N pension = Base Pension × (1 + ${inflation / 100})^years_since_pension_started
   - Check that inflation is applied correctly year-on-year (compound, not simple)

2. **PENSION VALIDATION:**
   - Verify state pension is £0 for all years before age ${retirementAge} (year ${retirementAgeYear})
   - Verify state pension starts exactly in year ${retirementAgeYear} when age reaches ${retirementAge}
   - Verify pension inflation adjustment starts from year ${retirementAgeYear}, not from drawdown start year ${retirementYear}
   - Check pension amount: Base = £${statePensionYearly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}, then grows by ${inflation}% each year

3. **ACCUMULATING CASH (BUSINESS CASHFLOW) VALIDATION:**
   - Verify business cashflow baseline: £${baselineYearlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (from retirement year ${retirementYear})
   - Verify business cashflow grows by ${cashflowIncrease}% each year UNTIL retirement age ${retirementAge} (year ${retirementAgeYear}): Year N = Baseline × (1 + ${cashflowIncrease / 100})^years_since_retirement
   - Verify business cashflow STOPS GROWING at retirement age ${retirementAge} and stays constant at: £${(baselineYearlyCashflow * Math.pow(1 + cashflowIncrease / 100, retirementAgeYear - retirementYear)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
   - Verify business cashflow is added to "Portfolio with Business" each year (after growth, before withdrawal)
   - Check that years_since_retirement = year - ${retirementYear} (not years since drawdown started)

4. **DRAWDOWN NUMBER VALIDATION:**
   - Verify withdrawal amount: Base = ${safeWithdrawalRate}% of starting portfolio (£${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${safeWithdrawalRate / 100} = £${baseWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
   - Verify withdrawal increases by ${inflation}% each year (compound)
   - Verify tax calculation: Tax = Withdrawal × ${tax / 100}
   - Verify net withdrawal: Net = Gross - Tax

5. **PORTFOLIO VALUE YEAR-ON-YEAR VALIDATION:**
   - **Portfolio Value (without business)**: 
     * Year 1 start = Starting portfolio value from retirement (£${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
     * Year 2+ start = Previous year's Portfolio with Business FINAL value (includes accumulated business cashflow)
     * Year N end = (Year N start × (1 + ${returnRate / 100})) - Withdrawal
     * Displayed value = Year N start (beginning of year value)
   - **Portfolio with Business**:
     * Year 1 start = Same as Portfolio Value start (£${startingPortfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
     * Year 2+ start = Previous year's Portfolio with Business FINAL value
     * Year N end = (Year N start × (1 + ${returnRate / 100})) + Business Cashflow - Withdrawal
     * Displayed value = Year N end (final value after all calculations)
     * This final value becomes the start value for Portfolio Value and Portfolio with Business next year
   - Check that both portfolio values flow correctly from year to year
   - Verify the "Portfolio with Business" (end value) is always >= "Portfolio Value" (start value) for the same year (since it includes business cashflow)
   - Verify Year N+1 Portfolio Value start = Year N Portfolio with Business end
   - Verify Year N+1 Portfolio with Business start = Year N Portfolio with Business end

**STEP-BY-STEP VALIDATION:**
1. **Calculate the expected values** for each year using the formulas above
2. **Compare** the calculated values with the actual values shown in the data
3. **Identify any discrepancies** - if the numbers don't match, tell me exactly which year and which calculation is wrong
4. **Verify year-on-year continuity** - check that each year's end value matches the next year's start value for both portfolio columns

**ADDITIONAL ANALYSIS:**
- Is the portfolio sustainable? Will it last until death age ${deathAge}?
- Are the assumptions realistic? (${returnRate}% return, ${safeWithdrawalRate}% withdrawal rate, ${inflation}% inflation, ${cashflowIncrease}% cashflow growth)
- Are there any red flags or concerns?
- What improvements would you suggest?

Please provide a detailed mathematical validation showing your calculations for at least the first 3 years, verifying:
- Inflation calculations for withdrawal and pension
- Pension timing and amounts
- Business cashflow accumulation
- Drawdown numbers
- Year-on-year portfolio value continuity

Then confirm if the rest of the projection is correct.`;

                try {
                  await navigator.clipboard.writeText(prompt);
                  setDrawdownSummaryCopied(true);
                  setTimeout(() => setDrawdownSummaryCopied(false), 3000);
                } catch (err) {
                  console.error('Failed to copy:', err);
                  alert('Failed to copy to clipboard. Please try again.');
                }
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm flex items-center justify-center gap-2"
            >
              {drawdownSummaryCopied ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  Ask AI
                </>
              )}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Year
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Portfolio Value
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Portfolio with Business
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Withdrawal Amount
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tax
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Net Withdrawal
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    State Pension
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Income
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {postRetirementData.map((data) => {
                  const ageAtYear = currentAge + (data.year - currentYear);
                  return (
                  <tr
                    key={data.year}
                    className={data.portfolioValue === 0 ? 'bg-red-50 dark:bg-red-900/20' : ''}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center">
                      {data.year}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      {ageAtYear}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center cursor-help"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const currentIndex = postRetirementData.findIndex(d => d.year === data.year);
                        const previousYearData = currentIndex > 0 ? postRetirementData[currentIndex - 1] : null;
                        
                        // Portfolio value shown is the START of the year
                        // For first year: uses starting portfolio value
                        // For subsequent years: uses previous year's Portfolio with Business value (includes accumulated business cashflow)
                        const isFirstYear = currentIndex === 0;
                        const previousYearPortfolioWithBusiness = previousYearData ? previousYearData.portfolioWithBusinessFinal : null;
                        
                        const growthAmount = data.portfolioValue * (returnRate / 100);
                        const portfolioAfterGrowth = data.portfolioValue * (1 + returnRate / 100);
                        const withdrawalAmount = data.withdrawalAmount;
                        const finalPortfolioValue = portfolioAfterGrowth - withdrawalAmount;
                        
                        // Calculate years since drawdown started for inflation context
                        const targetReachedData = preRetirementData.find(p => p.totalPortfolioValue >= targetPot);
                        const retirementYear = targetReachedData ? targetReachedData.year : (preRetirementData.length > 0 ? preRetirementData[preRetirementData.length - 1].year : currentYear);
                        const yearsSinceDrawdown = data.year - retirementYear;
                        
                        let tooltipText;
                        if (isFirstYear) {
                          tooltipText = `Portfolio Value Calculation (${data.year}):\n\nStarting Portfolio Value: £${data.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n(From retirement year when target was reached)\n\nGrowth (${returnRate}%): +£${growthAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPortfolio After Growth: £${portfolioAfterGrowth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nWithdrawal Amount: -£${withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n(Adjusted for ${inflation}% inflation)\n\nFinal Portfolio Value (end of year): £${Math.max(0, finalPortfolioValue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nNote: Starting next year, Portfolio Value will use the previous year's Portfolio with Business value (includes accumulated business cashflow).`;
                        } else {
                          tooltipText = `Portfolio Value Calculation (${data.year}):\n\nStarting Portfolio Value: £${data.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n(From previous year's Portfolio with Business: £${previousYearPortfolioWithBusiness ? previousYearPortfolioWithBusiness.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'N/A'})\n\nGrowth (${returnRate}%): +£${growthAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPortfolio After Growth: £${portfolioAfterGrowth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nWithdrawal Amount: -£${withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n(Adjusted for ${inflation}% inflation, year ${yearsSinceDrawdown} of drawdown)\n\nFinal Portfolio Value (end of year): £${Math.max(0, finalPortfolioValue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nThis becomes the starting value for Portfolio with Business next year (before adding new business cashflow).\n\nFormula:\n(Starting Value × (1 + ${returnRate}%)) - Withdrawal Amount = Final Value\n£${data.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${(1 + returnRate / 100).toFixed(4)} - £${withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = £${Math.max(0, finalPortfolioValue).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        
                        setPortfolioValueTooltip({
                          x: rect.right + 10,
                          y: rect.top,
                          text: tooltipText
                        });
                      }}
                      onMouseLeave={() => setPortfolioValueTooltip(null)}
                    >
                      £{data.portfolioValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center cursor-help"
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const startValue = data.portfolioWithBusinessStart || data.portfolioWithBusiness;
                        const businessCashflow = data.businessCashflowThisYear || 0;
                        const finalValue = data.portfolioWithBusinessFinal || data.portfolioWithBusiness;
                        const growthAmount = data.portfolioWithBusinessGrowth || 0;
                        const afterGrowth = data.portfolioWithBusinessAfterGrowth || 0;
                        const withdrawalAmount = data.withdrawalAmount || 0;
                        
                        // Calculate years since retirement for cashflow calculation
                        const targetReachedData = preRetirementData.find(p => p.totalPortfolioValue >= targetPot);
                        const retirementYear = targetReachedData ? targetReachedData.year : (preRetirementData.length > 0 ? preRetirementData[preRetirementData.length - 1].year : currentYear);
                        const yearsSinceRetirement = data.year - retirementYear;
                        const retirementData = preRetirementData.find(p => p.year === retirementYear);
                        const baselineCashflow = retirementData ? retirementData.yearlyCashflow : (preRetirementData[preRetirementData.length - 1]?.yearlyCashflow || 0);
                        
                        const tooltipText = `Portfolio with Business Calculation (${data.year}):\n\nStarting Portfolio with Business: £${startValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nGrowth (${returnRate}%): +£${growthAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nPortfolio After Growth: £${afterGrowth.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nBusiness Cashflow Added: +£${businessCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n(Baseline: £${baselineCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × (1 + ${cashflowIncrease}%)^${yearsSinceRetirement})\n\nWithdrawal Amount: -£${withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nFinal Portfolio with Business: £${finalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\nFormula:\n(Starting Value × (1 + ${returnRate}%)) + Business Cashflow - Withdrawal = Final Value\n£${startValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × ${(1 + returnRate / 100).toFixed(4)} + £${businessCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} - £${withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} = £${finalValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        
                        setPortfolioWithBusinessTooltip({
                          x: rect.right + 10,
                          y: rect.top,
                          text: tooltipText
                        });
                      }}
                      onMouseLeave={() => setPortfolioWithBusinessTooltip(null)}
                    >
                      £{data.portfolioWithBusiness.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      £{data.withdrawalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 dark:text-red-400 text-center">
                      -£{data.taxAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      £{data.netWithdrawal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-center">
                      £{data.statePensionAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white text-center">
                      £{data.totalIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

// Main page with tabs
export default function RetirementByTargetPotPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'cashflow' | 'target' | 'summary' | 'dividends'>(
    (tabParam === 'target' || tabParam === 'cashflow' || tabParam === 'summary' || tabParam === 'dividends') ? tabParam : 'summary'
  );

  // Update URL when tab changes
  const handleTabChange = (tab: 'cashflow' | 'target' | 'summary' | 'dividends') => {
    setActiveTab(tab);
    router.push(`/finances/retirement-by-target-pot?tab=${tab}`, { scroll: false });
  };

  // Sync with URL on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'target' || tabParam === 'cashflow' || tabParam === 'summary' || tabParam === 'dividends') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync active tab to ?tab= query
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            <button
              onClick={() => handleTabChange('summary')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'summary'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => handleTabChange('cashflow')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'cashflow'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Retirement by Cashflow
            </button>
            <button
              onClick={() => handleTabChange('target')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'target'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Retirement by Target Pot
            </button>
            <button
              onClick={() => handleTabChange('dividends')}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === 'dividends'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              Retirement by Dividends
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'cashflow' && <RetirementByCashflow />}
        {activeTab === 'target' && <RetirementByTargetPot />}
        {activeTab === 'summary' && <RetirementSummary />}
        {activeTab === 'dividends' && <RetirementByDividends />}
      </div>
    </div>
  );
}
