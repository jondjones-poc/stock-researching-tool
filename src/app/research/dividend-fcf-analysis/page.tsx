'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CashFlowData {
  date: string;
  freeCashFlow: number | null;
  dividendsPaid: number | null;
  year: number;
}

interface DividendData {
  date: string;
  dividend: number | null;
  adjustedDividend: number | null;
  year: number;
}

interface YearlyData {
  year: number;
  freeCashFlow: number;
  dividendsPaid: number;
  payoutRatio: number;
  annualDividend: number;
}

interface Metrics {
  fcfCAGR10Y: number | null;
  fcfCAGR5Y: number | null;
  dividendCAGR10Y: number | null;
  dividendCAGR5Y: number | null;
  latestPayoutRatio: number | null;
}

export default function DividendFCFAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ticker, setTicker] = useState('');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [availableSymbols, setAvailableSymbols] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSymbols, setLoadingSymbols] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cashFlowData, setCashFlowData] = useState<CashFlowData[]>([]);
  const [dividendData, setDividendData] = useState<DividendData[]>([]);
  const [yearlyData, setYearlyData] = useState<YearlyData[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    fcfCAGR10Y: null,
    fcfCAGR5Y: null,
    dividendCAGR10Y: null,
    dividendCAGR5Y: null,
    latestPayoutRatio: null
  });
  // Editable table data state
  const [editableTableData, setEditableTableData] = useState<Map<number, {
    freeCashFlow: number;
    dividendsPaid: number;
    fcfPayoutRatio: number;
    adjustedDividend: number;
    payoutRatio: number;
  }>>(new Map());
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const [copiedToClipboard2, setCopiedToClipboard2] = useState(false);
  const [currentMetrics, setCurrentMetrics] = useState<{
    price: number | null;
    dividendPayout: number | null;
    dividendYield: number | null;
    payoutRatioTTM: number | null;
    fcfPayoutRatioTTM: number | null;
  }>({
    price: null,
    dividendPayout: null,
    dividendYield: null,
    payoutRatioTTM: null,
    fcfPayoutRatioTTM: null
  });

  // Calculate CAGR: (Ending Value / Starting Value)^(1 / Years) - 1
  const calculateCAGR = (startValue: number, endValue: number, years: number): number => {
    if (startValue <= 0 || years <= 0) return 0;
    return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
  };

  // Process data and calculate metrics
  useEffect(() => {
    if (cashFlowData.length === 0 || dividendData.length === 0) {
      setYearlyData([]);
      setMetrics({
        fcfCAGR10Y: null,
        fcfCAGR5Y: null,
        dividendCAGR10Y: null,
        dividendCAGR5Y: null,
        latestPayoutRatio: null
      });
      return;
    }

    // Group cash flow data by year (take the latest entry for each year)
    const cashFlowByYear = new Map<number, CashFlowData>();
    cashFlowData.forEach(item => {
      const existing = cashFlowByYear.get(item.year);
      if (!existing || new Date(item.date) > new Date(existing.date)) {
        cashFlowByYear.set(item.year, item);
      }
    });

    // Group dividend data by year (sum dividends for each year)
    const dividendByYear = new Map<number, number>();
    dividendData.forEach(item => {
      const dividend = item.adjustedDividend ?? item.dividend ?? 0;
      if (dividend > 0) {
        const current = dividendByYear.get(item.year) || 0;
        dividendByYear.set(item.year, current + dividend);
      }
    });

    // Create yearly data array
    const allYears = Array.from(new Set([
      ...Array.from(cashFlowByYear.keys()),
      ...Array.from(dividendByYear.keys())
    ])).sort((a, b) => b - a); // Sort descending (newest first)

    const yearly: YearlyData[] = allYears.map(year => {
      const cf = cashFlowByYear.get(year);
      const fcf = cf?.freeCashFlow ?? 0;
      const divPaid = Math.abs(cf?.dividendsPaid ?? 0);
      const annualDiv = dividendByYear.get(year) ?? 0;
      const payoutRatio = fcf > 0 ? (divPaid / fcf) : 0; // Store as decimal, not percentage

      return {
        year,
        freeCashFlow: fcf,
        dividendsPaid: divPaid,
        payoutRatio,
        annualDividend: annualDiv
      };
    }).filter(item => item.freeCashFlow > 0 || item.dividendsPaid > 0);

    setYearlyData(yearly);

    // Sync loaded data to editable table state - populate all years in table range
    const newEditableData = new Map<number, {
      freeCashFlow: number;
      dividendsPaid: number;
      fcfPayoutRatio: number;
      adjustedDividend: number;
      payoutRatio: number;
    }>();
    
    // Calculate table years for population
    const referenceYear = yearly.length > 0 
      ? Math.max(...yearly.map(d => d.year))
      : new Date().getFullYear();
    const startYear = referenceYear - 10;
    const endYear = referenceYear; // Include the latest year
    
    // Create a map of loaded data by year
    const dataByYear = new Map(yearly.map(d => [d.year, d]));
    
    // Populate all years in the table range
    for (let year = startYear; year <= endYear; year++) {
      const data = dataByYear.get(year);
      const fcfPayoutRatio = data?.payoutRatio ?? 0;
      const payoutRatio = data && data.freeCashFlow > 0 && data.annualDividend > 0
        ? (data.annualDividend / data.freeCashFlow) // Store as decimal, not percentage
        : 0;
      
      newEditableData.set(year, {
        freeCashFlow: data?.freeCashFlow ?? 0,
        dividendsPaid: data?.dividendsPaid ?? 0,
        fcfPayoutRatio: fcfPayoutRatio,
        adjustedDividend: data?.annualDividend ?? 0,
        payoutRatio: payoutRatio
      });
    }
    
    setEditableTableData(newEditableData);

    // Save loaded data to database if we have a ticker
    if (ticker && yearly.length > 0) {
      // Save all years to database
      yearly.forEach(async (item) => {
        const fcfPayoutRatio = item.payoutRatio;
        const payoutRatio = item.freeCashFlow > 0 && item.annualDividend > 0
          ? (item.annualDividend / item.freeCashFlow) // Store as decimal, not percentage
          : 0;
        
        try {
          await fetch('/api/dividend-breakdown', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stock_symbol: ticker.toUpperCase(),
              year: item.year,
              free_cash_flow: item.freeCashFlow,
              dividends_paid: item.dividendsPaid,
              fcf_payout_ratio: fcfPayoutRatio,
              adjusted_dividend: item.annualDividend,
              payout_ratio: payoutRatio
            })
          });
        } catch (err) {
          console.error(`Error saving year ${item.year} to database:`, err);
        }
      });
    }

    // Calculate metrics
    if (yearly.length >= 2) {
      const latest = yearly[0];
      const latestYear = latest.year;

      // FCF CAGR calculations
      const fcf10Y = yearly.find(item => item.year === latestYear - 10);
      const fcf5Y = yearly.find(item => item.year === latestYear - 5);
      const fcfCAGR10Y = fcf10Y && latest.freeCashFlow > 0 && fcf10Y.freeCashFlow > 0
        ? calculateCAGR(fcf10Y.freeCashFlow, latest.freeCashFlow, 10)
        : null;
      const fcfCAGR5Y = fcf5Y && latest.freeCashFlow > 0 && fcf5Y.freeCashFlow > 0
        ? calculateCAGR(fcf5Y.freeCashFlow, latest.freeCashFlow, 5)
        : null;

      // Dividend CAGR calculations (using annual dividend)
      const div10Y = yearly.find(item => item.year === latestYear - 10);
      const div5Y = yearly.find(item => item.year === latestYear - 5);
      const dividendCAGR10Y = div10Y && latest.annualDividend > 0 && div10Y.annualDividend > 0
        ? calculateCAGR(div10Y.annualDividend, latest.annualDividend, 10)
        : null;
      const dividendCAGR5Y = div5Y && latest.annualDividend > 0 && div5Y.annualDividend > 0
        ? calculateCAGR(div5Y.annualDividend, latest.annualDividend, 5)
        : null;

      // Latest payout ratio
      const latestPayoutRatio = latest.payoutRatio;

      setMetrics({
        fcfCAGR10Y,
        fcfCAGR5Y,
        dividendCAGR10Y,
        dividendCAGR5Y,
        latestPayoutRatio
      });
    }
  }, [cashFlowData, dividendData]);

  // Load available symbols from database
  useEffect(() => {
    const loadSymbols = async () => {
      setLoadingSymbols(true);
      try {
        const response = await fetch('/api/dividend-breakdown?action=symbols');
        const result = await response.json();
        if (response.ok) {
          setAvailableSymbols(result.symbols || []);
        }
      } catch (err) {
        console.error('Error loading symbols:', err);
      } finally {
        setLoadingSymbols(false);
      }
    };
    loadSymbols();
  }, []);

  // Load symbol from query string on page load
  useEffect(() => {
    const symbolFromQuery = searchParams.get('symbol');
    if (symbolFromQuery && symbolFromQuery.trim()) {
      const symbol = symbolFromQuery.trim().toUpperCase();
      // Only load if it's different from current selection to avoid unnecessary reloads
      if (symbol !== selectedSymbol) {
        setSelectedSymbol(symbol);
        setTicker(symbol);
        // Try to load from database
        loadDataFromDatabase(symbol);
      }
    } else if (!symbolFromQuery && selectedSymbol) {
      // Clear selection if query string is removed
      setSelectedSymbol('');
      setTicker('');
    }
  }, [searchParams]);


  // Load data from database when symbol is selected
  const loadDataFromDatabase = async (symbol: string) => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/dividend-breakdown?symbol=${encodeURIComponent(symbol)}`);
      const result = await response.json();
      
      if (response.ok && result.data) {
        // Convert database data to editable table format
        const newEditableData = new Map<number, {
          freeCashFlow: number;
          dividendsPaid: number;
          fcfPayoutRatio: number;
          adjustedDividend: number;
          payoutRatio: number;
        }>();
        
        // First, populate with data from database
        result.data.forEach((row: any) => {
          newEditableData.set(row.year, {
            freeCashFlow: parseFloat(row.free_cash_flow) || 0,
            dividendsPaid: parseFloat(row.dividends_paid) || 0,
            fcfPayoutRatio: parseFloat(row.fcf_payout_ratio) || 0,
            adjustedDividend: parseFloat(row.adjusted_dividend) || 0,
            payoutRatio: parseFloat(row.payout_ratio) || 0
          });
        });
        
        // Determine reference year and populate all years in the 10-year range
        const years = Array.from(newEditableData.keys());
        if (years.length > 0) {
          const referenceYear = Math.max(...years);
          const startYear = referenceYear - 9; // Show exactly 10 years (referenceYear - 9 to referenceYear inclusive)
          const endYear = referenceYear;
          
          // Populate all years in the range (excluding years before startYear)
          for (let year = startYear; year <= endYear; year++) {
            if (!newEditableData.has(year)) {
              // Add empty entry for years not in database
              newEditableData.set(year, {
                freeCashFlow: 0,
                dividendsPaid: 0,
                fcfPayoutRatio: 0,
                adjustedDividend: 0,
                payoutRatio: 0
              });
            }
          }
        }
        setEditableTableData(newEditableData);
        
        // Also set the ticker for display
        setTicker(symbol);
        
        // Fetch current metrics after data is loaded
        await fetchCurrentMetrics(symbol);
      }
    } catch (err: any) {
      console.error('Error loading data from database:', err);
      setError('Failed to load data from database');
    } finally {
      setLoading(false);
    }
  };

  // Handle symbol selection from dropdown
  const handleSymbolSelect = (symbol: string) => {
    // Update URL with query string - useEffect will handle loading
    if (symbol) {
      router.push(`/research/dividend-fcf-analysis?symbol=${encodeURIComponent(symbol)}`);
    } else {
      router.push('/research/dividend-fcf-analysis');
    }
  };

  // Fetch current metrics (price, dividend, yield, etc.)
  const fetchCurrentMetrics = async (symbol: string) => {
    try {
      const response = await fetch(`/api/pe-ratios?symbol=${encodeURIComponent(symbol)}`);
      if (!response.ok) {
        console.warn('Failed to fetch current metrics');
        return;
      }
      const data = await response.json();
      
      // Calculate payout ratio TTM (dividend per share / EPS TTM)
      let payoutRatioTTM: number | null = null;
      if (data.dividendPerShare && data.epsTTM && data.epsTTM > 0) {
        payoutRatioTTM = data.dividendPerShare / data.epsTTM;
      }
      
      setCurrentMetrics(prev => ({
        price: data.currentPrice ?? null,
        dividendPayout: data.dividendPerShare ?? null,
        dividendYield: data.dividendYield ?? null,
        payoutRatioTTM: payoutRatioTTM,
        fcfPayoutRatioTTM: prev.fcfPayoutRatioTTM // Keep existing value, will be updated by useEffect
      }));
    } catch (err) {
      console.error('Error fetching current metrics:', err);
    }
  };

  const fetchData = async (symbol: string) => {
    setLoading(true);
    setError(null);
    setCashFlowData([]);
    setDividendData([]);

    try {
      const [cashFlowResponse, dividendResponse] = await Promise.all([
        fetch(`/api/dividend-fcf/cash-flow?symbol=${encodeURIComponent(symbol)}`),
        fetch(`/api/dividend-fcf/dividends?symbol=${encodeURIComponent(symbol)}`)
      ]);

      const cashFlowResult = await cashFlowResponse.json();
      const dividendResult = await dividendResponse.json();

      // Handle cash flow data
      if (!cashFlowResponse.ok) {
        const errorMsg = cashFlowResult.error || 'Failed to fetch cash flow data';
        console.error('Cash Flow API Error:', errorMsg);
        // If cash flow fails, we can't proceed
        throw new Error(errorMsg);
      }

      setCashFlowData(cashFlowResult.cashFlow || []);

      // Handle dividend data (optional - some stocks don't pay dividends)
      if (!dividendResponse.ok) {
        // 404 is expected for stocks without dividend data - don't log as error
        if (dividendResponse.status !== 404) {
          const errorMsg = dividendResult.error || 'Failed to fetch dividend data';
          console.warn('Dividend API Error (non-critical):', errorMsg);
        }
        // Set empty dividend data instead of throwing error
        setDividendData([]);
        // Don't show error message for missing dividend data - it's expected for some stocks
        // The table will just show 0.00 for dividend-related fields
      } else {
        setDividendData(dividendResult.dividends || []);
      }
      
      // Clear any previous error messages if we successfully got cash flow data
      if (cashFlowResult.cashFlow && cashFlowResult.cashFlow.length > 0) {
        setError(null);
      }

      // Check if we have any data at all
      if ((cashFlowResult.cashFlow || []).length === 0 && (dividendResult.dividends || []).length === 0) {
        setError('No financial data available for this ticker.');
      } else {
        // Set selected symbol so edits will save to database
        setSelectedSymbol(symbol.toUpperCase());
        // Refresh available symbols list
        const symbolsResponse = await fetch('/api/dividend-breakdown?action=symbols');
        const symbolsResult = await symbolsResponse.json();
        if (symbolsResponse.ok) {
          setAvailableSymbols(symbolsResult.symbols || []);
        }
        
        // Fetch current metrics after data is loaded
        await fetchCurrentMetrics(symbol.toUpperCase());
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Unable to load financial data for this ticker.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticker.trim()) {
      fetchData(ticker.trim().toUpperCase());
    }
  };

  const formatNumber = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatPercent = (value: number | null): string => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  // Prepare chart data (sorted ascending by year)
  const chartData = [...yearlyData].sort((a, b) => a.year - b.year);

  // Serialize editableTableData keys for useMemo dependency (React doesn't detect Map changes well)
  const editableTableDataKeys = useMemo(() => {
    return Array.from(editableTableData.keys()).sort((a, b) => a - b).join(',');
  }, [editableTableData]);

  // Calculate years for table: exactly 10 years (oldest first)
  // Memoize to recalculate when yearlyData or editableTableData changes
  const tableYears = useMemo(() => {
    // Determine reference year from yearlyData or editableTableData
    let referenceYear: number;
    if (yearlyData.length > 0) {
      referenceYear = Math.max(...yearlyData.map(d => d.year));
    } else if (editableTableData.size > 0) {
      // Use editableTableData if yearlyData is empty (e.g., when loading from database)
      const years = Array.from(editableTableData.keys());
      referenceYear = Math.max(...years);
    } else {
      referenceYear = new Date().getFullYear();
    }
    const startYear = referenceYear - 9; // Show exactly 10 years (referenceYear - 9 to referenceYear inclusive)
    const endYear = referenceYear; // Include the latest year
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    const sortedYears = years.sort((a, b) => a - b);
    // Return in ascending order (oldest first, newest last)
    return sortedYears;
  }, [yearlyData, editableTableDataKeys]);
  const yearlyDataMap = new Map(yearlyData.map(d => [d.year, d]));

  // Get value for editable cell, with fallback to data or 0
  const getCellValue = (year: number, field: 'freeCashFlow' | 'dividendsPaid' | 'fcfPayoutRatio' | 'adjustedDividend' | 'payoutRatio'): number => {
    const edited = editableTableData.get(year);
    if (edited) return edited[field];
    const data = yearlyDataMap.get(year);
    if (data) {
      if (field === 'freeCashFlow') return data.freeCashFlow;
      if (field === 'dividendsPaid') return data.dividendsPaid;
      if (field === 'adjustedDividend') return data.annualDividend;
      if (field === 'fcfPayoutRatio') return data.payoutRatio;
      if (field === 'payoutRatio') {
        const payoutRatio = data.freeCashFlow > 0 && data.annualDividend > 0
          ? (data.annualDividend / data.freeCashFlow) // Store as decimal, not percentage
          : 0;
        return payoutRatio;
      }
    }
    return 0;
  };

  // Format number for display (with commas, showing billions for large numbers)
  const formatNumberForDisplay = (value: number, showBillions: boolean = true): string => {
    if (value === 0) return '';
    if (showBillions && Math.abs(value) >= 1000000000) {
      // Show in billions with 2 decimal places
      return `${(value / 1000000000).toFixed(2)}B`;
    }
    // For smaller numbers or when not showing billions, use comma formatting
    if (Math.abs(value) >= 1000) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
    }
    return value.toFixed(2);
  };

  // Parse formatted number back to number
  const parseFormattedNumber = (value: string): number => {
    const cleaned = value.replace(/,/g, '');
    return parseFloat(cleaned) || 0;
  };

  // Update editable cell value (without auto-saving)
  const updateCellValue = (year: number, field: 'freeCashFlow' | 'dividendsPaid' | 'fcfPayoutRatio' | 'adjustedDividend' | 'payoutRatio', value: number) => {
    const newData = new Map(editableTableData);
    const existing = newData.get(year) || { 
      freeCashFlow: 0, 
      dividendsPaid: 0, 
      fcfPayoutRatio: 0,
      adjustedDividend: 0, 
      payoutRatio: 0 
    };
    existing[field] = value;
    newData.set(year, existing);
    setEditableTableData(newData);
  };

  // Save all data to database
  const saveAllToDatabase = async () => {
    const symbolToSave = selectedSymbol || ticker;
    if (!symbolToSave) {
      setError('Please select or enter a stock symbol');
      return;
    }

    if (tableYears.length === 0) {
      setError('No data to save');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Save all years to database
      const savePromises = tableYears.map(year => {
        const data = editableTableData.get(year) || {
          freeCashFlow: 0,
          dividendsPaid: 0,
          fcfPayoutRatio: 0,
          adjustedDividend: 0,
          payoutRatio: 0
        };

        return fetch('/api/dividend-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stock_symbol: symbolToSave.toUpperCase(),
            year: year,
            free_cash_flow: data.freeCashFlow,
            dividends_paid: data.dividendsPaid,
            fcf_payout_ratio: data.fcfPayoutRatio,
            adjusted_dividend: data.adjustedDividend,
            payout_ratio: data.payoutRatio
          })
        });
      });

      await Promise.all(savePromises);
      
      // Refresh symbols list
      const symbolsResponse = await fetch('/api/dividend-breakdown?action=symbols');
      const symbolsResult = await symbolsResponse.json();
      if (symbolsResponse.ok) {
        setAvailableSymbols(symbolsResult.symbols || []);
      }

      // Show success message
      setError(null);
      alert('Data saved successfully!');
    } catch (err: any) {
      console.error('Error saving to database:', err);
      setError('Failed to save data to database');
    } finally {
      setLoading(false);
    }
  };

  // Check if last row has values
  const hasLastRowValues = (): boolean => {
    if (tableYears.length === 0) return false;
    const lastYear = tableYears[tableYears.length - 1]; // Last year (newest)
    const lastRowData = editableTableData.get(lastYear);
    if (!lastRowData) return false;
    
    // Check if at least one field has a non-zero value
    return lastRowData.freeCashFlow !== 0 ||
           lastRowData.dividendsPaid !== 0 ||
           lastRowData.fcfPayoutRatio !== 0 ||
           lastRowData.adjustedDividend !== 0 ||
           lastRowData.payoutRatio !== 0;
  };

  // Check if save button should be enabled
  const canSave = (): boolean => {
    const hasSymbol = !!(selectedSymbol || ticker);
    return hasSymbol && hasLastRowValues();
  };

  // Clear all inputs and data
  const handleClear = () => {
    setSelectedSymbol('');
    setTicker('');
    setEditableTableData(new Map());
    setYearlyData([]);
    setCashFlowData([]);
    setDividendData([]);
    setCurrentMetrics({
      price: null,
      dividendPayout: null,
      dividendYield: null,
      payoutRatioTTM: null,
      fcfPayoutRatioTTM: null
    });
    setMetrics({
      fcfCAGR10Y: null,
      fcfCAGR5Y: null,
      dividendCAGR10Y: null,
      dividendCAGR5Y: null,
      latestPayoutRatio: null
    });
    setError(null);
  };

  // Calculate CAGR metrics from grid data
  const calculateCAGRFromGrid = () => {
    // Get all years that have data (non-zero values) from editableTableData
    const yearsWithData = Array.from(editableTableData.entries())
      .filter(([year, data]) => 
        data.freeCashFlow > 0 || 
        data.dividendsPaid > 0 || 
        data.adjustedDividend > 0
      )
      .map(([year]) => year)
      .sort((a, b) => a - b); // Sort ascending (oldest first)

    if (yearsWithData.length < 2) {
      return {
        dividendCAGR10Y: null,
        dividendCAGR5Y: null,
        fcfCAGR10Y: null,
        fcfCAGR5Y: null
      };
    }

    // Get the oldest and latest years that have data
    const oldestYear = yearsWithData[0];
    const latestYear = yearsWithData[yearsWithData.length - 1];
    
    // Use getCellValue to get data (it has fallback logic)
    const oldestFCF = getCellValue(oldestYear, 'freeCashFlow');
    const oldestDividend = getCellValue(oldestYear, 'adjustedDividend');
    const latestFCF = getCellValue(latestYear, 'freeCashFlow');
    const latestDividend = getCellValue(latestYear, 'adjustedDividend');
    
    // For 5-year CAGR, find the year that is 5 years before the latest
    const year5Ago = latestYear - 5;
    const fcf5Ago = getCellValue(year5Ago, 'freeCashFlow');
    const dividend5Ago = getCellValue(year5Ago, 'adjustedDividend');

    // Calculate actual number of years between oldest and latest
    const actualYears = latestYear - oldestYear;

    // Calculate FCF CAGR (10 year) - use oldest and latest if we have at least 9 years of data (10 data points)
    // For 10 years of data (2016-2025), the span is 9 years
    const fcfCAGR10Y = oldestFCF > 0 && latestFCF > 0 && actualYears >= 9
      ? calculateCAGR(oldestFCF, latestFCF, actualYears)
      : null;
    
    // Calculate FCF CAGR (5 year)
    const fcfCAGR5Y = fcf5Ago > 0 && latestFCF > 0
      ? calculateCAGR(fcf5Ago, latestFCF, 5)
      : null;

    // Calculate Dividend CAGR (10 year, using adjustedDividend)
    const dividendCAGR10Y = oldestDividend > 0 && latestDividend > 0 && actualYears >= 9
      ? calculateCAGR(oldestDividend, latestDividend, actualYears)
      : null;
    
    // Calculate Dividend CAGR (5 year)
    const dividendCAGR5Y = dividend5Ago > 0 && latestDividend > 0
      ? calculateCAGR(dividend5Ago, latestDividend, 5)
      : null;

    return {
      dividendCAGR10Y,
      dividendCAGR5Y,
      fcfCAGR10Y,
      fcfCAGR5Y
    };
  };

  const cagrMetrics = calculateCAGRFromGrid();

  // Update FCF payout ratio TTM when table data changes
  useEffect(() => {
    // Get the latest year from editableTableData directly to avoid dependency on tableYears
    if (editableTableData.size === 0) {
      setCurrentMetrics(prev => ({
        ...prev,
        fcfPayoutRatioTTM: null
      }));
      return;
    }

    const years = Array.from(editableTableData.keys());
    const latestYear = Math.max(...years);
    const latestData = editableTableData.get(latestYear);
    
    if (latestData) {
      const latestFCF = latestData.freeCashFlow;
      const latestDividendsPaid = latestData.dividendsPaid;
      let fcfPayoutRatioTTM: number | null = null;
      if (latestFCF > 0 && latestDividendsPaid > 0) {
        fcfPayoutRatioTTM = latestDividendsPaid / latestFCF;
      }
      
      // Only update if the value actually changed
      setCurrentMetrics(prev => {
        if (prev.fcfPayoutRatioTTM === fcfPayoutRatioTTM) {
          return prev; // No change, return previous state to avoid re-render
        }
        return {
          ...prev,
          fcfPayoutRatioTTM: fcfPayoutRatioTTM
        };
      });
    }
  }, [editableTableData]);

  // Generate AI prompt with all data and calculations
  const handleAskAI = async () => {
    const symbol = selectedSymbol || ticker;
    if (!symbol) return;

    // Get all years with data, sorted
    const yearsWithData = Array.from(editableTableData.entries())
      .filter(([year, data]) => 
        data.freeCashFlow > 0 || 
        data.dividendsPaid > 0 || 
        data.adjustedDividend > 0
      )
      .map(([year]) => year)
      .sort((a, b) => a - b);

    // Build table data string
    let tableData = '';
    if (yearsWithData.length > 0) {
      tableData = '\n\n**Yearly Financial Data:**\n';
      tableData += '| Year | Free Cash Flow | Dividends Paid | FCF Payout Ratio | Adjusted Dividend | Payout Ratio |\n';
      tableData += '|------|----------------|---------------|------------------|-------------------|-------------|\n';
      
      yearsWithData.forEach(year => {
        const data = editableTableData.get(year);
        if (data) {
          const fcf = data.freeCashFlow > 0 ? data.freeCashFlow.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
          const divPaid = data.dividendsPaid > 0 ? data.dividendsPaid.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
          const fcfRatio = data.fcfPayoutRatio > 0 ? data.fcfPayoutRatio.toFixed(3) : '0.000';
          const adjDiv = data.adjustedDividend > 0 ? data.adjustedDividend.toFixed(2) : '0.00';
          const payoutRatio = data.payoutRatio > 0 ? data.payoutRatio.toFixed(2) : '0.00';
          tableData += `| ${year} | ${fcf} | ${divPaid} | ${fcfRatio} | ${adjDiv} | ${payoutRatio} |\n`;
        }
      });
    }

    // Build metrics string
    const metricsText = `
**Calculated Metrics:**
- 10 Year FCF CAGR: ${cagrMetrics.fcfCAGR10Y !== null ? formatPercent(cagrMetrics.fcfCAGR10Y) : 'N/A'}
- 5 Year FCF CAGR: ${cagrMetrics.fcfCAGR5Y !== null ? formatPercent(cagrMetrics.fcfCAGR5Y) : 'N/A'}
- 10 Year Dividend CAGR: ${cagrMetrics.dividendCAGR10Y !== null ? formatPercent(cagrMetrics.dividendCAGR10Y) : 'N/A'}
- 5 Year Dividend CAGR: ${cagrMetrics.dividendCAGR5Y !== null ? formatPercent(cagrMetrics.dividendCAGR5Y) : 'N/A'}
- Latest FCF Payout Ratio: ${metrics.latestPayoutRatio !== null ? metrics.latestPayoutRatio.toFixed(3) : 'N/A'}
`;

    const prompt = `I have analyzed the dividend and free cash flow (FCF) data for ${symbol.toUpperCase()}. Please review the following information:

**Stock Symbol:** ${symbol.toUpperCase()}
**Data Period:** ${yearsWithData.length > 0 ? `${yearsWithData[0]} to ${yearsWithData[yearsWithData.length - 1]}` : 'N/A'}
${tableData}
${metricsText}

Please provide the following analysis:

1. **Data Verification:** Confirm that the financial data appears correct for ${symbol.toUpperCase()}. Are the numbers reasonable for this company?

2. **Results Verification:** Verify that the calculated CAGR (Compound Annual Growth Rate) metrics and payout ratios are mathematically correct based on the provided data.

3. **Interpretation:** Describe what these metrics mean for ${symbol.toUpperCase()}:
   - What do the FCF CAGR values indicate about the company's cash generation growth?
   - What do the Dividend CAGR values indicate about dividend growth sustainability?
   - What does the FCF Payout Ratio tell us about dividend safety and sustainability?
   - Are there any red flags or positive signals in this data?

4. **Investment Advice:** Based on this analysis, provide actionable advice on:
   - How to use this information in investment decision-making
   - What to watch for going forward
   - How this compares to typical dividend growth stocks
   - Any recommendations for further analysis

Thank you!`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedToClipboard(true);
      setTimeout(() => setCopiedToClipboard(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy prompt to clipboard. Please try again.');
    }
  };

  const handleAskAICurrentMetrics = async () => {
    const symbol = selectedSymbol || ticker;
    if (!symbol) return;

    // Build table data string - show all years in tableYears
    let tableData = '';
    if (tableYears.length > 0) {
      tableData = '\n\n**Yearly Financial Data:**\n';
      tableData += '| Year | Free Cash Flow | Dividends Paid | FCF Payout Ratio | Adjusted Dividend | Payout Ratio |\n';
      tableData += '|------|----------------|---------------|------------------|-------------------|-------------|\n';
      
      tableYears.forEach(year => {
        const data = editableTableData.get(year);
        if (data) {
          const fcf = data.freeCashFlow > 0 ? data.freeCashFlow.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
          const divPaid = data.dividendsPaid > 0 ? data.dividendsPaid.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '0';
          const fcfRatio = data.fcfPayoutRatio > 0 ? data.fcfPayoutRatio.toFixed(3) : '0.000';
          const adjDiv = data.adjustedDividend > 0 ? data.adjustedDividend.toFixed(2) : '0.00';
          const payoutRatio = data.payoutRatio > 0 ? data.payoutRatio.toFixed(2) : '0.00';
          tableData += `| ${year} | ${fcf} | ${divPaid} | ${fcfRatio} | ${adjDiv} | ${payoutRatio} |\n`;
        } else {
          // If no data, show zeros
          tableData += `| ${year} | 0 | 0 | 0.000 | 0.00 | 0.00 |\n`;
        }
      });
    }

    // Build CAGR metrics string
    const cagrMetrics = calculateCAGRFromGrid();
    const formatPercentForPrompt = (value: number | null): string => {
      if (value === null) return 'N/A';
      return value >= 0 ? `+${value.toFixed(2)}%` : `${value.toFixed(2)}%`;
    };
    
    const cagrText = `
**CAGR Metrics:**
- 10 Year Dividend CAGR: ${formatPercentForPrompt(cagrMetrics.dividendCAGR10Y)}
- 5 Year Dividend CAGR: ${formatPercentForPrompt(cagrMetrics.dividendCAGR5Y)}
- 10 Year FCF CAGR: ${formatPercentForPrompt(cagrMetrics.fcfCAGR10Y)}
- 5 Year FCF CAGR: ${formatPercentForPrompt(cagrMetrics.fcfCAGR5Y)}
`;

    // Build current metrics string
    const currentMetricsText = `
**Current Metrics:**
- Price: ${currentMetrics.price !== null ? `$${currentMetrics.price.toFixed(2)}` : 'N/A'}
- Dividend Payout: ${currentMetrics.dividendPayout !== null ? `$${currentMetrics.dividendPayout.toFixed(2)}` : 'N/A'}
- Dividend Yield: ${currentMetrics.dividendYield !== null ? `${currentMetrics.dividendYield.toFixed(2)}%` : 'N/A'}
- Payout Ratio TTM: ${currentMetrics.payoutRatioTTM !== null ? `${(currentMetrics.payoutRatioTTM * 100).toFixed(1)}%` : 'N/A'}
- FCF Payout Ratio TTM: ${currentMetrics.fcfPayoutRatioTTM !== null ? `${(currentMetrics.fcfPayoutRatioTTM * 100).toFixed(1)}%` : 'N/A'}
`;

    const prompt = `I have analyzed the dividend and free cash flow (FCF) data for ${symbol.toUpperCase()}. Please review the following information:

**Stock Symbol:** ${symbol.toUpperCase()}
${tableData}
${cagrText}
${currentMetricsText}

Please provide the following analysis:

1. **Data Verification:** Are these values correct for ${symbol.toUpperCase()}? Please verify:
   - Are the financial data numbers reasonable for this company?
   - Are the CAGR calculations mathematically correct?
   - Are the current metrics (Price, Dividend Payout, Dividend Yield, Payout Ratios) accurate?

2. **Interpretation:** Explain to me what these values mean:
   - What do the CAGR (Compound Annual Growth Rate) metrics indicate about the company's growth trajectory?
   - What does the FCF Payout Ratio TTM tell us about dividend safety and sustainability?
   - What does the Payout Ratio TTM indicate about the company's dividend policy?
   - How do these metrics compare to industry standards?

3. **Investment Recommendation:** Based on this analysis, provide a clear recommendation:
   - Is ${symbol.toUpperCase()} a BUY, HOLD, or SELL based on these metrics?
   - What are the key strengths and weaknesses revealed by this data?
   - What should I watch for going forward?
   - What are the risks and opportunities?

Thank you!`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedToClipboard2(true);
      setTimeout(() => setCopiedToClipboard2(false), 3000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy prompt to clipboard. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">

        {/* Symbol Selection and Ticker Input */}
        <div className="mb-6 space-y-4">
          {/* Database Symbol Dropdown and Save Button */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <select
                id="symbol-select"
                value={selectedSymbol}
                onChange={(e) => handleSymbolSelect(e.target.value)}
                disabled={loadingSymbols || loading}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a symbol from database...</option>
                {availableSymbols.map(symbol => (
                  <option key={symbol} value={symbol}>{symbol}</option>
                ))}
              </select>
            </div>
            <button
              onClick={saveAllToDatabase}
              disabled={!canSave() || loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleClear}
              disabled={loading}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
            >
              Clear
            </button>
          </div>

          {/* Ticker Input for API Search */}
          <form onSubmit={handleSubmit} className="flex gap-4 items-end">
            <div className="flex-1">
              <input
                id="ticker"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="Enter ticker (e.g., AAPL)"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !ticker.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
            >
              {loading ? 'Loading...' : 'Load Values'}
            </button>
            <button
              type="button"
              onClick={handleAskAI}
              disabled={!ticker.trim() && !selectedSymbol}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
            >
              {copiedToClipboard ? '✓ Copied!' : 'Ask AI'}
            </button>
          </form>
        </div>

        {/* Error/Info Message */}
        {error && (
          <div className={`mb-6 p-4 rounded-lg border ${
            error.includes('ℹ️') || error.includes('Note:')
              ? 'bg-blue-100 dark:bg-blue-900/20 border-blue-300 dark:border-blue-800'
              : 'bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-800'
          }`}>
            <p className={error.includes('ℹ️') || error.includes('Note:')
              ? 'text-blue-800 dark:text-blue-200'
              : 'text-red-800 dark:text-red-200'
            }>{error}</p>
          </div>
        )}

        {/* Summary Table - Always shown */}
        {tableYears.length > 0 && (
          <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700">
                      Year
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Free Cash Flow
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Dividends Paid
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      FCF Payout Ratio
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Adjusted Dividend
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Payout Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {tableYears.map(year => {
                    const freeCashFlow = getCellValue(year, 'freeCashFlow');
                    const dividendsPaid = getCellValue(year, 'dividendsPaid');
                    const fcfPayoutRatio = getCellValue(year, 'fcfPayoutRatio');
                    const adjustedDividend = getCellValue(year, 'adjustedDividend');
                    const payoutRatio = getCellValue(year, 'payoutRatio');
                    
                    // Show "0" for empty values so rows are visible and editable
                    const fcfDisplay = freeCashFlow === 0 ? '0' : freeCashFlow.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
                    const divPaidDisplay = dividendsPaid === 0 ? '0' : dividendsPaid.toLocaleString('en-US', { maximumFractionDigits: 0, minimumFractionDigits: 0 });
                    const fcfRatioDisplay = fcfPayoutRatio === 0 ? '0.000' : fcfPayoutRatio.toFixed(3);
                    const adjDivDisplay = adjustedDividend === 0 ? '0.00' : adjustedDividend.toFixed(2);
                    const payoutRatioDisplay = payoutRatio === 0 ? '0.00' : payoutRatio.toFixed(2);
                    
                    return (
                      <tr key={year} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                          {year}
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <input
                            type="text"
                            value={fcfDisplay}
                            onChange={(e) => updateCellValue(year, 'freeCashFlow', parseFormattedNumber(e.target.value))}
                            onBlur={(e) => {
                              const numValue = parseFormattedNumber(e.target.value);
                              updateCellValue(year, 'freeCashFlow', numValue);
                            }}
                            className="w-32 px-2 py-1 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <input
                            type="text"
                            value={divPaidDisplay}
                            onChange={(e) => updateCellValue(year, 'dividendsPaid', parseFormattedNumber(e.target.value))}
                            onBlur={(e) => {
                              const numValue = parseFormattedNumber(e.target.value);
                              updateCellValue(year, 'dividendsPaid', numValue);
                            }}
                            className="w-32 px-2 py-1 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <input
                            type="text"
                            value={fcfRatioDisplay}
                            onChange={(e) => updateCellValue(year, 'fcfPayoutRatio', parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              updateCellValue(year, 'fcfPayoutRatio', numValue);
                            }}
                            className="w-24 px-2 py-1 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.000"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <input
                            type="text"
                            value={adjDivDisplay}
                            onChange={(e) => updateCellValue(year, 'adjustedDividend', parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              updateCellValue(year, 'adjustedDividend', numValue);
                            }}
                            className="w-32 px-2 py-1 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <input
                            type="text"
                            value={payoutRatioDisplay}
                            onChange={(e) => updateCellValue(year, 'payoutRatio', parseFloat(e.target.value) || 0)}
                            onBlur={(e) => {
                              const numValue = parseFloat(e.target.value) || 0;
                              updateCellValue(year, 'payoutRatio', numValue);
                            }}
                            className="w-24 px-2 py-1 text-center text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* CAGR Metrics Table and Current Metrics Table */}
        <div className="mb-6 flex gap-4">
          {/* CAGR Metrics Table - 50% width */}
          <div className="w-1/2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700">
                        Metric
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        10 Year Dividend CAGR
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {cagrMetrics.dividendCAGR10Y !== null ? formatPercent(cagrMetrics.dividendCAGR10Y) : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        5 Year Dividend CAGR
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {cagrMetrics.dividendCAGR5Y !== null ? formatPercent(cagrMetrics.dividendCAGR5Y) : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        10 Year FCF CAGR
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {cagrMetrics.fcfCAGR10Y !== null ? formatPercent(cagrMetrics.fcfCAGR10Y) : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        5 Year FCF CAGR
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {cagrMetrics.fcfCAGR5Y !== null ? formatPercent(cagrMetrics.fcfCAGR5Y) : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Current Metrics Table - 50% width */}
          <div className="w-1/2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-gray-200 dark:border-gray-700">
                        Metric
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        Price
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {currentMetrics.price !== null ? `$${currentMetrics.price.toFixed(2)}` : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        Dividend Payout
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {currentMetrics.dividendPayout !== null ? `$${currentMetrics.dividendPayout.toFixed(2)}` : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        Dividend Yield
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {currentMetrics.dividendYield !== null ? `${currentMetrics.dividendYield.toFixed(2)}%` : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        Payout Ratio TTM
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {currentMetrics.payoutRatioTTM !== null ? `${(currentMetrics.payoutRatioTTM * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        FCF Payout Ratio TTM
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                        {currentMetrics.fcfPayoutRatioTTM !== null ? `${(currentMetrics.fcfPayoutRatioTTM * 100).toFixed(1)}%` : 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            {/* Ask AI Button for Current Metrics */}
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={handleAskAICurrentMetrics}
                disabled={!ticker.trim() && !selectedSymbol}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
              >
                {copiedToClipboard2 ? '✓ Copied!' : 'Ask AI'}
              </button>
            </div>
          </div>
        </div>

        {/* FCF Payout Ratio Over Time Graph - Full Width */}
        {tableYears.length > 0 && (() => {
          // Prepare chart data from editableTableData
          const payoutRatioChartData = tableYears
            .map(year => {
              const fcfPayoutRatio = getCellValue(year, 'fcfPayoutRatio');
              return {
                year: year.toString(),
                payoutRatio: fcfPayoutRatio > 0 ? fcfPayoutRatio : null
              };
            })
            .filter(item => item.payoutRatio !== null);

          if (payoutRatioChartData.length === 0) {
            return null;
          }

          return (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                FCF Payout Ratio Over Time
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={payoutRatioChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="year"
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                  />
                  <YAxis
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                    tickFormatter={(tick) => tick.toFixed(3)}
                    width={80}
                    label={{ value: 'FCF Payout Ratio', angle: -90, position: 'left', style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.9)', fontSize: 16, fontWeight: 'bold' }, offset: 15 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value.toFixed(3), 'FCF Payout Ratio']}
                    labelFormatter={(label) => `Year: ${label}`}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    labelStyle={{ color: '#1f2937' }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="payoutRatio"
                    name="FCF Payout Ratio"
                    stroke="#8884d8"
                    strokeWidth={2}
                    activeDot={{ r: 8 }}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              
              {/* Explanation Section for FCF Payout Ratio Over Time */}
              <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3">
                  📊 What to Look For: Interpreting FCF Payout Ratio Over Time
                </h3>
                <div className="space-y-3 text-sm text-purple-800 dark:text-purple-200">
                  <div>
                    <strong className="font-semibold">1. Understanding the Ratio:</strong> The FCF Payout Ratio shows what percentage of Free Cash Flow is paid out as dividends. A ratio of <strong>0.50</strong> means 50% of FCF goes to dividends, leaving 50% for reinvestment and growth.
                  </div>
                  <div>
                    <strong className="font-semibold">2. Ideal Range:</strong> For dividend kingdom stocks, look for ratios typically between <strong>0.30 and 0.70</strong>:
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li><strong>Below 0.30:</strong> Very conservative, room for significant dividend increases</li>
                      <li><strong>0.30-0.50:</strong> Healthy balance, sustainable with growth potential</li>
                      <li><strong>0.50-0.70:</strong> Higher payout, still sustainable but less room for growth</li>
                      <li><strong>Above 0.70:</strong> Warning sign - may be unsustainable long-term</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="font-semibold">3. Trend Analysis:</strong> Look for <strong>stable or declining trends</strong>:
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li><strong>Declining ratio:</strong> Good sign - dividends growing slower than FCF, improving sustainability</li>
                      <li><strong>Stable ratio:</strong> Healthy - company maintaining balance as both grow</li>
                      <li><strong>Rising ratio:</strong> Monitor closely - may indicate dividends growing faster than FCF can support</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="font-semibold">4. Consistency Matters:</strong> The line should be <strong>relatively smooth</strong> without wild swings. Erratic patterns suggest:
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Unpredictable cash flow generation</li>
                      <li>Inconsistent dividend policy</li>
                      <li>Potential financial instability</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="font-semibold">5. Red Flags to Avoid:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Ratio consistently above 0.80 or 0.90 (unsustainable)</li>
                      <li>Ratio above 1.0 (paying more in dividends than generating FCF - major red flag)</li>
                      <li>Sharp upward spikes (dividend increases outpacing FCF growth)</li>
                      <li>Extreme volatility year-to-year</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-purple-300 dark:border-purple-700">
                    <strong className="font-semibold">💡 Ideal Dividend Kingdom Stock:</strong> A company with an FCF Payout Ratio that stays within a healthy range (0.30-0.70), shows a stable or slightly declining trend over time, and demonstrates consistency. This indicates the company can sustainably pay and grow dividends while maintaining financial flexibility for reinvestment and growth opportunities.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Metrics Cards */}
        {yearlyData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">10Y FCF CAGR</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercent(metrics.fcfCAGR10Y)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">5Y FCF CAGR</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercent(metrics.fcfCAGR5Y)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">10Y Dividend CAGR</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercent(metrics.dividendCAGR10Y)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">5Y Dividend CAGR</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatPercent(metrics.dividendCAGR5Y)}
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Latest FCF Payout Ratio</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.latestPayoutRatio !== null ? metrics.latestPayoutRatio.toFixed(3) : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Charts */}
        {chartData.length > 0 && (
          <div className="space-y-6 mb-6">
            {/* Chart 1: FCF Payout Ratio Over Time */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                FCF Payout Ratio Over Time
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="year" 
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                  />
                  <YAxis 
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                    width={80}
                    label={{ value: 'Payout Ratio', angle: -90, position: 'left', style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.9)', fontSize: 16, fontWeight: 'bold' }, offset: 15 }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6'
                    }}
                    formatter={(value: any) => Number(value).toFixed(3)}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="payoutRatio" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Payout Ratio"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Free Cash Flow vs Dividends */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Free Cash Flow vs Dividends
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="year" 
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                  />
                  <YAxis 
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                    width={80}
                    label={{ value: 'Amount ($)', angle: -90, position: 'left', style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.9)', fontSize: 16, fontWeight: 'bold' }, offset: 15 }}
                    tickFormatter={(value) => formatNumber(value)}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1f2937', 
                      border: '1px solid #374151',
                      borderRadius: '8px',
                      color: '#f3f4f6'
                    }}
                    formatter={(value: any) => formatNumber(value)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="freeCashFlow" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Free Cash Flow"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="dividendsPaid" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    name="Dividends Paid"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Data Table */}
        {yearlyData.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Yearly Data
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Free Cash Flow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Dividends Paid
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      FCF Payout Ratio
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {yearlyData.map((item) => (
                    <tr key={item.year} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {item.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {formatNumber(item.freeCashFlow)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {formatNumber(item.dividendsPaid)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                        {item.payoutRatio.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Free Cash Flow vs Dividends Paid Graph - Full Width at Bottom */}
        {tableYears.length > 0 && (() => {
          // Prepare chart data from editableTableData
          const fcfVsDividendsData = tableYears
            .map(year => {
              const freeCashFlow = getCellValue(year, 'freeCashFlow');
              const dividendsPaid = getCellValue(year, 'dividendsPaid');
              return {
                year: year.toString(),
                freeCashFlow: freeCashFlow > 0 ? freeCashFlow : null,
                dividendsPaid: dividendsPaid > 0 ? dividendsPaid : null
              };
            })
            .filter(item => item.freeCashFlow !== null || item.dividendsPaid !== null);

          if (fcfVsDividendsData.length === 0) {
            return null;
          }

          return (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Free Cash Flow vs Dividends Paid
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={fcfVsDividendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="year"
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                  />
                  <YAxis
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                    tickFormatter={(tick) => {
                      if (tick >= 1000000000) return `${(tick / 1000000000).toFixed(1)}B`;
                      if (tick >= 1000000) return `${(tick / 1000000).toFixed(1)}M`;
                      if (tick >= 1000) return `${(tick / 1000).toFixed(1)}K`;
                      return tick.toString();
                    }}
                    width={80}
                    label={{ value: 'Amount ($)', angle: -90, position: 'left', style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.9)', fontSize: 16, fontWeight: 'bold' }, offset: 15 }}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      const formatted = value >= 1000000000
                        ? `${(value / 1000000000).toFixed(2)}B`
                        : value >= 1000000
                        ? `${(value / 1000000).toFixed(2)}M`
                        : value >= 1000
                        ? `${(value / 1000).toFixed(2)}K`
                        : value.toLocaleString('en-US', { maximumFractionDigits: 0 });
                      return [formatted, name];
                    }}
                    labelFormatter={(label) => `Year: ${label}`}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    labelStyle={{ color: '#1f2937' }}
                  />
                  <Legend />
                  <Bar
                    dataKey="freeCashFlow"
                    name="Free Cash Flow"
                    fill="#3b82f6"
                  />
                  <Bar
                    dataKey="dividendsPaid"
                    name="Dividends Paid"
                    fill="#ef4444"
                  />
                </BarChart>
              </ResponsiveContainer>
              
              {/* Explanation Section for Dividend Kingdom Analysis */}
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
                  📊 What to Look For: Evaluating Dividend Kingdom Candidates
                </h3>
                <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                  <div>
                    <strong className="font-semibold">1. Free Cash Flow Coverage:</strong> The blue bars (Free Cash Flow) should be consistently <strong>higher</strong> than the red bars (Dividends Paid). This shows the company generates enough cash to comfortably cover its dividend payments, providing a safety cushion.
                  </div>
                  <div>
                    <strong className="font-semibold">2. Growing Trend:</strong> Both lines should show an <strong>upward trajectory</strong> over time. Growing FCF indicates the business is healthy and expanding, while growing dividends show management&apos;s commitment to rewarding shareholders.
                  </div>
                  <div>
                    <strong className="font-semibold">3. Healthy Gap:</strong> There should be a <strong>meaningful gap</strong> between Free Cash Flow and Dividends Paid. A large gap (FCF significantly exceeds dividends) indicates:
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Room for future dividend increases</li>
                      <li>Ability to reinvest in the business</li>
                      <li>Protection during economic downturns</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="font-semibold">4. Consistency:</strong> Look for <strong>stable, predictable patterns</strong>. Avoid companies with erratic FCF or dividend payments, as this suggests business instability or unreliable dividend policies.
                  </div>
                  <div>
                    <strong className="font-semibold">5. Red Flags to Avoid:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Dividends Paid exceeding Free Cash Flow (dividend is not sustainable)</li>
                      <li>Declining FCF while dividends remain flat or grow (unsustainable long-term)</li>
                      <li>Erratic patterns with large year-to-year swings</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-blue-300 dark:border-blue-700">
                    <strong className="font-semibold">💡 Ideal Dividend Kingdom Stock:</strong> A company where Free Cash Flow consistently exceeds Dividends Paid by a healthy margin, both metrics show steady growth over time, and the pattern demonstrates reliability and sustainability. This indicates a strong candidate for a dividend growth portfolio.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Yearly Dividends Bar Chart - Full Width */}
        {tableYears.length > 0 && (() => {
          // Prepare chart data from editableTableData
          const yearlyDividendsData = tableYears
            .map(year => {
              const adjustedDividend = getCellValue(year, 'adjustedDividend');
              return {
                year: year.toString(),
                adjustedDividend: adjustedDividend > 0 ? adjustedDividend : null
              };
            })
            .filter(item => item.adjustedDividend !== null);

          if (yearlyDividendsData.length === 0) {
            return null;
          }

          return (
            <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Yearly Dividends
              </h2>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={yearlyDividendsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="year"
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                  />
                  <YAxis
                    stroke="rgba(107, 114, 128, 0.5)"
                    tick={{ fill: 'rgba(107, 114, 128, 0.9)', fontSize: 14 }}
                    tickFormatter={(tick) => {
                      if (tick >= 1000000000) return `$${(tick / 1000000000).toFixed(1)}B`;
                      if (tick >= 1000000) return `$${(tick / 1000000).toFixed(1)}M`;
                      if (tick >= 1000) return `$${(tick / 1000).toFixed(1)}K`;
                      return `$${tick.toFixed(2)}`;
                    }}
                    width={80}
                    label={{ value: 'Dividend Amount ($)', angle: -90, position: 'left', style: { textAnchor: 'middle', fill: 'rgba(107, 114, 128, 0.9)', fontSize: 16, fontWeight: 'bold' }, offset: 15 }}
                  />
                  <Tooltip
                    formatter={(value: number) => {
                      const formatted = value >= 1000000000
                        ? `$${(value / 1000000000).toFixed(2)}B`
                        : value >= 1000000
                        ? `$${(value / 1000000).toFixed(2)}M`
                        : value >= 1000
                        ? `$${(value / 1000).toFixed(2)}K`
                        : `$${value.toFixed(2)}`;
                      return [formatted, 'Adjusted Dividend'];
                    }}
                    labelFormatter={(label) => `Year: ${label}`}
                    contentStyle={{ backgroundColor: 'rgba(255,255,255,0.9)', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                    labelStyle={{ color: '#1f2937' }}
                  />
                  <Legend />
                  <Bar
                    dataKey="adjustedDividend"
                    name="Adjusted Dividend"
                    fill="#10b981"
                    label={{
                      position: 'top',
                      formatter: (label: any) => {
                        const value = typeof label === 'number' ? label : (label?.value ?? 0);
                        return value > 0 ? `$${value.toFixed(2)}` : '';
                      },
                      fill: 'rgba(107, 114, 128, 0.9)',
                      fontSize: 12,
                      fontWeight: 'bold'
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
              
              {/* Explanation Section for Yearly Dividends Analysis */}
              <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-3">
                  📈 What to Look For: Evaluating Dividend Growth for Dividend Kingdom
                </h3>
                <div className="space-y-3 text-sm text-green-800 dark:text-green-200">
                  <div>
                    <strong className="font-semibold">1. Consistent Growth Pattern:</strong> Look for a <strong>steady upward trend</strong> in dividend payments over time. The bars should generally increase from left to right (oldest to newest year), showing the company&apos;s commitment to growing shareholder returns.
                  </div>
                  <div>
                    <strong className="font-semibold">2. No Cuts or Suspensions:</strong> A strong dividend kingdom candidate should have <strong>no years with zero dividends</strong> or significant decreases. Even during economic downturns, dividend aristocrats and kings maintain or increase their payouts.
                  </div>
                  <div>
                    <strong className="font-semibold">3. Growth Rate:</strong> Calculate the <strong>compound annual growth rate (CAGR)</strong> of dividends. Ideal candidates show:
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>5-year CAGR of 5% or higher</li>
                      <li>10-year CAGR showing consistent long-term growth</li>
                      <li>Growth that outpaces inflation (typically 2-3%)</li>
                    </ul>
                  </div>
                  <div>
                    <strong className="font-semibold">4. Predictability:</strong> The pattern should be <strong>smooth and predictable</strong>, not erratic. Companies that raise dividends annually (or quarterly) demonstrate financial discipline and shareholder-friendly management.
                  </div>
                  <div>
                    <strong className="font-semibold">5. Red Flags to Avoid:</strong>
                    <ul className="list-disc list-inside mt-1 ml-4 space-y-1">
                      <li>Flat or declining dividends over multiple years</li>
                      <li>Erratic patterns with large swings up and down</li>
                      <li>Recent dividend cuts or suspensions</li>
                      <li>Dividends that don&apos;t keep pace with inflation</li>
                    </ul>
                  </div>
                  <div className="pt-2 border-t border-green-300 dark:border-green-700">
                    <strong className="font-semibold">💡 Ideal Dividend Kingdom Stock:</strong> A company that shows consistent, predictable dividend growth year-over-year, with no cuts or suspensions, and a strong CAGR that demonstrates management&apos;s commitment to rewarding shareholders. This graph should tell a story of reliability and growth - the foundation of a strong dividend portfolio.
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
