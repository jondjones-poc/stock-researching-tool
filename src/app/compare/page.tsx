'use client';

import { useState } from 'react';
import { useTheme } from '../contexts/ThemeContext';

interface CompareData {
  symbol: string;
  ttmPE: number | null;
  forwardPE: number | null;
  twoYearPE: number | null;
  ttmEPSGrowth: number | null;
  currentYearExpectedEPSGrowth: number | null;
  nextYearEPSGrowth: number | null;
  ttmRevenueGrowth: number | null;
  currentYearExpectedRevenueGrowth: number | null;
  nextYearRevenueGrowth: number | null;
  grossMargin: number | null;
  netMargin: number | null;
  ttmPSRatio: number | null;
  forwardPSRatio: number | null;
  error?: string;
}

export default function ComparePage() {
  const { theme } = useTheme();
  const [symbols, setSymbols] = useState(['', '', '']);
  const [data, setData] = useState<CompareData[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const handleSymbolChange = (index: number, value: string) => {
    const newSymbols = [...symbols];
    newSymbols[index] = value.toUpperCase();
    setSymbols(newSymbols);
  };

  const handleCompare = async () => {
    setLoading(true);
    setErrors([]);
    const newData: CompareData[] = [];
    const newErrors: string[] = [];

    for (let i = 0; i < symbols.length; i++) {
      const symbol = symbols[i].trim();
      if (!symbol) {
        newData.push({
          symbol: '',
          ttmPE: null,
          forwardPE: null,
          twoYearPE: null,
          ttmEPSGrowth: null,
          currentYearExpectedEPSGrowth: null,
          nextYearEPSGrowth: null,
          ttmRevenueGrowth: null,
          currentYearExpectedRevenueGrowth: null,
          nextYearRevenueGrowth: null,
          grossMargin: null,
          netMargin: null,
          ttmPSRatio: null,
          forwardPSRatio: null
        });
        continue;
      }

      try {
        const response = await fetch(`/api/compare?symbol=${symbol}`);
        const result = await response.json();
        
        if (result.error) {
          newErrors.push(`${symbol}: ${result.error}`);
          newData.push({
            symbol,
            ttmPE: null,
            forwardPE: null,
            twoYearPE: null,
            ttmEPSGrowth: null,
            currentYearExpectedEPSGrowth: null,
            nextYearEPSGrowth: null,
            ttmRevenueGrowth: null,
            currentYearExpectedRevenueGrowth: null,
            nextYearRevenueGrowth: null,
            grossMargin: null,
            netMargin: null,
            ttmPSRatio: null,
            forwardPSRatio: null,
            error: result.error
          });
        } else {
          newData.push(result);
        }
      } catch (error: any) {
        newErrors.push(`${symbol}: ${error.message || 'Failed to fetch data'}`);
        newData.push({
          symbol,
          ttmPE: null,
          forwardPE: null,
          twoYearPE: null,
          ttmEPSGrowth: null,
          currentYearExpectedEPSGrowth: null,
          nextYearEPSGrowth: null,
          ttmRevenueGrowth: null,
          currentYearExpectedRevenueGrowth: null,
          nextYearRevenueGrowth: null,
          grossMargin: null,
          netMargin: null,
          ttmPSRatio: null,
          forwardPSRatio: null,
          error: error.message || 'Failed to fetch data'
        });
      }
    }

    setData(newData);
    setErrors(newErrors);
    setLoading(false);
  };

  const formatValue = (value: number | null): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      // Format percentages (growth rates, margins)
      if (Math.abs(value) > 100 || (value > -1 && value < 1 && value !== 0)) {
        return `${value.toFixed(2)}%`;
      }
      // Format ratios (PE, P/S)
      return value.toFixed(2);
    }
    return 'N/A';
  };

  const metrics = [
    { label: 'TTM PE', key: 'ttmPE' as keyof CompareData, benchmark: 'Many Stocks Trade 20-28' },
    { label: 'Forward PE', key: 'forwardPE' as keyof CompareData, benchmark: 'Many Stocks Trade 18-26' },
    { label: '2 Year PE ', key: 'twoYearPE' as keyof CompareData, benchmark: 'Many Stocks Trade 18-24' },
    { label: 'TTM EPS Growth', key: 'ttmEPSGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 8-12%' },
    { label: 'Current Year Expected EPS Growth', key: 'currentYearExpectedEPSGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 8-12%' },
    { label: 'Next Year EPS Growth', key: 'nextYearEPSGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 8-12%' },
    { label: 'TTM Revenue Growth', key: 'ttmRevenueGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 4.5-6.5%' },
    { label: 'Current Year Expected Revenue Growth', key: 'currentYearExpectedRevenueGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 4.5-6.5%' },
    { label: 'Next Year Revenue Growth', key: 'nextYearRevenueGrowth' as keyof CompareData, benchmark: 'Many Stocks Trade 4.5-6.5%' },
    { label: 'Gross Margin', key: 'grossMargin' as keyof CompareData, benchmark: 'Many Stocks Trade 40-48%' },
    { label: 'Net Margin', key: 'netMargin' as keyof CompareData, benchmark: 'Many Stocks Trade 8-10%' },
    { label: 'TTM P/S Ratio', key: 'ttmPSRatio' as keyof CompareData, benchmark: 'Many Stocks Trade 1.8-2.6' },
    { label: 'Forward P/S Ratio', key: 'forwardPSRatio' as keyof CompareData, benchmark: 'Many Stocks Trade 1.8-2.6' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-8 text-center">
          Stock Comparison
        </h1>

        {/* Symbol Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {symbols.map((symbol, index) => (
              <div key={index}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stock {index + 1}
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => handleSymbolChange(index, e.target.value)}
                  placeholder="Enter symbol"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCompare();
                    }
                  }}
                />
              </div>
            ))}
            <div className="flex items-end">
              <button
                onClick={handleCompare}
                disabled={loading || symbols.every(s => !s.trim())}
                className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Loading...' : 'Compare'}
              </button>
            </div>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <h3 className="text-red-800 dark:text-red-400 font-semibold mb-2">Errors:</h3>
            <ul className="list-disc list-inside text-red-700 dark:text-red-300">
              {errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Comparison Table */}
        {data.length > 0 && data.some(d => d.symbol) && (
          <div className="flex gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex-1">
              {/* Header Row */}
              <div className="grid grid-cols-1 md:grid-cols-[400px_repeat(3,1fr)] gap-0 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                <div className="p-4 border-r border-gray-300 dark:border-gray-600">
                </div>
                {data.map((stock, index) => (
                  stock.symbol && (
                    <div key={index} className="p-4 border-r border-gray-300 dark:border-gray-600 last:border-r-0 text-center">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{stock.symbol}</h3>
                    </div>
                  )
                ))}
              </div>
              
              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-[400px_repeat(3,1fr)] gap-0">
                {/* Metric Column */}
                <div className="bg-gray-50 dark:bg-gray-900 p-4 border-r border-gray-300 dark:border-gray-700">
                  <div className="space-y-2">
                    {metrics.map((metric, index) => (
                      <div
                        key={index}
                        className={`bg-white dark:bg-gray-800 rounded-lg px-4 py-3 text-sm font-semibold text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 shadow-sm ${
                          metric.label === '2 Year PE ' || metric.label === 'Next Year EPS Growth' || metric.label === 'Next Year Revenue Growth' ? 'mb-8' : ''
                        }`}
                      >
                        {metric.label}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Stock Value Columns */}
                {data.map((stock, stockIndex) => (
                  stock.symbol && (
                    <div key={stockIndex} className="p-4 border-r border-gray-300 dark:border-gray-700 last:border-r-0">
                      <div className="space-y-2">
                        {metrics.map((metric, metricIndex) => (
                          <div
                            key={metricIndex}
                            className={`bg-gray-50 dark:bg-gray-900 rounded-lg px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 ${
                              metric.label === '2 Year PE ' || metric.label === 'Next Year EPS Growth' || metric.label === 'Next Year Revenue Growth' ? 'mb-8' : ''
                            }`}
                          >
                            {formatValue(stock[metric.key] as number | null)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
            
            {/* Benchmark Labels Column - Outside Table */}
            <div className="w-64">
              {/* Header spacer to match table header */}
              <div className="p-4 border-b border-transparent">
              </div>
              <div className="px-4 pt-4 pb-4 space-y-2">
                {metrics.map((metric, index) => (
                  <div
                    key={index}
                    className={`px-0 py-3 text-sm font-semibold text-white dark:text-white ${
                      metric.label === '2 Year PE ' || metric.label === 'Next Year EPS Growth' || metric.label === 'Next Year Revenue Growth' ? 'mb-8' : ''
                    }`}
                  >
                    {metric.benchmark}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {data.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              Enter up to 3 stock symbols above and click Compare to see the comparison
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
