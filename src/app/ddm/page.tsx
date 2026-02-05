'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function DDMPage() {
  const router = useRouter();
  
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
  const [symbol, setSymbol] = useState<string>('');

  // Function to load data from localStorage
  const loadDataFromStorage = () => {
    try {
      const dcfData = localStorage.getItem('dcfData');
      if (dcfData) {
        const parsedData = JSON.parse(dcfData);
        
        // Load symbol
        if (parsedData.symbol) {
          setSymbol(parsedData.symbol);
        }
        
        // Load current price
        if (parsedData.stockPrice && parsedData.stockPrice > 0) {
          setInputs(prev => ({
            ...prev,
            currentPrice: parsedData.stockPrice
          }));
          setShowCurrentPrice(true);
        }
        
        // Load saved DDM input parameters if they exist
        if (parsedData.ddmInputs) {
          setInputs(prev => ({
            ...prev,
            wacc: parsedData.ddmInputs.wacc || prev.wacc,
            marginOfSafety: parsedData.ddmInputs.marginOfSafety || prev.marginOfSafety,
            highGrowthYears: parsedData.ddmInputs.highGrowthYears || prev.highGrowthYears,
            stableGrowthRate: parsedData.ddmInputs.stableGrowthRate || prev.stableGrowthRate
          }));
        }
        
          // Load dividend history - ONLY use pre-aggregated dividendsByYear from API
          if (parsedData.dividendHistory && parsedData.dividendHistory.dividendsByYear) {
            const dividendsByYear = parsedData.dividendHistory.dividendsByYear;
            const currentYear = new Date().getFullYear();
            
            console.log('DDM Loading - Dividends by year:', dividendsByYear);
            console.log('DDM Loading - Current year:', currentYear);
            console.log('DDM Loading - Projected?:', parsedData.dividendHistory.currentYearProjected);
            
            // Get years from 2020 to current year only
            const startYear = 2020;
            const sortedYears = Object.keys(dividendsByYear)
              .sort((a, b) => parseInt(a) - parseInt(b))
              .filter(year => parseInt(year) >= startYear && parseInt(year) <= currentYear);
            
            // Transform into DividendProjection format with calculated growth rates
            const projections: DividendProjection[] = sortedYears.map((year, index) => {
              const dividend = dividendsByYear[year];
              
              // Calculate growth rate compared to previous year
              let growthRate = 0;
              if (index > 0) {
                const previousYear = sortedYears[index - 1];
                const previousDividend = dividendsByYear[previousYear];
                if (previousDividend > 0) {
                  growthRate = ((dividend - previousDividend) / previousDividend) * 100;
                }
              }
              
              return {
                year,
                dividend,
                growthRate
              };
            });
            
            setDividendProjections(projections);
          }
      }
    } catch (error) {
      console.log('Error loading data from localStorage:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    loadDataFromStorage();
  }, []);

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
      // Use latest growth rate for ALL high growth years (stable rate only applies to terminal value)
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
    
    // Get the LAST projected DDM dividend (e.g., 2030 if projecting 5 years)
    const lastProjectedDividend = ddmCalculations[ddmCalculations.length - 1].ddmPrice;
    
    // Terminal value = Last projected dividend * (1 + stable growth rate) / (WACC - stable growth rate)
    const terminalDividend = lastProjectedDividend * (1 + inputs.stableGrowthRate / 100);
    
    // Avoid division by zero or negative values
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
    
    // Calculate intrinsic value (sum of present values + terminal value PV)
    const totalPV = calculations.reduce((sum, calc) => sum + calc.presentValue, 0);
    const intrinsicVal = totalPV + terminalPV;
    setIntrinsicValue(intrinsicVal);
    
    // Calculate DDM with safety
    const ddmSafety = intrinsicVal * (1 - inputs.marginOfSafety / 100);
    setDdmWithSafety(ddmSafety);
    
    // Determine verdict based on spreadsheet logic: =IF(A2<=C2,"BUY",IF(A2<=C2,"HOLD","WAIT"))
    // But the second condition should be A2<=B2 (Intrinsic Value) for HOLD
    let verdictText = 'WAIT';
    if (inputs.currentPrice <= ddmSafety) {
      verdictText = 'BUY';
    } else if (inputs.currentPrice <= intrinsicVal) {
      verdictText = 'HOLD';
    }
    setVerdict(verdictText);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs, dividendProjections]);

  const handleInputChange = (field: keyof DDMInputs, value: number) => {
    const updatedInputs = {
      ...inputs,
      [field]: value
    };
    setInputs(updatedInputs);
    
    // Save DDM inputs to localStorage (excluding currentPrice which comes from stock data)
    try {
      const dcfData = localStorage.getItem('dcfData');
      if (dcfData) {
        const parsedData = JSON.parse(dcfData);
        parsedData.ddmInputs = {
          wacc: updatedInputs.wacc,
          marginOfSafety: updatedInputs.marginOfSafety,
          highGrowthYears: updatedInputs.highGrowthYears,
          stableGrowthRate: updatedInputs.stableGrowthRate
        };
        localStorage.setItem('dcfData', JSON.stringify(parsedData));
      }
    } catch (error) {
      console.log('Error saving DDM inputs to localStorage:', error);
    }
  };

  const handleDividendChange = (index: number, field: keyof DividendProjection, value: number) => {
    setDividendProjections(prev => 
      prev.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleReset = () => {
    // Clear localStorage
    localStorage.clear();
    
    // Reset all inputs to defaults
    setInputs({
      currentPrice: 0,
      wacc: 8.5,
      marginOfSafety: 20.0,
      highGrowthYears: 5,
      stableGrowthRate: 3.0
    });
    
    // Clear dividend projections
    setDividendProjections([]);
    
    // Hide current price display
    setShowCurrentPrice(false);
    
    // Redirect to company information page
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
            Dividend Discount Model (DDM) Calculator
          </h1>

          {/* Summary/Verdict Section */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            {symbol && (
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Symbol</h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{symbol}</p>
              </div>
            )}
            {showCurrentPrice && (
              <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Current Price</h3>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">£</span>
                  <input
                    type="number"
                    step="0.01"
                    value={inputs.currentPrice}
                    onChange={(e) => handleInputChange('currentPrice', parseFloat(e.target.value) || 0)}
                    className="text-2xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none w-24"
                  />
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Intrinsic Value</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">£{intrinsicValue.toFixed(2)}</p>
            </div>

            <div className="bg-white dark:bg-gray-700 p-4 rounded-lg border">
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">DDM with Safety</h3>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">£{ddmWithSafety.toFixed(2)}</p>
            </div>

            <div className={`p-4 rounded-lg ${
              verdict === 'BUY' 
                ? 'bg-green-100 dark:bg-green-900/20' 
                : verdict === 'HOLD' 
                ? 'bg-yellow-100 dark:bg-yellow-900/20' 
                : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Verdict</h3>
              <p className={`text-2xl font-bold ${
                verdict === 'BUY' 
                  ? 'text-green-600 dark:text-green-400' 
                  : verdict === 'HOLD' 
                  ? 'text-yellow-600 dark:text-yellow-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>{verdict}</p>
            </div>
          </div>

          {/* Annual Dividend Projections */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Annual Dividend Projections & Growth Rates</h2>
            {dividendProjections.length === 0 ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 text-center">
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  No dividend data loaded. Please search for a dividend-paying stock on the Company Research page first.
                </p>
                <Link
                  href="/research"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Go to Company Research →
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-800 text-white">
                      <th className="border border-gray-600 px-4 py-2 text-left">Year</th>
                      <th className="border border-gray-600 px-4 py-2 text-left">Annual Dividend ($)</th>
                      <th className="border border-gray-600 px-4 py-2 text-left">Growth Rate (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividendProjections.map((projection, index) => (
                      <tr key={projection.year} className="bg-yellow-50 dark:bg-yellow-900/20">
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 font-semibold">{projection.year}</td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-600 dark:text-gray-400">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={projection.dividend.toFixed(2)}
                              onChange={(e) => handleDividendChange(index, 'dividend', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-transparent border-none outline-none text-center"
                            />
                          </div>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">
                          {projection.growthRate.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

          {/* Reset and Recalculate Buttons */}
          <div className="mb-8">
            <div className="flex justify-center gap-4">
              <button
                onClick={loadDataFromStorage}
                className="bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300 transition-colors duration-200 font-medium text-sm px-6 py-2 flex items-center justify-center"
              >
                <span className="mr-2">🔄</span>
                Recalculate
              </button>
              <button
                onClick={handleReset}
                className="bg-red-200 text-red-800 rounded-md hover:bg-red-300 transition-colors duration-200 font-medium text-sm px-6 py-2 flex items-center justify-center"
              >
                <span className="mr-2">🗑️</span>
                Reset All Values
              </button>
            </div>
          </div>

          {/* Detailed DDM Calculation */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Detailed DDM Calculation</h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="border border-gray-600 px-4 py-2 text-left">Year</th>
                    <th className="border border-gray-600 px-4 py-2 text-left">DDM Price (£)</th>
                    <th className="border border-gray-600 px-4 py-2 text-left">Discount Factor</th>
                    <th className="border border-gray-600 px-4 py-2 text-left">Present Value (£)</th>
                  </tr>
                </thead>
                <tbody>
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
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">{terminalValue.toFixed(2)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center">{calculateDiscountFactor(inputs.highGrowthYears).toFixed(10)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-center font-semibold">{(terminalValue * calculateDiscountFactor(inputs.highGrowthYears)).toFixed(2)}</td>
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
