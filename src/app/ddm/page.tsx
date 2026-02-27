'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface DividendProjection {
  year: string;
  dividend: number;
  growthRate: number;
}

interface DDMInputs {
  currentPrice: number;
  wacc: number;
  marginOfSafety: number;
  highGrowthYears: number;
  stableGrowthRate: number;
}

interface DDMCalculation {
  year: string;
  ddmPrice: number;
  discountFactor: number;
  presentValue: number;
}

interface StockOption {
  symbol: string;
  lastUpdated: string;
}

export default function DDMPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [stocks, setStocks] = useState<StockOption[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string>('');
  
  const [inputs, setInputs] = useState<DDMInputs>({
    currentPrice: 0,
    wacc: 8.5,
    marginOfSafety: 20.0,
    highGrowthYears: 5,
    stableGrowthRate: 3.0
  });

  const [showCurrentPrice, setShowCurrentPrice] = useState<boolean>(false);
  const [dividendProjections, setDividendProjections] = useState<DividendProjection[]>([]);
  const [ddmCalculations, setDdmCalculations] = useState<DDMCalculation[]>([]);
  const [intrinsicValue, setIntrinsicValue] = useState<number>(0);
  const [ddmWithSafety, setDdmWithSafety] = useState<number>(0);
  const [terminalValue, setTerminalValue] = useState<number>(0);
  const [verdict, setVerdict] = useState<string>('');
  const [aiPromptLoading, setAiPromptLoading] = useState<boolean>(false);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Initialize dividend projections with all years (2020 to current)
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 2020;
    const years: string[] = [];
    for (let year = startYear; year <= currentYear; year++) {
      years.push(year.toString());
    }
    
    const defaultProjections: DividendProjection[] = years.map(year => ({
      year,
      dividend: 0,
      growthRate: 0
    }));
    
    setDividendProjections(defaultProjections);
  }, []);

  // Load list of stocks from database
  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/ddm-data');
        if (response.ok) {
          const data = await response.json();
          setStocks(data.stocks || []);
        }
      } catch (error) {
        console.error('Error fetching stocks:', error);
      }
    };
    fetchStocks();
  }, []);

  // Check for symbol query parameter on mount
  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam && symbolParam !== selectedSymbol) {
      setSelectedSymbol(symbolParam.toUpperCase());
      loadStockData(symbolParam.toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // If no query param, auto-load symbol from localStorage (same logic as Company Research page)
  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      // Query parameter takes precedence over localStorage
      return;
    }

    const loadFromStorage = async () => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return;

        const dcfData = localStorage.getItem('dcfData');
        if (dcfData) {
          const parsedData = JSON.parse(dcfData);
          if (parsedData.symbol && !selectedSymbol) {
            const upper = parsedData.symbol.toUpperCase();
            setSelectedSymbol(upper);
            await loadStockData(upper);
          }
        }
      } catch (error) {
        console.error('Error loading symbol from localStorage for DDM:', error);
      }
    };

    loadFromStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load DDM data when symbol is selected
  const loadStockData = async (symbol: string) => {
    if (!symbol) {
      // Reset to empty state
      setInputs({
        currentPrice: 0,
        wacc: 8.5,
        marginOfSafety: 20.0,
        highGrowthYears: 5,
        stableGrowthRate: 3.0
      });
      setDividendProjections([]);
      setShowCurrentPrice(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/ddm-data?symbol=${symbol}`);
      if (response.ok) {
        const data = await response.json();
        
        // Load inputs
        setInputs({
          currentPrice: data.currentPrice || 0,
          wacc: data.wacc || 8.5,
          marginOfSafety: data.marginOfSafety || 20.0,
          highGrowthYears: data.highGrowthYears || 5,
          stableGrowthRate: data.stableGrowthRate || 3.0
        });
        
        setShowCurrentPrice(data.currentPrice > 0);
        
        // Load dividend projections
        if (data.dividendProjections && Array.isArray(data.dividendProjections)) {
          // If we already have projections but all dividends are zero, treat it as "empty"
          // and rebuild from dividendsByYear so we can show real historical values
          const hasNonZeroDividend = data.dividendProjections.some(
            (p: any) => p && typeof p.dividend === 'number' && p.dividend !== 0
          );

          if (hasNonZeroDividend) {
            setDividendProjections(data.dividendProjections);
          } else if (data.dividendsByYear) {
            // Rebuild from dividendsByYear
            const currentYear = new Date().getFullYear();
            const startYear = 2020;
            const sortedYears = Object.keys(data.dividendsByYear)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .filter(year => parseInt(year) >= startYear && parseInt(year) <= currentYear);

            const projections: DividendProjection[] = sortedYears.map((year, index) => {
              const dividend = data.dividendsByYear[year];
              let growthRate = 0;

              if (index > 0) {
                const previousYear = sortedYears[index - 1];
                const previousDividend = data.dividendsByYear[previousYear];
                if (previousDividend > 0) {
                  growthRate = ((dividend - previousDividend) / previousDividend) * 100;
                }
              }

              return { year, dividend, growthRate };
            });

            setDividendProjections(projections);
          } else {
            // Keep whatever default projections are already initialised
            // (the initial useEffect sets up 2020..current with zeroes)
          }
        } else if (data.dividendsByYear) {
          // Fallback: create projections from dividendsByYear
          const currentYear = new Date().getFullYear();
          const startYear = 2020;
          const sortedYears = Object.keys(data.dividendsByYear)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .filter(year => parseInt(year) >= startYear && parseInt(year) <= currentYear);
          
          const projections: DividendProjection[] = sortedYears.map((year, index) => {
            const dividend = data.dividendsByYear[year];
            let growthRate = 0;
            
            if (index > 0) {
              const previousYear = sortedYears[index - 1];
              const previousDividend = data.dividendsByYear[previousYear];
              if (previousDividend > 0) {
                growthRate = ((dividend - previousDividend) / previousDividend) * 100;
              }
            }
            
            return { year, dividend, growthRate };
          });
          
          setDividendProjections(projections);
        }
      } else {
        console.error('Failed to load stock data');
      }
    } catch (error) {
      console.error('Error loading stock data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle symbol selection
  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    loadStockData(symbol);
  };

  // Calculate discount factor for a given year
  const calculateDiscountFactor = (yearNumber: number): number => {
    return Math.pow(1 + inputs.wacc / 100, -yearNumber);
  };

  // Calculate DDM projections for high growth years
  const calculateDDMProjections = (): DDMCalculation[] => {
    if (dividendProjections.length === 0) return [];
    
    const calculations: DDMCalculation[] = [];
    
    // Get the latest year and dividend from historical data
    const latestHistorical = dividendProjections[dividendProjections.length - 1];
    const latestYear = parseInt(latestHistorical.year);
    const latestDividend = latestHistorical.dividend;
    const latestGrowthRate = latestHistorical.growthRate;
    
    const startYear = latestYear + 1;
    
    for (let i = 0; i < inputs.highGrowthYears; i++) {
      const year = (startYear + i).toString();
      const yearNumber = i + 1;
      
      // Calculate dividend for this year
      const previousDividend = i === 0 ? latestDividend : calculations[i - 1].ddmPrice;
      const growthRate = latestGrowthRate;
      const ddmPrice = previousDividend * (1 + growthRate / 100);
      
      const discountFactor = calculateDiscountFactor(yearNumber);
      const presentValue = ddmPrice * discountFactor;
      
      calculations.push({
        year,
        ddmPrice,
        discountFactor,
        presentValue
      });
    }
    
    return calculations;
  };

  // Calculate terminal value using Gordon Growth Model
  const calculateTerminalValue = (): number => {
    const ddmCalculations = calculateDDMProjections();
    if (ddmCalculations.length === 0) return 0;
    
    const lastProjectedDividend = ddmCalculations[ddmCalculations.length - 1].ddmPrice;
    const terminalDividend = lastProjectedDividend * (1 + inputs.stableGrowthRate / 100);
    
    if (inputs.wacc <= inputs.stableGrowthRate) return 0;
    
    const terminalValue = terminalDividend / ((inputs.wacc - inputs.stableGrowthRate) / 100);
    return terminalValue;
  };

  // Calculate present value of terminal value
  const calculateTerminalValuePV = (terminalValue: number): number => {
    const discountFactor = calculateDiscountFactor(inputs.highGrowthYears);
    return terminalValue * discountFactor;
  };

  // Update DDM calculations when inputs change
  useEffect(() => {
    const calculations = calculateDDMProjections();
    setDdmCalculations(calculations);
    
    const terminalVal = calculateTerminalValue();
    setTerminalValue(terminalVal);
    
    const terminalPV = calculateTerminalValuePV(terminalVal);
    const totalPV = calculations.reduce((sum, calc) => sum + calc.presentValue, 0);
    const intrinsicVal = totalPV + terminalPV;
    setIntrinsicValue(intrinsicVal);
    
    const ddmSafety = intrinsicVal * (1 - inputs.marginOfSafety / 100);
    setDdmWithSafety(ddmSafety);
    
    let verdictText = 'N/A';
    if (inputs.currentPrice > 0) {
      verdictText = 'WAIT';
      if (inputs.currentPrice <= ddmSafety) {
        verdictText = 'BUY';
      } else if (inputs.currentPrice <= intrinsicVal) {
        verdictText = 'HOLD';
      }
    }
    setVerdict(verdictText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, dividendProjections]);

  const handleInputChange = (field: keyof DDMInputs, value: number) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDividendChange = (index: number, field: keyof DividendProjection, value: number) => {
    setDividendProjections(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  // Save DDM data to database
  const handleSave = async () => {
    if (!selectedSymbol) {
      setSaveMessage('Please select a stock symbol first');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    setSaving(true);
    setSaveMessage('');

    try {
      // Check if symbol exists
      const checkResponse = await fetch(`/api/ddm-data?symbol=${selectedSymbol}`);
      const exists = checkResponse.ok;

      const saveData = {
        symbol: selectedSymbol,
        wacc: inputs.wacc,
        marginOfSafety: inputs.marginOfSafety,
        highGrowthYears: inputs.highGrowthYears,
        stableGrowthRate: inputs.stableGrowthRate,
        currentPrice: inputs.currentPrice || null,
        dividendProjections: dividendProjections,
        intrinsicValue: intrinsicValue,
        ddmWithSafety: ddmWithSafety,
        terminalValue: terminalValue
      };

      let response;
      if (exists) {
        // Update existing
        response = await fetch('/api/ddm-data', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData)
        });
      } else {
        // Create new
        response = await fetch('/api/ddm-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saveData)
        });
      }

      if (response.ok) {
        setSaveMessage(`✅ ${exists ? 'Updated' : 'Saved'} successfully!`);
        setTimeout(() => setSaveMessage(''), 3000);
        
        // Refresh stocks list
        const stocksResponse = await fetch('/api/ddm-data');
        if (stocksResponse.ok) {
          const data = await stocksResponse.json();
          setStocks(data.stocks || []);
        }
      } else {
        const error = await response.json();
        setSaveMessage(`❌ Error: ${error.error || 'Failed to save'}`);
        setTimeout(() => setSaveMessage(''), 5000);
      }
    } catch (error: any) {
      setSaveMessage(`❌ Error: ${error.message || 'Failed to save'}`);
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleRecalculate = () => {
    // Force a recalculation by touching state and show brief visual feedback
    setRecalculating(true);
    // Trigger useEffect by cloning current inputs and projections
    setInputs(prev => ({ ...prev }));
    setDividendProjections(prev => prev.map(p => ({ ...p })));
    setTimeout(() => setRecalculating(false), 300);
  };

  const handleReset = () => {
    setSelectedSymbol('');
    setInputs({
      currentPrice: 0,
      wacc: 8.5,
      marginOfSafety: 20.0,
      highGrowthYears: 5,
      stableGrowthRate: 3.0
    });
    setDividendProjections([]);
    setDdmCalculations([]);
    setIntrinsicValue(0);
    setDdmWithSafety(0);
    setTerminalValue(0);
    setVerdict('N/A');
    setShowCurrentPrice(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">
            Dividend Discount Model (DDM) Calculator
          </h1>

          {/* Stock Selection Dropdown */}
          <div className="mb-4 flex items-center gap-2">
            <select
              id="stock-select"
              value={selectedSymbol}
              onChange={(e) => handleSymbolChange(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select a stock --</option>
              {stocks.map((stock) => (
                <option key={stock.symbol} value={stock.symbol}>
                  {stock.symbol}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Clear
            </button>
          </div>

          {/* Summary/Verdict Section */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border text-center">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">Symbol</h3>
              <input
                type="text"
                value={selectedSymbol}
                onChange={(e) => {
                  const newSymbol = e.target.value.toUpperCase();
                  setSelectedSymbol(newSymbol);
                  if (newSymbol) {
                    loadStockData(newSymbol);
                  } else {
                    handleReset();
                  }
                }}
                className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 w-full"
                placeholder="Enter symbol"
              />
            </div>
            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border text-center">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">Current Price</h3>
              <div className="flex items-center justify-center gap-2 w-full">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">£</span>
                <input
                  type="number"
                  step="0.01"
                  value={inputs.currentPrice}
                  onChange={(e) => handleInputChange('currentPrice', parseFloat(e.target.value) || 0)}
                  className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none w-24 text-center"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border text-center">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">Intrinsic Value</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white text-center">£{intrinsicValue.toFixed(2)}</p>
            </div>

            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border text-center">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">DDM with Safety</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white text-center">£{ddmWithSafety.toFixed(2)}</p>
            </div>

            <div className={`p-4 rounded-lg ${
              verdict === 'BUY' 
                ? 'bg-green-100 dark:bg-green-900/20' 
                : verdict === 'HOLD' 
                ? 'bg-yellow-100 dark:bg-yellow-900/20' 
                : 'bg-red-100 dark:bg-red-900/20'
            } text-center`}>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2 text-center">Verdict</h3>
              <p className={`text-2xl font-bold ${
                verdict === 'BUY' 
                  ? 'text-green-600 dark:text-green-400' 
                  : verdict === 'HOLD' 
                  ? 'text-yellow-600 dark:text-yellow-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>{verdict || 'N/A'}</p>
            </div>
          </div>

          {/* Annual Dividend Projections */}
          <div className="mb-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Annual Dividend Projections & Growth Rates
              </h2>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setAiPromptLoading(true);
                    const promptLines: string[] = [];
                    promptLines.push(
                      'You are a professional equity analyst. Your job is to sanity-check and, if needed, improve this Dividend Discount Model (DDM) for a single stock.'
                    );
                    if (selectedSymbol) {
                      promptLines.push(`\nStock symbol: ${selectedSymbol}`);
                    }
                    promptLines.push(
                      `\nDDM Inputs:`,
                      `- Current Price: £${inputs.currentPrice.toFixed(2)}`,
                      `- WACC / Required Return: ${inputs.wacc.toFixed(2)}%`,
                      `- Margin of Safety: ${inputs.marginOfSafety.toFixed(2)}%`,
                      `- High Growth Years: ${inputs.highGrowthYears}`,
                      `- Stable Growth Rate: ${inputs.stableGrowthRate.toFixed(2)}%`,
                      `- Intrinsic Value (before safety): £${intrinsicValue.toFixed(2)}`,
                      `- DDM with Safety: £${ddmWithSafety.toFixed(2)}`
                    );

                    promptLines.push('\nAnnual Dividend Projections (Year, Dividend £, Growth %):');

                    const currentYear = new Date().getFullYear();
                    const startYear = 2020;
                    const years: string[] = [];
                    for (let year = startYear; year <= currentYear; year++) {
                      years.push(year.toString());
                    }
                    const displayProjections: DividendProjection[] = years.map((year) => {
                      const existing = dividendProjections.find(p => p.year === year);
                      return existing ? { ...existing } : { year, dividend: 0, growthRate: 0 };
                    });

                    displayProjections.forEach(p => {
                      promptLines.push(
                        `- ${p.year}: £${p.dividend.toFixed(2)}, ${p.growthRate.toFixed(2)}%`
                      );
                    });

                    promptLines.push(
                      '\nInstructions for your analysis:',
                      '1. First, validate whether the dividend projections and growth rates look internally consistent with each other and with a typical payout policy for this kind of business. Flag any years or growth paths that look unrealistic.',
                      '2. Check whether the chosen WACC, high-growth period, stable growth rate, and margin of safety look reasonable for this stock today. If any inputs look too aggressive or too conservative, suggest revised numbers and explain why.',
                      '3. Using the inputs above, comment on whether the resulting intrinsic value and DDM-with-safety price look like a fair estimate versus the current price, or if they are clearly too high or too low. Explain your reasoning.',
                      '4. Provide a short, concrete set of revised inputs (WACC, growth rates, margin of safety and key dividends) that you would use instead if you think the current model is off, and summarise what those revisions would imply for a more realistic intrinsic value range.'
                    );

                    const fullPrompt = promptLines.join('\n');

                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      await navigator.clipboard.writeText(fullPrompt);
                      setSaveMessage('✅ AI prompt copied. Paste this into ChatGPT to validate the data.');
                      setTimeout(() => setSaveMessage(''), 4000);
                    } else {
                      setSaveMessage('❌ Could not access clipboard. Please copy the prompt manually.');
                      setTimeout(() => setSaveMessage(''), 4000);
                    }
                  } catch (error) {
                    console.error('Error creating AI prompt:', error);
                    setSaveMessage('❌ Failed to create AI prompt.');
                    setTimeout(() => setSaveMessage(''), 4000);
                  } finally {
                    setAiPromptLoading(false);
                  }
                }}
                disabled={aiPromptLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {aiPromptLoading ? 'Creating...' : 'Create AI Prompt'}
              </button>
            </div>
            {(() => {
              // Always show years from 2020 to current year
              const currentYear = new Date().getFullYear();
              const startYear = 2020;
              const years: string[] = [];
              for (let year = startYear; year <= currentYear; year++) {
                years.push(year.toString());
              }

              // Create projections array with default values, merging with existing data
              const displayProjections: DividendProjection[] = years.map((year, index) => {
                // Find existing projection for this year
                const existing = dividendProjections.find(p => p.year === year);
                
                if (existing) {
                  return { ...existing };
                } else {
                  return {
                    year,
                    dividend: 0,
                    growthRate: 0
                  };
                }
              });

              // Calculate growth rates for all projections
              displayProjections.forEach((projection, index) => {
                if (index > 0) {
                  const prevProjection = displayProjections[index - 1];
                  if (prevProjection.dividend > 0 && projection.dividend > 0) {
                    projection.growthRate = ((projection.dividend - prevProjection.dividend) / prevProjection.dividend) * 100;
                  } else {
                    projection.growthRate = 0;
                  }
                }
              });

              return (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-800 text-white">
                        <th className="border border-gray-600 px-4 py-2 text-center">Year</th>
                        <th className="border border-gray-600 px-4 py-2 text-center">Annual Dividend (£)</th>
                        <th className="border border-gray-600 px-4 py-2 text-center">Growth Rate (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayProjections.map((projection, index) => (
                        <tr key={projection.year} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold text-gray-900 dark:text-white">{projection.year}</td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="text-gray-700 dark:text-gray-300 font-medium">£</span>
                              <input
                                type="number"
                                step="0.01"
                                value={
                                  projection.dividend === 0
                                    ? ''
                                    : Number.isFinite(projection.dividend)
                                      ? projection.dividend.toFixed(2)
                                      : ''
                                }
                                onChange={(e) => {
                                  const newValue = parseFloat(e.target.value) || 0;
                                  
                                  // Create updated projections array
                                  const updated = years.map((year, idx) => {
                                    const existing = idx === index 
                                      ? { year, dividend: newValue, growthRate: 0 }
                                      : displayProjections[idx];
                                    return { ...existing };
                                  });
                                  
                                  // Recalculate growth rates
                                  updated.forEach((proj, idx) => {
                                    if (idx > 0) {
                                      const prevProj = updated[idx - 1];
                                      if (prevProj.dividend > 0 && proj.dividend > 0) {
                                        proj.growthRate = ((proj.dividend - prevProj.dividend) / prevProj.dividend) * 100;
                                      } else {
                                        proj.growthRate = 0;
                                      }
                                    } else {
                                      proj.growthRate = 0;
                                    }
                                  });
                                  
                                  setDividendProjections(updated);
                                }}
                                placeholder="0.00"
                                className="w-28 bg-white dark:bg-gray-900 border-2 border-gray-400 dark:border-gray-500 rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white font-medium"
                              />
                            </div>
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center text-gray-900 dark:text-white font-medium">
                            {projection.growthRate.toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>

          {/* Key Input Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* WACC / Required Return */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📊</span>
                WACC / Required Return
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">%:</label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.wacc}
                  onChange={(e) => handleInputChange('wacc', parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="8.5"
                />
              </div>
            </div>

            {/* Margin of Safety */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">🛡️</span>
                Margin of Safety
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">%:</label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.marginOfSafety}
                  onChange={(e) => handleInputChange('marginOfSafety', parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-orange-200 dark:border-orange-800 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="20.0"
                />
              </div>
            </div>

            {/* High Growth Years */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📈</span>
                High Growth Years
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">n:</label>
                <input
                  type="number"
                  value={inputs.highGrowthYears}
                  onChange={(e) => handleInputChange('highGrowthYears', parseInt(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="5"
                />
              </div>
            </div>

            {/* Stable Growth Rate */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">🌱</span>
                Stable Growth Rate
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">%:</label>
                <input
                  type="number"
                  step="0.1"
                  value={inputs.stableGrowthRate}
                  onChange={(e) => handleInputChange('stableGrowthRate', parseFloat(e.target.value) || 0)}
                  className="flex-1 px-3 py-2 border border-purple-200 dark:border-purple-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="3.0"
                />
              </div>
            </div>
          </div>

          {/* Save, Recalculate and Reset Buttons */}
          <div className="mb-8">
            <div className="flex justify-between gap-4">
              <button
                onClick={handleSave}
                disabled={saving || !selectedSymbol}
                className="bg-green-500 text-white rounded-md hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-sm px-6 py-2 flex items-center justify-center"
              >
                <span className="mr-2">{saving ? '⏳' : '💾'}</span>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleRecalculate}
                disabled={recalculating}
                className="bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300 disabled:bg-blue-100 disabled:text-blue-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium text-sm px-6 py-2 flex items-center justify-center"
              >
                <span className="mr-2">{recalculating ? '⏳' : '🔄'}</span>
                {recalculating ? 'Recalculating...' : 'Recalculate'}
              </button>
              <button
                onClick={handleReset}
                className="bg-red-200 text-red-800 rounded-md hover:bg-red-300 transition-colors duration-200 font-medium text-sm px-6 py-2 flex items-center justify-center"
              >
                <span className="mr-2">🗑️</span>
                Reset All Values
              </button>
            </div>
            {saveMessage && (
              <p className={`mt-3 text-center text-sm ${saveMessage.includes('✅') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {saveMessage}
              </p>
            )}
          </div>

          {/* Calculations */}
          <div className="mb-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 text-center">
              Calculations
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="border border-gray-600 px-4 py-2 text-center">Year</th>
                    <th className="border border-gray-600 px-4 py-2 text-center">DDM Price (£)</th>
                    <th className="border border-gray-600 px-4 py-2 text-center">Discount Factor</th>
                    <th className="border border-gray-600 px-4 py-2 text-center">Present Value (£)</th>
                  </tr>
                </thead>
                <tbody className="text-gray-900 dark:text-white">
                  {ddmCalculations.map((calc, index) => (
                    <tr key={calc.year} className={index % 2 === 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-semibold">{calc.year}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">{calc.ddmPrice.toFixed(2)}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">{calc.discountFactor.toFixed(10)}</td>
                      <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">{calc.presentValue.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-semibold">Terminal Value</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                      {terminalValue.toFixed(2)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                      {ddmCalculations.length === 0 ? '0.0000000000' : calculateDiscountFactor(inputs.highGrowthYears).toFixed(10)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">
                      {ddmCalculations.length === 0
                        ? '0.00'
                        : (terminalValue * calculateDiscountFactor(inputs.highGrowthYears)).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
