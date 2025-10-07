'use client';

import { useEffect, useState } from 'react';
import { getDCFData, DCFData, hasDCFData, storeDCFData } from '../utils/dcfData';
import Decimal from 'decimal.js';
import Link from 'next/link';

interface DCFProjections {
  revenue: { bear: number[]; base: number[]; bull: number[] };
  netIncome: { bear: number[]; base: number[]; bull: number[] };
  eps: { bear: number[]; base: number[]; bull: number[] };
  sharePriceLow: { bear: number[]; base: number[]; bull: number[] };
  sharePriceHigh: { bear: number[]; base: number[]; bull: number[] };
  cagrLow: { bear: number; base: number; bull: number };
  cagrHigh: { bear: number; base: number; bull: number };
}

export default function DCFCalculator() {
  const [dcfData, setDcfData] = useState<DCFData | null>(null);
  const [projections, setProjections] = useState<DCFProjections | null>(null);
  const [formData, setFormData] = useState({
    revenueGrowth: { bear: 0, base: 0, bull: 0 },
    netIncomeGrowth: { bear: 0, base: 0, bull: 0 },
    peLow: { bear: 0, base: 0, bull: 0 },
    peHigh: { bear: 0, base: 0, bull: 0 },
    stockPrice: 0
  });

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug projections state changes
  useEffect(() => {
    console.log('Projections state changed:', projections);
  }, [projections]);

  // Debug dcfData state changes
  useEffect(() => {
    console.log('DCF data state changed:', dcfData);
  }, [dcfData]);

  const loadData = () => {
    try {
      console.log('loadData called');
      if (hasDCFData()) {
        const data = getDCFData();
        console.log('DCF data loaded:', data);
        if (data && data.revenueGrowth && data.netIncomeGrowth && data.peLow && data.peHigh) {
          console.log('Data validation passed, setting dcfData and formData');
          setDcfData(data);
          setFormData({
            revenueGrowth: {
              bear: (data.revenueGrowth.bear || 0) * 100,
              base: (data.revenueGrowth.base || 0) * 100,
              bull: (data.revenueGrowth.bull || 0) * 100
            },
            netIncomeGrowth: {
              bear: (data.netIncomeGrowth.bear || 0) * 100,
              base: (data.netIncomeGrowth.base || 0) * 100,
              bull: (data.netIncomeGrowth.bull || 0) * 100
            },
            peLow: {
              bear: Math.round(data.peLow.bear || 0),
              base: Math.round(data.peLow.base || 0),
              bull: Math.round(data.peLow.bull || 0)
            },
            peHigh: {
              bear: Math.round(data.peHigh.bear || 0),
              base: Math.round(data.peHigh.base || 0),
              bull: Math.round(data.peHigh.bull || 0)
            },
            stockPrice: data.stockPrice || 0
          });
          console.log('Calling calculateProjections with data:', data);
          calculateProjections(data);
        } else {
          // Data is corrupted or incomplete
          setDcfData(null);
          setProjections(null);
        }
      } else {
        // No data available
        setDcfData(null);
        setProjections(null);
      }
    } catch (error) {
      console.error('Error loading DCF data:', error);
      setDcfData(null);
      setProjections(null);
    }
  };

  const calculateProjections = (data: DCFData) => {
    try {
      console.log('calculateProjections called with data:', data);
      if (!data || !data.revenueGrowth || !data.netIncomeGrowth || !data.peLow || !data.peHigh) {
        console.warn('Invalid data for projections calculation', {
          hasData: !!data,
          hasRevenueGrowth: !!data?.revenueGrowth,
          hasNetIncomeGrowth: !!data?.netIncomeGrowth,
          hasPeLow: !!data?.peLow,
          hasPeHigh: !!data?.peHigh
        });
        setProjections(null);
        return;
      }

      const years = 5;
      const revenueProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const netIncomeProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const epsProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const sharePriceLowProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };
      const sharePriceHighProjections: { bear: number[]; base: number[]; bull: number[] } = { bear: [], base: [], bull: [] };

    // Calculate for each scenario
    const scenarios: ('bear' | 'base' | 'bull')[] = ['bear', 'base', 'bull'];
    
    scenarios.forEach(scenario => {
      let currentRevenue = new Decimal(data.revenue);
      let currentNetIncome = new Decimal(data.netIncome);
      
      const revenueGrowth = data.revenueGrowth[scenario];
      const netIncomeGrowth = data.netIncomeGrowth[scenario];
      const peLow = data.peLow[scenario];
      const peHigh = data.peHigh[scenario];

      for (let year = 0; year < years; year++) {
        if (year > 0) {
          currentRevenue = currentRevenue.mul(new Decimal(1).add(revenueGrowth));
          currentNetIncome = currentNetIncome.mul(new Decimal(1).add(netIncomeGrowth));
        }
        
        // Handle zero or missing shares outstanding - use a reasonable default
        const sharesOutstanding = data.sharesOutstanding && data.sharesOutstanding > 0 
          ? data.sharesOutstanding 
          : 50000000; // Default to 50M shares if not available
        
        // Use input EPS for year 0, calculate for other years
        let eps;
        if (year === 0 && data.currentEps && data.currentEps > 0) {
          eps = new Decimal(data.currentEps);
        } else {
          eps = currentNetIncome.div(sharesOutstanding);
        }
        
        const sharePriceLow = eps.mul(peLow);
        const sharePriceHigh = eps.mul(peHigh);

        revenueProjections[scenario].push(currentRevenue.toNumber());
        netIncomeProjections[scenario].push(currentNetIncome.toNumber());
        epsProjections[scenario].push(eps.toNumber());
        sharePriceLowProjections[scenario].push(sharePriceLow.toNumber());
        sharePriceHighProjections[scenario].push(sharePriceHigh.toNumber());
      }
    });

    // Calculate CAGR
    const cagrLow = {
      bear: Math.pow(sharePriceLowProjections.bear[years - 1] / data.stockPrice, 1 / years) - 1,
      base: Math.pow(sharePriceLowProjections.base[years - 1] / data.stockPrice, 1 / years) - 1,
      bull: Math.pow(sharePriceLowProjections.bull[years - 1] / data.stockPrice, 1 / years) - 1
    };

    const cagrHigh = {
      bear: Math.pow(sharePriceHighProjections.bear[years - 1] / data.stockPrice, 1 / years) - 1,
      base: Math.pow(sharePriceHighProjections.base[years - 1] / data.stockPrice, 1 / years) - 1,
      bull: Math.pow(sharePriceHighProjections.bull[years - 1] / data.stockPrice, 1 / years) - 1
    };

      const projectionsData = {
        revenue: revenueProjections,
        netIncome: netIncomeProjections,
        eps: epsProjections,
        sharePriceLow: sharePriceLowProjections,
        sharePriceHigh: sharePriceHighProjections,
        cagrLow,
        cagrHigh
      };
      
      console.log('Setting projections:', projectionsData);
      console.log('Projections data structure check:', {
        hasRevenue: !!projectionsData.revenue,
        hasNetIncome: !!projectionsData.netIncome,
        hasEps: !!projectionsData.eps,
        hasSharePriceLow: !!projectionsData.sharePriceLow,
        hasSharePriceHigh: !!projectionsData.sharePriceHigh,
        revenueLength: projectionsData.revenue?.bear?.length,
        netIncomeLength: projectionsData.netIncome?.bear?.length,
        epsLength: projectionsData.eps?.bear?.length
      });
      setProjections(projectionsData);
    } catch (error) {
      console.error('Error calculating projections:', error);
      setProjections(null);
    }
  };

  const handleInputChange = (field: keyof typeof formData, scenario: 'bear' | 'base' | 'bull', value: string) => {
    const numValue = parseFloat(value) || 0;
    setFormData(prev => ({
      ...prev,
      [field]: {
        ...(prev[field] as { bear: number; base: number; bull: number }),
        [scenario]: numValue
      }
    }));
  };

  const handleRefresh = () => {
    try {
      if (dcfData) {
        console.log('Before refresh - dcfData:', dcfData);
        console.log('Before refresh - formData:', formData);
        
        const updatedData: DCFData = {
          ...dcfData,
          revenueGrowth: {
            bear: formData.revenueGrowth.bear / 100,
            base: formData.revenueGrowth.base / 100,
            bull: formData.revenueGrowth.bull / 100
          },
          netIncomeGrowth: {
            bear: formData.netIncomeGrowth.bear / 100,
            base: formData.netIncomeGrowth.base / 100,
            bull: formData.netIncomeGrowth.bull / 100
          },
          peLow: {
            bear: Math.round(formData.peLow.bear),
            base: Math.round(formData.peLow.base),
            bull: Math.round(formData.peLow.bull)
          },
          peHigh: {
            bear: Math.round(formData.peHigh.bear),
            base: Math.round(formData.peHigh.base),
            bull: Math.round(formData.peHigh.bull)
          },
          stockPrice: formData.stockPrice,
          revenue: dcfData.revenue, // Keep the updated revenue value
          netIncome: dcfData.netIncome, // Keep the updated net income value
          sharesOutstanding: dcfData.sharesOutstanding || 50000000,
          currentEps: dcfData.currentEps || 0 // Keep the updated EPS value
        };
        
        console.log('Saving updated data:', updatedData);
        console.log('EPS value being saved:', updatedData.currentEps);
        
        // Store updated data in localStorage
        storeDCFData(updatedData);
        
        // Reload the page to refresh all data
        window.location.reload();
      } else {
        console.warn('No DCF data available for refresh');
      }
    } catch (error) {
      console.error('Error during refresh:', error);
    }
  };

  const formatCurrency = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };



  if (!dcfData) {
    return (
      <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-8 rounded-xl border border-yellow-200 dark:border-yellow-800">
              <h2 className="text-2xl font-bold text-yellow-800 dark:text-yellow-200 mb-4">
                No DCF Data Available
              </h2>
              <p className="text-yellow-700 dark:text-yellow-300 mb-6 text-lg">
                Please search for a stock symbol on the Company Research page first to populate the DCF data.
                <br />
                <span className="text-sm">If you just cleared the data, you&apos;ll need to reload the Company Research page to get fresh data.</span>
              </p>
              <Link
                href="/"
                className="inline-block px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                Go to Company Research
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">

        {/* Input Forms */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
          {/* Top Row - Revenue Growth, Net Income Growth, PE Low, PE High (1/4 each) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Revenue Growth */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📈</span>
                Revenue Growth (%)
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">B:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.bear}
                    onChange={(e) => handleInputChange('revenueGrowth', 'bear', e.target.value)}
                    className="flex-1 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">M:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.base}
                    onChange={(e) => handleInputChange('revenueGrowth', 'base', e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">T:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.revenueGrowth.bull}
                    onChange={(e) => handleInputChange('revenueGrowth', 'bull', e.target.value)}
                    className="flex-1 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Net Income Growth */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">💰</span>
                Net Income Growth (%)
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">B:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.bear}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'bear', e.target.value)}
                    className="flex-1 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">M:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.base}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'base', e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">T:</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.netIncomeGrowth.bull}
                    onChange={(e) => handleInputChange('netIncomeGrowth', 'bull', e.target.value)}
                    className="flex-1 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* PE Low */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📉</span>
                PE Low
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">B:</label>
                  <input
                    type="number"
                    value={formData.peLow.bear}
                    onChange={(e) => handleInputChange('peLow', 'bear', e.target.value)}
                    className="flex-1 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">M:</label>
                  <input
                    type="number"
                    value={formData.peLow.base}
                    onChange={(e) => handleInputChange('peLow', 'base', e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">T:</label>
                  <input
                    type="number"
                    value={formData.peLow.bull}
                    onChange={(e) => handleInputChange('peLow', 'bull', e.target.value)}
                    className="flex-1 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* PE High */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📈</span>
                PE High
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-red-600 bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">B:</label>
                  <input
                    type="number"
                    value={formData.peHigh.bear}
                    onChange={(e) => handleInputChange('peHigh', 'bear', e.target.value)}
                    className="flex-1 px-2 py-1 border border-red-200 dark:border-red-800 rounded focus:outline-none focus:ring-1 focus:ring-red-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-1 py-0.5 rounded">M:</label>
                  <input
                    type="number"
                    value={formData.peHigh.base}
                    onChange={(e) => handleInputChange('peHigh', 'base', e.target.value)}
                    className="flex-1 px-2 py-1 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label className="w-8 text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/30 px-1 py-0.5 rounded">T:</label>
                  <input
                    type="number"
                    value={formData.peHigh.bull}
                    onChange={(e) => handleInputChange('peHigh', 'bull', e.target.value)}
                    className="flex-1 px-2 py-1 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-xs"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Revenue, Net Income, Stock Price, and Shares Outstanding Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Revenue */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📊</span>
                Revenue
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? dcfData.revenue : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, revenue: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-blue-200 dark:border-blue-800 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Net Income */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">💰</span>
                Net Income
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? dcfData.netIncome : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, netIncome: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-green-200 dark:border-green-800 rounded focus:outline-none focus:ring-1 focus:ring-green-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Stock Price */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">💲</span>
                Stock Price
              </h3>
              <div className="flex items-center gap-1">
                <label className="w-10 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-1 py-1 rounded">$:</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.stockPrice}
                  onChange={(e) => setFormData(prev => ({ ...prev, stockPrice: parseFloat(e.target.value) || 0 }))}
                  className="flex-1 px-2 py-1 border border-indigo-200 dark:border-indigo-800 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white text-xs"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Shares Outstanding */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📈</span>
                Shares Outstanding
              </h3>
              <div className="flex items-center gap-1">
                <label className="w-10 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-1 py-1 rounded">#:</label>
                <input
                  type="number"
                  step="1"
                  value={dcfData ? (dcfData.sharesOutstanding || 50000000) : 50000000}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, sharesOutstanding: parseFloat(e.target.value) || 50000000 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 px-2 py-1 border border-purple-200 dark:border-purple-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-800 dark:text-white text-xs"
                  placeholder="50000000"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dcfData && dcfData.sharesOutstanding === 0 ? '⚠️ Not loaded from Company Research' : '✓ Loaded from Company Research'}
              </div>
            </div>
          </div>

          {/* Buttons Row with EPS Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex justify-center items-center h-full">
              <button
                onClick={handleRefresh}
                className="w-4/5 h-2/5 bg-blue-200 text-blue-800 rounded-md hover:bg-blue-300 transition-colors duration-200 font-medium text-sm flex items-center justify-center"
              >
                <span className="mr-1">🔄</span>
                Refresh
              </button>
            </div>

            {/* EPS Input */}
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
              <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-3 text-sm flex items-center">
                <span className="mr-1">📊</span>
                Current EPS
              </h3>
              <div className="flex items-center gap-2">
                <label className="w-12 text-xs font-semibold text-gray-600 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">EPS:</label>
                <input
                  type="number"
                  step="0.01"
                  value={dcfData ? (dcfData.currentEps || 0) : 0}
                  onChange={(e) => {
                    if (dcfData) {
                      const updatedData = { ...dcfData, currentEps: parseFloat(e.target.value) || 0 };
                      setDcfData(updatedData);
                      storeDCFData(updatedData);
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-purple-200 dark:border-purple-800 rounded focus:outline-none focus:ring-1 focus:ring-purple-500 dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {dcfData && dcfData.currentEps === 0 ? '⚠️ Not loaded from Company Research' : '✓ Loaded from Company Research'}
              </div>
            </div>

            <div className="flex justify-center items-center h-full">
              <button
                onClick={() => {
                  localStorage.removeItem('dcfData');
                  window.location.reload();
                }}
                className="w-4/5 h-2/5 bg-pink-200 text-pink-800 rounded-md hover:bg-pink-300 transition-colors duration-200 font-medium text-sm flex items-center justify-center"
              >
                <span className="mr-1">🗑️</span>
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Share Price Summary */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-6 text-center">Share Price Summary</h2>
            
            {/* Current Price Row */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20 rounded-lg p-6 mb-4 border border-gray-200 dark:border-gray-700">
              <h3 className="font-bold text-gray-600 mb-4 text-lg">Current Market Price</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Current Price</div>
                  <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {formatCurrency(dcfData?.stockPrice || 0)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Investment Signal</div>
                  <div className={`text-2xl font-bold ${dcfData && dcfData.stockPrice < ((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2) ? 'text-green-600' : 'text-red-600'}`}>
                    {dcfData && dcfData.stockPrice < ((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2) ? 'BUY' : 'HOLD'}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Bear Case Row */}
            <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-lg p-6 mb-4 border border-red-200 dark:border-red-800">
              <h3 className="font-bold text-red-600 mb-4 text-lg">Bear Case</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency((projections.sharePriceLow.bear[4] + projections.sharePriceHigh.bear[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(projections.sharePriceLow.bear[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-red-600">
                    {formatCurrency(projections.sharePriceHigh.bear[4])}
                  </div>
                </div>
              </div>
            </div>

            {/* Base Case Row */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 mb-4 border border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-600 mb-4 text-lg">Base Case</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency((projections.sharePriceLow.base[4] + projections.sharePriceHigh.base[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(projections.sharePriceLow.base[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-blue-600">
                    {formatCurrency(projections.sharePriceHigh.base[4])}
                  </div>
                </div>
              </div>
            </div>

            {/* Bull Case Row */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 mb-4 border border-green-200 dark:border-green-800">
              <h3 className="font-bold text-green-600 mb-4 text-lg">Bull Case</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Average Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency((projections.sharePriceLow.bull[4] + projections.sharePriceHigh.bull[4]) / 2)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Low Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(projections.sharePriceLow.bull[4])}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">High Price</div>
                  <div className="text-xl font-bold text-green-600">
                    {formatCurrency(projections.sharePriceHigh.bull[4])}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CAGR Summary */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-lg flex items-center">
                  <span className="mr-2">📉</span>
                  CAGR Low
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-red-600 font-semibold">Bear:</span>
                    <span className="font-mono text-lg font-bold text-red-600">{formatPercentage(projections.cagrLow.bear)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-600 font-semibold">Base:</span>
                    <span className="font-mono text-lg font-bold text-blue-600">{formatPercentage(projections.cagrLow.base)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-green-600 font-semibold">Bull:</span>
                    <span className="font-mono text-lg font-bold text-green-600">{formatPercentage(projections.cagrLow.bull)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-6 border border-green-200 dark:border-green-800">
                <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-6 text-lg flex items-center">
                  <span className="mr-2">📈</span>
                  CAGR High
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800">
                    <span className="text-red-600 font-semibold">Bear:</span>
                    <span className="font-mono text-lg font-bold text-red-600">{formatPercentage(projections.cagrHigh.bear)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <span className="text-blue-600 font-semibold">Base:</span>
                    <span className="font-mono text-lg font-bold text-blue-600">{formatPercentage(projections.cagrHigh.base)}</span>
                  </div>
                  <div className="flex justify-between items-center bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <span className="text-green-600 font-semibold">Bull:</span>
                    <span className="font-mono text-lg font-bold text-green-600">{formatPercentage(projections.cagrHigh.bull)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Projections Table */}
        {dcfData && projections && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-8 mb-8 border border-gray-200 dark:border-gray-700 transform transition-all duration-300 hover:shadow-2xl">
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-300 dark:border-gray-600">
                    <th className="text-left py-4 px-6 font-bold text-lg">Metric</th>
                    <th className="text-center py-4 px-6 font-bold text-lg text-red-600 bg-red-50 dark:bg-red-900/20">Bear Case</th>
                    <th className="text-center py-4 px-6 font-bold text-lg text-blue-600 bg-blue-50 dark:bg-blue-900/20">Base Case</th>
                    <th className="text-center py-4 px-6 font-bold text-lg text-green-600 bg-green-50 dark:bg-green-900/20">Bull Case</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Revenue Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg">Revenue</td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.bear.map((value, index) => (
                        <div key={index} className="text-red-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.base.map((value, index) => (
                        <div key={index} className="text-blue-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.revenue.bull.map((value, index) => (
                        <div key={index} className="text-green-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Net Income Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg">Net Income</td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.bear.map((value, index) => (
                        <div key={index} className="text-red-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.base.map((value, index) => (
                        <div key={index} className="text-blue-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.netIncome.bull.map((value, index) => (
                        <div key={index} className="text-green-600 font-mono text-sm mb-1">
                          {formatCurrency(value)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* EPS Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg">EPS</td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.bear.map((value, index) => (
                        <div key={index} className="text-red-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.base.map((value, index) => (
                        <div key={index} className="text-blue-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.eps.bull.map((value, index) => (
                        <div key={index} className="text-green-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Share Price Low Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg">Share Price Low</td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.bear.map((value, index) => (
                        <div key={index} className="text-red-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.base.map((value, index) => (
                        <div key={index} className="text-blue-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceLow.bull.map((value, index) => (
                        <div key={index} className="text-green-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>

                  {/* Share Price High Projections */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="py-4 px-6 font-semibold text-lg">Share Price High</td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.bear.map((value, index) => (
                        <div key={index} className="text-red-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.base.map((value, index) => (
                        <div key={index} className="text-blue-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                    <td className="py-4 px-6 text-center">
                      {projections.sharePriceHigh.bull.map((value, index) => (
                        <div key={index} className="text-green-600 font-mono text-sm mb-1">
                          ${value.toFixed(2)}
                        </div>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
