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
  Is247wage?: boolean | null;
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
  const [previousYearNetworthData, setPreviousYearNetworthData] = useState<NetworthReportData | null>(null);
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
  
  // Retirement by Target Pot editable values
  const [currentHNWI, setCurrentHNWI] = useState<number | null>(null);
  const [targetPotInput, setTargetPotInput] = useState<string>('');
  const [monthlyCashflowInput, setMonthlyCashflowInput] = useState<string>('');
  const [yearlyCashflow, setYearlyCashflow] = useState<number | null>(null);
  const [averageMonthlyCashflow, setAverageMonthlyCashflow] = useState<number | null>(null);
  const [cashflowIncrease, setCashflowIncrease] = useState<number>(5);
  const [retirementYear, setRetirementYear] = useState<number | null>(null);
  const [retirementAgeAtTarget, setRetirementAgeAtTarget] = useState<number | null>(null);
  const [totalPortfolioValueAtRetirement, setTotalPortfolioValueAtRetirement] = useState<number | null>(null);
  const [totalInvestedAmount, setTotalInvestedAmount] = useState<number | null>(null);

  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const investmentTarget = 20000; // £20,000 per year
  const currentMonth = currentDate.getMonth() + 1; // 1-12
  
  // Calculate previous month (for displaying last month's data)
  let previousMonth = currentMonth - 1;
  let previousYear = currentYear;
  if (previousMonth < 1) {
    previousMonth = 12;
    previousYear = currentYear - 1;
  }

  // Fetch networth data for current year and previous year
  useEffect(() => {
    const fetchNetworth = async () => {
      try {
        // Fetch current year
        const currentYearResponse = await fetch(`/api/networth-report?year=${currentYear}`);
        if (!currentYearResponse.ok) throw new Error('Failed to fetch networth report');
        const currentYearData = await currentYearResponse.json();
        setNetworthData(currentYearData);
        
        // Fetch previous year (needed for month-over-month comparison)
        const previousYearResponse = await fetch(`/api/networth-report?year=${currentYear - 1}`);
        if (previousYearResponse.ok) {
          const previousYearData = await previousYearResponse.json();
          setPreviousYearNetworthData(previousYearData);
        }
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

  // Get month before previous month networth (for calculating change)
  const getMonthBeforePreviousNetworth = () => {
    // Calculate month before previous month
    let monthBeforePrevious = previousMonth - 1;
    let yearBeforePrevious = previousYear;
    if (monthBeforePrevious < 1) {
      monthBeforePrevious = 12;
      yearBeforePrevious = previousYear - 1;
    }
    
    // Determine which dataset to use (current year or previous year)
    const dataToUse = yearBeforePrevious === currentYear ? networthData : previousYearNetworthData;
    
    if (!dataToUse) return null;
    
    const networthCategory = dataToUse.categories.find(cat => {
      const catLower = cat.toLowerCase().trim();
      return catLower.includes('networth') || catLower.includes('net worth');
    });
    
    const monthTotals = dataToUse.monthData[monthBeforePrevious] || {};
    
    if (networthCategory) {
      return monthTotals[networthCategory] || 0;
    }
    
    // Fallback: sum all categories
    return dataToUse.categories.reduce((sum, category) => {
      return sum + (monthTotals[category] || 0);
    }, 0);
  };

  // Calculate networth change
  const getNetworthChange = () => {
    const currentNetworth = getPreviousMonthNetworth();
    const previousNetworth = getMonthBeforePreviousNetworth();
    
    if (currentNetworth === null || previousNetworth === null) {
      return null;
    }
    
    return currentNetworth - previousNetworth;
  };

  // Get HNWI value (category 9 or from category rules)
  const getHNWIValue = () => {
    if (!networthData) return null;
    
    const monthTotals = networthData.monthData[previousMonth] || {};
    
    // Try to find HNWI category
    let hnwiCategory = networthData.categories.find((cat: string) => {
      const catLower = cat.toLowerCase().trim();
      return catLower.includes('hnwi') || catLower.includes('high net worth');
    });
    
    if (!hnwiCategory && networthData.categoryRules) {
      const networthCategoryName = networthData.categories.find((cat: string) => {
        const catLower = cat.toLowerCase().trim();
        return catLower.includes('networth') || catLower.includes('net worth');
      });
      
      if (networthCategoryName && networthData.categoryRules[networthCategoryName]) {
        const rule = networthData.categoryRules[networthCategoryName] as string;
        const parts = rule.split('+').map(s => s.trim());
        if (parts.length === 2) {
          hnwiCategory = parts[1];
        }
      }
    }
    
    if (hnwiCategory && monthTotals[hnwiCategory] !== undefined) {
      return monthTotals[hnwiCategory] || 0;
    }
    
    return null;
  };

  // Fetch average monthly cashflow
  useEffect(() => {
    const fetchCashflow = async () => {
      try {
        const currentYearResponse = await fetch(`/api/income-entries?year=${currentYear}`);
        const prevYearResponse = await fetch(`/api/income-entries?year=${currentYear - 1}`);
        
        if (!currentYearResponse.ok || !prevYearResponse.ok) {
          return;
        }
        
        const currentYearData = await currentYearResponse.json();
        const prevYearData = await prevYearResponse.json();
        
        const typesResponse = await fetch('/api/income-types');
        const sourcesResponse = await fetch('/api/income-sources');
        
        if (!typesResponse.ok || !sourcesResponse.ok) {
          return;
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
        
        // Get last 2 months
        let month1 = previousMonth;
        let year1 = previousYear;
        let month2 = month1 - 1;
        let year2 = year1;
        if (month2 < 1) {
          month2 = 12;
          year2 = year1 - 1;
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
          setYearlyCashflow(average * 12);
        } else {
          setAverageMonthlyCashflow(null);
        }
      } catch (err: any) {
        console.error('Error fetching cashflow:', err);
      }
    };
    fetchCashflow();
  }, [currentYear, previousMonth, previousYear]);

  // Initialize HNWI and Target Pot values
  useEffect(() => {
    if (networthData && currentHNWI === null) {
      const hnwiValue = getHNWIValue();
      if (hnwiValue !== null) {
        setCurrentHNWI(hnwiValue);
      }
    }
    if (retirementTargetPot !== null && !targetPotInput) {
      setTargetPotInput(retirementTargetPot.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [networthData, retirementTargetPot, previousMonth]);

  // Currency formatting helpers
  const formatCurrency = (value: number | null): string => {
    if (value === null || isNaN(value)) return '';
    return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const parseCurrency = (value: string): number => {
    const cleaned = value.replace(/[£,\s]/g, '');
    const numValue = parseFloat(cleaned);
    return isNaN(numValue) ? 0 : numValue;
  };

  // Reload function - recalculate based on textbox values
  const handleReload = () => {
    const hnwiValue = currentHNWI !== null ? currentHNWI : 0;
    const targetPotValue = parseCurrency(targetPotInput);
    const monthlyCashflowValue = parseCurrency(monthlyCashflowInput);
    
    // Update state with parsed values
    setRetirementTargetPot(targetPotValue);
    setYearlyCashflow(monthlyCashflowValue * 12);
    
    // Recalculate retirement countdown with new values
    if (targetPotValue > 0 && hnwiValue > 0 && retirementReturnRate && currentAge && retirementAge) {
      const returnRate = retirementReturnRate / 100;
      if (targetPotValue > hnwiValue) {
        const exactYears = Math.log(targetPotValue / hnwiValue) / Math.log(1 + returnRate);
        const targetDate = new Date();
        targetDate.setFullYear(currentYear + exactYears);
        const diffTime = targetDate.getTime() - new Date().getTime();
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let years = Math.floor(totalDays / 365.25);
        let remainingDays = totalDays - (years * 365.25);
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
        
        setRetirementCountdown({ years: Math.max(0, years), months: Math.max(0, months), days: Math.max(0, days) });
      } else {
        setRetirementCountdown({ years: 0, months: 0, days: 0 });
      }
    }
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
        setCashflowIncrease(getSetting('retirement_cashflow_increase', 5));
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

  // Calculate 24/7 Wage hourly rate for a month (sum of all types with Is247wage = true, divided by 730)
  const get247WageHourly = (month: number) => {
    let sum = 0;
    incomeTypes.forEach(type => {
      // Only include types where Is247wage is explicitly true
      if (type.Is247wage === true) {
        sum += getTypeTotal(type.id, month);
      }
    });
    return sum / 730;
  };

  // Get business income total for previous month
  const businessIncomeTotal = getMonthlyTotal(previousMonth);
  
  // Get 24/7 wage hourly rate for previous month
  const wage247Hourly = get247WageHourly(previousMonth);
  
  // Average end 24/7 wage (currently not implemented, show £0.00)
  const averageEnd247Wage = 0;
  
  // Calculate percentage difference
  const percentageDifference = averageEnd247Wage > 0 
    ? ((wage247Hourly - averageEnd247Wage) / averageEnd247Wage) * 100 
    : 0;

  // Check hit target
  const hitTarget = monthlyRetirementValue !== null && businessIncomeTotal >= monthlyRetirementValue;

  // Calculate retirement projection (similar to retirement-by-target-pot summary)
  useEffect(() => {
    const calculateRetirementProjection = () => {
      if (!networthData || !retirementTargetPot || !retirementReturnRate || !currentAge || !retirementAge || !averageMonthlyCashflow) {
        setRetirementYear(null);
        setRetirementAgeAtTarget(null);
        setTotalPortfolioValueAtRetirement(null);
        return;
      }

      const currentNetworth = getPreviousMonthNetworth();
      if (currentNetworth === null || currentNetworth <= 0) {
        setRetirementYear(null);
        setRetirementAgeAtTarget(null);
        setTotalPortfolioValueAtRetirement(null);
        return;
      }

      const targetPot = retirementTargetPot;
      const returnRate = retirementReturnRate / 100;
      const cashflowIncreaseRate = cashflowIncrease / 100;
      const currentYear = new Date().getFullYear();
      
      let portfolioValueWithoutCashflow = Math.abs(currentNetworth);
      let totalPortfolioValue = Math.abs(currentNetworth);
      let currentMonthlyCashflow = averageMonthlyCashflow;
      const retirementAgeYear = currentYear + (retirementAge - currentAge);
      
      // Calculate years from current to retirement age
      const yearsToRetirement = retirementAge - currentAge;
      
      for (let i = 0; i <= yearsToRetirement; i++) {
        const year = currentYear + i;
        
        if (i === 0) {
          // Current year - use average monthly cashflow
          const yearlyCashflow = currentMonthlyCashflow * 12;
          // Check if target is already reached in current year
          if (totalPortfolioValue >= targetPot) {
            setRetirementYear(year);
            setRetirementAgeAtTarget(currentAge);
            setTotalPortfolioValueAtRetirement(totalPortfolioValue);
            return;
          }
        } else {
          // Future years - cashflow increases
          currentMonthlyCashflow = currentMonthlyCashflow * (1 + cashflowIncreaseRate);
          const yearlyCashflow = currentMonthlyCashflow * 12;
          
          // Portfolio value without cashflow (just growth)
          portfolioValueWithoutCashflow = portfolioValueWithoutCashflow * (1 + returnRate);
          
          // Total portfolio value (cumulative: previous total + growth + new cashflow)
          totalPortfolioValue = totalPortfolioValue * (1 + returnRate) + yearlyCashflow;
          
          // Stop calculating once target is reached
          if (totalPortfolioValue >= targetPot) {
            const ageAtYear = currentAge + i;
            setRetirementYear(year);
            setRetirementAgeAtTarget(ageAtYear);
            setTotalPortfolioValueAtRetirement(totalPortfolioValue);
            return;
          }
        }
      }
      
      // If we didn't reach the target by retirement age, set to null
      setRetirementYear(null);
      setRetirementAgeAtTarget(null);
      setTotalPortfolioValueAtRetirement(null);
    };

    calculateRetirementProjection();
  }, [networthData, retirementTargetPot, retirementReturnRate, currentAge, retirementAge, averageMonthlyCashflow, cashflowIncrease, previousMonth, previousYear]);

  // Fetch investment tracker data for current year
  useEffect(() => {
    const fetchInvestmentTracker = async () => {
      try {
        const response = await fetch(`/api/investment-tracker?year=${currentYear}`);
        if (!response.ok) throw new Error('Failed to fetch investment tracker data');
        const data = await response.json();
        const entries = data.data || [];
        
        // Calculate total invested for current year
        const total = entries.reduce((sum: number, entry: any) => {
          const amount = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
          return sum + (isNaN(amount) ? 0 : amount);
        }, 0);
        
        setTotalInvestedAmount(total);
      } catch (err: any) {
        console.error('Error fetching investment tracker:', err);
        setTotalInvestedAmount(0);
      }
    };
    fetchInvestmentTracker();
  }, [currentYear]);

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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Current Networth
              </h2>
              <div className="flex-grow flex flex-col justify-center">
                <div className="text-4xl font-bold text-gray-900 dark:text-white">
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
                {(() => {
                  const change = getNetworthChange();
                  if (change === null) return null;
                  
                  const absChange = Math.abs(change);
                  const formattedChange = `£${absChange.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const isPositive = change > 0;
                  const isNegative = change < 0;
                  
                  return (
                    <div className={`text-sm font-medium mt-2 ${
                      isPositive 
                        ? 'text-green-600 dark:text-green-400' 
                        : isNegative 
                        ? 'text-red-600 dark:text-red-400' 
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {isPositive ? '↑' : isNegative ? '↓' : ''} {isPositive ? '+' : ''}{formattedChange}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Retirement Plan Section */}
            {(() => {
              const currentNetworth = getPreviousMonthNetworth();
              const yearlyCashflow = averageMonthlyCashflow ? averageMonthlyCashflow * 12 : 0;
              
              if (currentNetworth === null || retirementReturnRate === null) {
                return null;
              }
              
              return (
                <>
                  {/* Retirement Plan */}
                  {retirementYear !== null && retirementAgeAtTarget !== null && totalPortfolioValueAtRetirement !== null && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                        Retirement Plan
                      </h2>
                      <div className="space-y-6 flex-grow flex flex-col justify-center">
                        <div>
                          <div className="text-base text-gray-500 dark:text-gray-400 mb-2">Years Until Retirement</div>
                          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {retirementYear - currentYear} {retirementYear - currentYear === 1 ? 'year' : 'years'}
                          </div>
                        </div>
                        <div>
                          <div className="text-base text-gray-500 dark:text-gray-400 mb-2">Age at Retirement</div>
                          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {retirementAgeAtTarget}
                          </div>
                        </div>
                        <div>
                          <div className="text-base text-gray-500 dark:text-gray-400 mb-2">Retirement Year</div>
                          <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                            {retirementYear}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Current Business Cashflow Section */}
            {currentHNWI !== null && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:col-span-2">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                  Current Business Cashflow
                </h2>
                <div className="space-y-4">
                  {/* First row: Current HNWI Number and Expected Return */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Current HNWI Number</div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        £{currentHNWI.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    {retirementReturnRate !== null && (
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Expected Return ({retirementReturnRate}% of HNWI)</div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          £{((currentHNWI * retirementReturnRate) / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Second row: Business Income Total and Yearly Business Cashflow */}
                  {averageMonthlyCashflow !== null && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Business Income Total</div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          £{averageMonthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Yearly Business Cashflow</div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                          £{(averageMonthlyCashflow * 12).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Annual Total</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 24/7 Status Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                24/7 status
              </h2>
              <div className="space-y-4">
                {/* 24/7 Hourly Wage */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">24/7 Hour Wage</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    £{wage247Hourly.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* Last Years 24/7 wage */}
                <div className="flex justify-between items-center py-3 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Last Years 24/7 wage</span>
                  <span className="text-lg font-semibold text-gray-900 dark:text-white">
                    £{averageEnd247Wage.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                {/* Percentage Difference */}
                <div className="flex justify-between items-center py-3">
                  <span className="text-gray-700 dark:text-gray-300 font-medium">Percentage Difference</span>
                  <span className={`text-lg font-semibold ${
                    percentageDifference > 0 
                      ? 'text-green-600 dark:text-green-400' 
                      : percentageDifference < 0 
                      ? 'text-red-600 dark:text-red-400' 
                      : 'text-gray-900 dark:text-white'
                  }`}>
                    {percentageDifference > 0 ? '+' : ''}{percentageDifference.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                  </span>
                </div>
              </div>
            </div>

            {/* Invested Amount Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Invested Amount
              </h2>
              <div className="flex-grow flex flex-col justify-center space-y-4">
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {totalInvestedAmount !== null
                      ? `£${totalInvestedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {totalInvestedAmount !== null
                      ? `£${totalInvestedAmount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / £${investmentTarget.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : ''}
                  </div>
                </div>
                {totalInvestedAmount !== null && (
                  <>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Progress</div>
                      <div className={`text-2xl font-semibold ${
                        totalInvestedAmount >= investmentTarget
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {((totalInvestedAmount / investmentTarget) * 100).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Remaining</div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        £{Math.max(0, investmentTarget - totalInvestedAmount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                  </>
                )}
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  {currentYear}
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
