'use client';

import { useState } from 'react';
import Decimal from 'decimal.js';

interface InsiderData {
  symbol?: string;
  finnhub?: {
    transactions: any[];
    ownership: any[];
  };
  financials?: {
    grossProfitMargin: number;
    revenue: number;
    netIncome: number;
    eps?: number;
  };
  keyMetrics?: {
    sharesOutstanding: number;
    marketCap: number;
    enterpriseValue: number;
  };
  peRatios?: {
    currentPE: number;
    forwardPE1Year: number;
    forwardPE2Year: number;
    currentPrice: number;
    eps2025: number;
    eps2026: number;
    dividendPerShare: number;
    dividendYield: number;
    dividendGrowthRate: number;
    industryAveragePE: number;
    sector: string;
  };
  fmp?: {
    sharesOutstanding: number;
    fmpPE: number;
    marketCap: number;
    price: number;
  };
  earningsGrowth?: {
    historicalGrowthRate: number;
    analystGrowthRate: number;
    epsData: Array<{date: string, eps: number}>;
    analystData: any;
  };
  error?: string;
}

export default function Home() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<InsiderData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    setLoading(true);
    setData(null);

    try {
      // Fetch data from Finnhub, Financials, PE Ratios, FMP, Earnings Growth, and Key Metrics
      const [finnhubRes, financialsRes, peRatiosRes, fmpRes, earningsGrowthRes, keyMetricsRes] = await Promise.allSettled([
        fetch(`/api/finnhub?symbol=${symbol.toUpperCase()}`),
        fetch(`/api/financials?symbol=${symbol.toUpperCase()}`),
        fetch(`/api/pe-ratios?symbol=${symbol.toUpperCase()}`),
        fetch(`/api/fmp?symbol=${symbol.toUpperCase()}`),
        fetch(`/api/earnings-growth?symbol=${symbol.toUpperCase()}`),
        fetch(`/api/key-metrics?symbol=${symbol.toUpperCase()}`)
      ]);

      const result: InsiderData = { symbol: symbol.toUpperCase() };

      // Process Finnhub data
      if (finnhubRes.status === 'fulfilled' && finnhubRes.value.ok) {
        result.finnhub = await finnhubRes.value.json();
      }

      // Process Financials data
      if (financialsRes.status === 'fulfilled' && financialsRes.value.ok) {
        result.financials = await financialsRes.value.json();
        console.log('Financials data received:', result.financials);
        console.log('Gross profit margin value:', result.financials?.grossProfitMargin);
        console.log('Is null?', result.financials?.grossProfitMargin === null);
        console.log('Type:', typeof result.financials?.grossProfitMargin);
      } else {
        console.log('Financials request failed:', financialsRes);
        if (financialsRes.status === 'fulfilled') {
          console.log('Financials response status:', financialsRes.value?.status);
          console.log('Financials response text:', await financialsRes.value?.text());
        }
      }

      // Process PE Ratios data
      if (peRatiosRes.status === 'fulfilled' && peRatiosRes.value.ok) {
        result.peRatios = await peRatiosRes.value.json();
        console.log('PE Ratios data received:', result.peRatios);
      } else {
        console.log('PE Ratios request failed:', peRatiosRes);
        if (peRatiosRes.status === 'fulfilled') {
          console.log('PE Ratios response status:', peRatiosRes.value?.status);
          console.log('PE Ratios response text:', await peRatiosRes.value?.text());
        }
      }

      // Process FMP data
      if (fmpRes.status === 'fulfilled' && fmpRes.value.ok) {
        result.fmp = await fmpRes.value.json();
        console.log('FMP data received:', result.fmp);
      } else {
        console.log('FMP request failed:', fmpRes);
        if (fmpRes.status === 'fulfilled') {
          console.log('FMP response status:', fmpRes.value?.status);
          console.log('FMP response text:', await fmpRes.value?.text());
        }
      }

      // Process Earnings Growth data
      if (earningsGrowthRes.status === 'fulfilled' && earningsGrowthRes.value.ok) {
        result.earningsGrowth = await earningsGrowthRes.value.json();
        console.log('Earnings Growth data received:', result.earningsGrowth);
        console.log('Historical growth rate:', result.earningsGrowth?.historicalGrowthRate);
        console.log('Analyst growth rate:', result.earningsGrowth?.analystGrowthRate);
      } else {
        console.log('Earnings Growth request failed:', earningsGrowthRes);
        if (earningsGrowthRes.status === 'fulfilled') {
          console.log('Earnings Growth response status:', earningsGrowthRes.value?.status);
          console.log('Earnings Growth response text:', await earningsGrowthRes.value?.text());
        }
      }

      // Process Key Metrics data
      if (keyMetricsRes.status === 'fulfilled' && keyMetricsRes.value.ok) {
        result.keyMetrics = await keyMetricsRes.value.json();
        console.log('Key Metrics data received:', result.keyMetrics);
        console.log('Shares Outstanding:', result.keyMetrics?.sharesOutstanding);
      } else {
        console.log('Key Metrics request failed:', keyMetricsRes);
        if (keyMetricsRes.status === 'fulfilled') {
          console.log('Key Metrics response status:', keyMetricsRes.value?.status);
          console.log('Key Metrics response text:', await keyMetricsRes.value?.text());
        }
      }

      setData(result);
      
      // Store data in localStorage for DCF calculation page
      storeDataForDCF(result);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setData({ error: 'Failed to fetch data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };


  // Function to store data in localStorage for DCF calculation page
  const storeDataForDCF = (data: any) => {
    if (!data) return;

    try {
      // Check if localStorage is available
      if (typeof window === 'undefined' || !window.localStorage) {
        console.warn('localStorage not available');
        return;
      }


      // Calculate Revenue Growth projections - use default values
      const revenueGrowthBear = 0.03; // 3%
      const revenueGrowthBase = 0.04; // 4%
      const revenueGrowthBull = 0.12; // 12%
      
      console.log('Revenue Growth Rates:');
      console.log('Bear:', revenueGrowthBear * 100 + '%');
      console.log('Base:', revenueGrowthBase * 100 + '%');
      console.log('Bull:', revenueGrowthBull * 100 + '%');

      // Calculate Net Income Growth projections - use historical growth rate as base
      const baseNetIncomeGrowth = data.earningsGrowth?.historicalGrowthRate || 0.2; // Default to 20%
      const netIncomeGrowthBear = new Decimal(baseNetIncomeGrowth).mul(0.75).toNumber(); // 25% below base
      const netIncomeGrowthBase = baseNetIncomeGrowth;
      const netIncomeGrowthBull = new Decimal(baseNetIncomeGrowth).mul(1.25).toNumber(); // 25% above base

      // Calculate PE estimates using current P/E ratio as base case
      const currentPE = data.peRatios?.currentPE || data.fmp?.fmpPE || 16; // Default to 16 if no PE available
      
      // PE Low: Base case is current PE, Bear is 10% below, Bull is 10% above
      const peLowBase = currentPE;
      const peLowBear = new Decimal(currentPE).mul(0.9).toNumber(); // 10% below
      const peLowBull = new Decimal(currentPE).mul(1.1).toNumber(); // 10% above
      
      // PE High: Base case is current PE, Bear is 20% below, Bull is 20% above
      const peHighBase = currentPE;
      const peHighBear = new Decimal(currentPE).mul(0.8).toNumber(); // 20% below
      const peHighBull = new Decimal(currentPE).mul(1.2).toNumber(); // 20% above

      // Prepare data for storage
      const dcfData = {
        // Growth rates
        revenueGrowth: {
          bear: revenueGrowthBear,
          base: revenueGrowthBase,
          bull: revenueGrowthBull
        },
        netIncomeGrowth: {
          bear: netIncomeGrowthBear,
          base: netIncomeGrowthBase,
          bull: netIncomeGrowthBull
        },
        // PE estimates
        peLow: {
          bear: peLowBear,
          base: peLowBase,
          bull: peLowBull
        },
        peHigh: {
          bear: peHighBear,
          base: peHighBase,
          bull: peHighBull
        },
        // Financial data
        revenue: data.financials?.revenue || 0,
        netIncome: data.financials?.netIncome || 0,
        sharesOutstanding: data.keyMetrics?.sharesOutstanding || data.fmp?.sharesOutstanding || 0,
        stockPrice: data.peRatios?.currentPrice || data.fmp?.price || 0,
        currentEps: data.financials?.eps || (data.financials?.netIncome && data.fmp?.sharesOutstanding 
          ? data.financials.netIncome / data.fmp.sharesOutstanding 
          : 0),
        // Additional context
        symbol: data.symbol || 'UNKNOWN',
        timestamp: new Date().toISOString()
      };

      // Store in localStorage with additional error handling
      localStorage.setItem('dcfData', JSON.stringify(dcfData));
      console.log('DCF data stored in localStorage:', dcfData);
    } catch (error) {
      console.error('Error storing DCF data:', error);
      // Don't throw the error, just log it to prevent the page from breaking
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-gray-900 dark:text-white">
            Company Research
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Enter a stock symbol to view insider trading data and financial analysis
          </p>
        </div>

        <div className="space-y-8">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <div className="flex gap-4">
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Enter stock symbol (e.g., CAKE, AAPL)"
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !symbol.trim()}
                className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {loading ? 'Loading...' : 'Submit'}
              </button>
            </div>
          </form>

          {data && (
            <div className="space-y-6">
              {data.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
                  {data.error}
                </div>
              )}

              {/* Financial Information - Moved to Top */}
              {(data.financials || data.fmp) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <span>💰</span> Financial Information
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {/* Gross Profit Margin */}
                    {data.financials && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gross Profit Margin</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {data.financials.grossProfitMargin ? `${(data.financials.grossProfitMargin * 100).toFixed(2)}%` : 'N/A'}
                        </p>
                      </div>
                    )}

                    {/* EPS */}
                    {data.financials && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">EPS (Earnings Per Share)</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {data.financials.eps ? `$${data.financials.eps.toFixed(2)}` : 
                           (data.financials.netIncome && data.fmp?.sharesOutstanding) ? 
                           `$${(data.financials.netIncome / data.fmp.sharesOutstanding).toFixed(2)}` : 'N/A'}
                        </p>
                      </div>
                    )}

                    {/* Shares Outstanding */}
                    {(data.keyMetrics || data.fmp) && (
                      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Shares Outstanding</p>
                          <button
                            onClick={() => {
                              const sharesOutstanding = data.keyMetrics?.sharesOutstanding || data.fmp?.sharesOutstanding;
                              if (sharesOutstanding) {
                                navigator.clipboard.writeText(sharesOutstanding.toString());
                              }
                            }}
                            className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-1 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {data.keyMetrics?.sharesOutstanding ? data.keyMetrics.sharesOutstanding.toLocaleString() : 
                           data.fmp?.sharesOutstanding ? data.fmp.sharesOutstanding.toLocaleString() : 'N/A'}
                        </p>
                        {data.fmp?.marketCap && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Market Cap: ${(data.fmp.marketCap / 1000000000).toFixed(1)}B
                          </p>
                        )}
                      </div>
                    )}

                    {/* FMP PE Ratio */}
                    {data.fmp && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">FMP P/E Ratio</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                          {data.fmp.fmpPE ? `${data.fmp.fmpPE.toFixed(2)}x` : 'N/A'}
                        </p>
                        {data.fmp.price && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Price: ${data.fmp.price.toFixed(2)}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Revenue and Net Income Section */}
                  {data.financials && (data.financials.revenue || data.financials.netIncome) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {/* Revenue */}
                      {data.financials.revenue && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                            <button
                              onClick={() => {
                                if (data.financials?.revenue) {
                                  navigator.clipboard.writeText(data.financials.revenue.toString());
                                }
                              }}
                              className="text-xs bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300 px-2 py-1 rounded hover:bg-orange-200 dark:hover:bg-orange-700 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                            ${data.financials.revenue.toLocaleString()}
                          </p>
                        </div>
                      )}

                      {/* Net Income */}
                      {data.financials.netIncome && (
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Net Income</p>
                            <button
                              onClick={() => {
                                if (data.financials?.netIncome) {
                                  navigator.clipboard.writeText(data.financials.netIncome.toString());
                                }
                              }}
                              className="text-xs bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 px-2 py-1 rounded hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            ${data.financials.netIncome.toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Stock Price and 5-Year Growth Rate - Bottom of Financial Information */}
                  {(data.peRatios || data.fmp) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Stock Price - Left Side (50% width) */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Stock Price</p>
                        <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {data.peRatios?.currentPrice ? `$${data.peRatios.currentPrice.toFixed(2)}` : 
                           data.fmp?.price ? `$${data.fmp.price.toFixed(2)}` : 'N/A'}
                        </p>
                        {data.peRatios?.currentPrice && data.fmp?.price && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {Math.abs(data.peRatios.currentPrice - data.fmp.price) < 0.01 ? 'Price consistent' : 'Price varies by source'}
                          </p>
                        )}
                      </div>

                      {/* 5-Year Growth Rate - Right Side (50% width) */}
                      {data.peRatios && data.peRatios.dividendGrowthRate && (
                        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">5-Year Growth Rate</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {data.peRatios.dividendGrowthRate.toFixed(1)}%
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Projections - New Section */}
              {data.peRatios && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <span>📊</span> Projections
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* Current PE Ratio */}
             <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
               <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current P/E Ratio</p>
               <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                 {data.peRatios.currentPE ? `${data.peRatios.currentPE.toFixed(2)}x` : 'N/A'}
               </p>
               {data.peRatios.currentPrice && (
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                   Price: ${data.peRatios.currentPrice.toFixed(2)}
                 </p>
               )}
               {data.peRatios.industryAveragePE && data.peRatios.sector && (
                 <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-700">
                   <p className="text-xs text-gray-500 dark:text-gray-400">
                     {data.peRatios.sector} Industry Avg: {data.peRatios.industryAveragePE.toFixed(1)}x
                   </p>
                   {data.peRatios.currentPE && (
                     <p className="text-xs font-medium mt-1">
                       {data.peRatios.currentPE < data.peRatios.industryAveragePE ? (
                         <span className="text-green-600 dark:text-green-400">
                           {((data.peRatios.industryAveragePE - data.peRatios.currentPE) / data.peRatios.industryAveragePE * 100).toFixed(1)}% below industry avg
                         </span>
                       ) : (
                         <span className="text-orange-600 dark:text-orange-400">
                           {((data.peRatios.currentPE - data.peRatios.industryAveragePE) / data.peRatios.industryAveragePE * 100).toFixed(1)}% above industry avg
                         </span>
                       )}
                     </p>
                   )}
                 </div>
               )}
             </div>

                    {/* 1-Year Forward PE Ratio */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">1-Year Forward P/E</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {data.peRatios.forwardPE1Year ? `${data.peRatios.forwardPE1Year.toFixed(2)}x` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {data.peRatios.eps2025 ? `EPS 2025: $${data.peRatios.eps2025.toFixed(2)}` : 'Forward estimates not available'}
                      </p>
                    </div>

                    {/* 2-Year Forward PE Ratio */}
                    <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">2-Year Forward P/E</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {data.peRatios.forwardPE2Year ? `${data.peRatios.forwardPE2Year.toFixed(2)}x` : 'N/A'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {data.peRatios.eps2026 ? `EPS 2026: $${data.peRatios.eps2026.toFixed(2)}` : 'Forward estimates not available'}
                      </p>
                    </div>
                  </div>

                  {/* Long-Term Earnings Growth Section */}
                  {data.earningsGrowth && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                      {/* Historical Growth Rate */}
                      {data.earningsGrowth.historicalGrowthRate && (
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Projected Long-Term Earnings Growth</p>
                            <button
                              onClick={() => {
                                if (data.earningsGrowth?.historicalGrowthRate) {
                                  navigator.clipboard.writeText((data.earningsGrowth.historicalGrowthRate * 100).toFixed(2) + '%');
                                }
                              }}
                              className="text-xs bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors"
                            >
                              Copy
                            </button>
                          </div>
                          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {(data.earningsGrowth.historicalGrowthRate * 100).toFixed(2)}%
                          </p>
                          {data.earningsGrowth.epsData && data.earningsGrowth.epsData.length > 0 && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Based on {data.earningsGrowth.epsData.length} years of data
                            </p>
                          )}
                        </div>
                      )}

                      {/* Analyst Growth Rate */}
                      <div className="bg-teal-50 dark:bg-teal-900/20 p-4 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Analyst Growth Estimate</p>
                          {data.earningsGrowth.analystGrowthRate && (
                            <button
                              onClick={() => {
                                if (data.earningsGrowth?.analystGrowthRate) {
                                  navigator.clipboard.writeText((data.earningsGrowth.analystGrowthRate * 100).toFixed(2) + '%');
                                }
                              }}
                              className="text-xs bg-teal-100 dark:bg-teal-800 text-teal-700 dark:text-teal-300 px-2 py-1 rounded hover:bg-teal-200 dark:hover:bg-teal-700 transition-colors"
                            >
                              Copy
                            </button>
                          )}
                        </div>
                        {data.earningsGrowth.analystGrowthRate ? (
                          <>
                            <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">
                              {(data.earningsGrowth.analystGrowthRate * 100).toFixed(2)}%
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Analyst consensus
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-gray-400 dark:text-gray-500">
                              N/A
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Analyst estimates not available
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Dividend Information - New Section */}
              {data.peRatios && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <span>💰</span> Dividend Information
                  </h2>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {/* Dividend Per Share */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Dividend Per Share</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {data.peRatios.dividendPerShare ? `$${data.peRatios.dividendPerShare.toFixed(2)}` : 'Does Not Pay Dividend'}
                      </p>
                      {data.peRatios.dividendYield && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Yield: {data.peRatios.dividendYield.toFixed(2)}%
                        </p>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {data.finnhub && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                  <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
                    <span>📈</span> Insider Analysis
                  </h2>
                  
                  {/* Founder Ownership Check */}
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-gray-200">
                      Founder Ownership
                    </h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {data.finnhub.ownership && data.finnhub.ownership.length > 0 
                        ? data.finnhub.ownership.some((owner: any) => 
                            owner.name && (
                              owner.name.toLowerCase().includes('founder') ||
                              owner.name.toLowerCase().includes('ceo') ||
                              owner.name.toLowerCase().includes('chairman') ||
                              owner.percentHeld > 10
                            )
                          ) ? 'TRUE' : 'FALSE'
                        : 'FALSE'
                      }
                    </p>
                  </div>

                  {/* Transaction Summary */}
                  {data.finnhub.transactions && data.finnhub.transactions.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                        Transaction Summary
                      </h3>
                      
                      {(() => {
                        const transactions = data.finnhub.transactions;
                        const totalBought = transactions
                          .filter((t: any) => t.transactionCode === 'P')
                          .reduce((sum: number, t: any) => sum + (t.share || 0), 0);
                        const totalSold = transactions
                          .filter((t: any) => t.transactionCode === 'S')
                          .reduce((sum: number, t: any) => sum + (t.share || 0), 0);
                        
                        const totalTransactions = totalBought + totalSold;
                        const buyRatio = totalTransactions > 0 ? totalBought / totalTransactions : 0;
                        const sellRatio = totalTransactions > 0 ? totalSold / totalTransactions : 0;
                        
                        let insiderTrend = 'MIXED';
                        if (buyRatio >= 0.6) insiderTrend = 'BUYING';
                        else if (sellRatio >= 0.6) insiderTrend = 'SELLING';
                        
                        return (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Stock Bought</p>
                                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                                  {totalBought.toLocaleString()} shares
                                </p>
                              </div>
                              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Stock Sold</p>
                                <p className="text-xl font-bold text-red-600 dark:text-red-400">
                                  {totalSold.toLocaleString()} shares
                                </p>
                              </div>
                            </div>
                            
                            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Insider Trend</p>
                              <p className={`text-xl font-bold ${
                                insiderTrend === 'BUYING' ? 'text-green-600 dark:text-green-400' :
                                insiderTrend === 'SELLING' ? 'text-red-600 dark:text-red-400' :
                                'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {insiderTrend}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Based on 60% threshold (Buy: {Math.round(buyRatio * 100)}%, Sell: {Math.round(sellRatio * 100)}%)
                              </p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Top Shareholders */}
                  {data.finnhub.ownership && data.finnhub.ownership.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                        Top Shareholders
                      </h3>
                      <div className="space-y-2">
                        {data.finnhub.ownership.slice(0, 5).map((owner: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                            <span className="font-medium">{owner.name}</span>
                            <span className="text-gray-600 dark:text-gray-400">
                              {owner.share?.toLocaleString()} shares ({owner.percentHeld?.toFixed(2)}%)
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}

        </div>
      </main>
    </div>
  );
}