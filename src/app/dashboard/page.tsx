'use client';

import React, { useState, useEffect } from 'react';
import { dashboardConfig, WatchlistSymbol } from '../config/dashboard';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WatchlistData {
  symbol: string;
  name: string;
  last: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  isPositive: boolean;
}

interface ChartData {
  date: string;
  price: number;
  volume: number;
}

interface EarningsData {
  symbol: string;
  date: string;
  eps: number;
  epsEstimate: number;
  epsActual: number | null;
  revenue: number | null;
  link: string;
}

interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  authors: string[];
  summary: string;
  source: string;
  sentiment_label: string;
  sentiment_score: number;
  relevance_score: number;
}

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('VIX'); // Default to first MARKETS symbol
  const [selectedPeriod, setSelectedPeriod] = useState<string>('1Y');
  const [watchlistData, setWatchlistData] = useState<WatchlistData[]>([]);
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customSymbols, setCustomSymbols] = useState<WatchlistSymbol[]>([]);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newSymbol, setNewSymbol] = useState<string>('');
  const [newSymbolCategory, setNewSymbolCategory] = useState<'GROWTH' | 'DIVIDEND & VALUE' | 'MARKETS' | 'WATCHLIST'>('WATCHLIST');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; symbol: string } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | 'GROWTH' | 'DIVIDEND & VALUE' | 'MARKETS' | 'WATCHLIST'>('MARKETS');
  const [showEarnings, setShowEarnings] = useState<boolean>(false);
  const [earningsData, setEarningsData] = useState<EarningsData[]>([]);
  const [earningsLoading, setEarningsLoading] = useState<boolean>(false);
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState<boolean>(false);

  // Fetch watchlist data - only for visible symbols in current category
  const fetchWatchlistData = async () => {
    try {
      let symbolsToFetch: WatchlistSymbol[] = [];
      
      if (categoryFilter === 'ALL') {
        const configSymbols = Object.values(dashboardConfig.watchlist).flat();
        symbolsToFetch = [...configSymbols, ...customSymbols];
      } else {
        const categorySymbols = dashboardConfig.watchlist[categoryFilter] || [];
        const customCategorySymbols = customSymbols.filter(s => s.category === categoryFilter);
        symbolsToFetch = [...categorySymbols, ...customCategorySymbols];
      }
      
      const symbolList = symbolsToFetch.map(symbol => symbol.symbol);
      
      if (symbolList.length === 0) {
        setWatchlistData([]);
        return;
      }
      
      const response = await fetch(`/api/watchlist?symbols=${symbolList.join(',')}`);
      
      if (!response.ok) {
        // Don't throw - just log and continue with empty data
        console.error('Watchlist API error:', response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error('Error details:', errorData);
        setWatchlistData([]);
        return;
      }
      
      const result = await response.json();
      setWatchlistData(result.data || []);
    } catch (error) {
      console.error('Error fetching watchlist data:', error);
      // Don't set error state - just use empty data
      setWatchlistData([]);
    }
  };

  // Calculate date range based on selected period
  const getDateRange = (period: string) => {
    const today = new Date();
    let fromDate = new Date();
    
    switch (period) {
      case '5D':
        fromDate.setDate(today.getDate() - 5);
        break;
      case '1M':
        fromDate.setMonth(today.getMonth() - 1);
        break;
      case 'YTD':
        fromDate = new Date(today.getFullYear(), 0, 1); // January 1st of current year
        break;
      case '1Y':
        fromDate.setFullYear(today.getFullYear() - 1);
        break;
      case 'ALL':
        fromDate.setFullYear(today.getFullYear() - 10); // Default to 10 years
        break;
      default:
        fromDate.setFullYear(today.getFullYear() - 1);
    }
    
    return {
      from: fromDate.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0]
    };
  };

  // Fetch news data for a symbol
  const fetchNewsData = async (symbol: string) => {
    setNewsLoading(true);
    try {
      const response = await fetch(`/api/news?symbol=${symbol}`);
      
      if (!response.ok) {
        console.error('News API error:', response.status);
        setNewsData([]);
        return;
      }
      
      const result = await response.json();
      setNewsData(result.data || []);
    } catch (error) {
      console.error('Error fetching news data:', error);
      setNewsData([]);
    } finally {
      setNewsLoading(false);
    }
  };

  // Fetch earnings data for a symbol
  const fetchEarningsData = async (symbol: string) => {
    setEarningsLoading(true);
    try {
      const response = await fetch(`/api/earnings?symbol=${symbol}`);
      
      if (!response.ok) {
        console.error('Earnings API error:', response.status);
        setEarningsData([]);
        return;
      }
      
      const result = await response.json();
      
      // Transform the data to match our interface
      const earnings: EarningsData[] = result.data?.map((item: any) => ({
        symbol: item.symbol,
        date: item.date,
        eps: item.eps || 0,
        epsEstimate: item.epsEstimate || 0,
        epsActual: item.epsActual,
        revenue: item.revenue,
        link: item.link || ''
      })) || [];
      
      setEarningsData(earnings);
    } catch (error) {
      console.error('Error fetching earnings data:', error);
      setEarningsData([]);
    } finally {
      setEarningsLoading(false);
    }
  };

  // Fetch chart data for selected symbol
  const fetchChartData = async (symbol: string, period: string) => {
    try {
      setLoading(true);
      
      // Get date range for the selected period
      const { from, to } = getDateRange(period);
      
      // Find the symbol configuration to check data source
      const symbolConfig = Object.values(dashboardConfig.watchlist)
        .flat()
        .find(s => s.symbol === symbol);
      
      // Build URL with data source parameters
      let url = `/api/historical-prices?symbol=${symbol}&from=${from}&to=${to}`;
      
      if (symbolConfig?.dataSource === 'FRED' && symbolConfig?.fredSeriesId) {
        url += `&dataSource=FRED&fredSeriesId=${symbolConfig.fredSeriesId}`;
      }
      
      // Fetch historical price data with date range
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      
      const result = await response.json();
      
      // Transform the historical data to chart format
      const historicalData = result.historical || [];
      
      const chartData: ChartData[] = historicalData.map((item: any) => ({
        date: item.date,
        price: item.close, // Use closing price
        volume: item.volume
      }));
      
      console.log(`Loaded ${chartData.length} data points for ${symbol} (${period})`);
      
      setChartData(chartData);
    } catch (error) {
      console.error('Error fetching chart data:', error);
      setError('Failed to load chart data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistData();
    fetchChartData(selectedSymbol, selectedPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSymbol, selectedPeriod, customSymbols, categoryFilter]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu]);

  const handleAddStock = () => {
    if (!newSymbol.trim()) return;
    
    const symbolToAdd: WatchlistSymbol = {
      symbol: newSymbol.toUpperCase(),
      name: newSymbol.toUpperCase(), // Use symbol as name
      category: newSymbolCategory,
      icon: '📌',
      color: 'blue',
      dataSource: 'FMP' // Default to FMP for custom stocks
    };
    
    // Check if symbol already exists
    const allSymbols = [...Object.values(dashboardConfig.watchlist).flat(), ...customSymbols];
    if (allSymbols.some(s => s.symbol === symbolToAdd.symbol)) {
      alert('This symbol is already in the watchlist');
      return;
    }
    
    setCustomSymbols([...customSymbols, symbolToAdd]);
    setNewSymbol('');
    setNewSymbolCategory('WATCHLIST');
    setShowAddModal(false);
  };

  const handleDeleteStock = (symbolToDelete: string) => {
    setCustomSymbols(customSymbols.filter(s => s.symbol !== symbolToDelete));
    setContextMenu(null);
    
    // If the deleted symbol was selected, switch to the default symbol
    if (selectedSymbol === symbolToDelete) {
      setSelectedSymbol(dashboardConfig.defaultSymbol);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent, symbol: string, isCustom: boolean) => {
    // Only show context menu for custom symbols
    if (!isCustom) return;
    
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      symbol: symbol
    });
  };

  const getWatchlistData = (symbol: string): WatchlistData | undefined => {
    return watchlistData.find(item => item.symbol === symbol);
  };

  // Handle clicking on stock name to show earnings
  const handleStockClick = (symbol: string) => {
    // Skip for market indicators - they have their own info panels
    const marketIndicators = ['VIX', 'US10Y', 'DXY', 'GLD', 'BTC', 'MORTGAGE30Y', 'SPX'];
    if (marketIndicators.includes(symbol)) {
      setSelectedSymbol(symbol);
      setShowEarnings(false);
      return;
    }
    
    setSelectedSymbol(symbol);
    setShowEarnings(true);
    fetchNewsData(symbol);
    fetchEarningsData(symbol);
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2);
  };

  const formatChange = (change: number): string => {
    return change >= 0 ? `+${change.toFixed(2)}` : change.toFixed(2);
  };

  const formatChangePercent = (changePercent: number): string => {
    return changePercent >= 0 ? `+${changePercent.toFixed(2)}%` : `${changePercent.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Header */}
      <div className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-lg font-semibold">
              {Object.values(dashboardConfig.watchlist).flat().find(s => s.symbol === selectedSymbol)?.name || 
               customSymbols.find(s => s.symbol === selectedSymbol)?.name || 
               selectedSymbol}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">· 1W · NYSE</span>
          </div>
          <div className="flex items-center space-x-2">
            {getWatchlistData(selectedSymbol) && (
              <>
                <span className="text-xl font-bold text-green-400">
                  {formatPrice(getWatchlistData(selectedSymbol)!.last)}
                </span>
                <span className="text-green-400">
                  {formatChange(getWatchlistData(selectedSymbol)!.change)}
                </span>
                <span className="text-green-400">
                  ({formatChangePercent(getWatchlistData(selectedSymbol)!.changePercent)})
                </span>
              </>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Add Stock Button */}
          <button 
            onClick={() => setShowAddModal(true)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300"
            title="Add Stock to Watchlist"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"></path>
            </svg>
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Main Chart Area */}
        <div className="flex-1 bg-white dark:bg-gray-900">
          {/* Chart Controls */}
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button className="px-3 py-1 bg-red-600 text-white rounded text-sm font-medium">
                  SELL {formatPrice(getWatchlistData(selectedSymbol)?.last || 0)}
                </button>
                <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium">
                  BUY {formatPrice((getWatchlistData(selectedSymbol)?.last || 0) + 0.18)}
                </button>
                <span className="text-sm text-gray-400">Spread: 0.18</span>
              </div>
              
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-400">Vol {getWatchlistData(selectedSymbol)?.volume ? Math.round(getWatchlistData(selectedSymbol)!.volume / 1000000) + 'M' : 'N/A'}</span>
              </div>
            </div>
          </div>

          {/* Chart Title */}
          <div className="px-4 py-2 border-b border-gray-700">
            <h2 className="text-lg font-semibold">
              {dashboardConfig.watchlist.GROWTH.find(s => s.symbol === selectedSymbol)?.name || selectedSymbol}
            </h2>
          </div>

          {/* Chart Area */}
          <div className="h-96 bg-white dark:bg-gray-900 p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500 dark:text-gray-400">Loading chart data...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-500 dark:text-red-400">{error}</div>
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-full bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-4">
                {/* Price Chart */}
                <div className="h-3/4 mb-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(value) => {
                          const date = new Date(value);
                          if (selectedPeriod === '5D') {
                            return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                          } else if (selectedPeriod === '1M') {
                            return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                          } else if (selectedPeriod === 'YTD' || selectedPeriod === '1Y') {
                            return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                          } else {
                            return date.getFullYear().toString();
                          }
                        }}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(0)}`}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                        labelFormatter={(label) => {
                          const date = new Date(label);
                          return date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          });
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {/* Volume Chart */}
                <div className="h-1/4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#9CA3AF"
                        fontSize={10}
                        hide={true}
                      />
                      <YAxis 
                        stroke="#9CA3AF"
                        fontSize={10}
                        tickFormatter={(value) => {
                          if (value >= 1000000000) {
                            return `${(value / 1000000000).toFixed(1)}B`;
                          } else if (value >= 1000000) {
                            return `${(value / 1000000).toFixed(1)}M`;
                          } else if (value >= 1000) {
                            return `${(value / 1000).toFixed(1)}K`;
                          }
                          return value.toString();
                        }}
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #374151',
                          borderRadius: '6px',
                          color: '#F9FAFB'
                        }}
                        formatter={(value: number) => {
                          if (value >= 1000000000) {
                            return [`${(value / 1000000000).toFixed(2)}B`, 'Volume'];
                          } else if (value >= 1000000) {
                            return [`${(value / 1000000).toFixed(2)}M`, 'Volume'];
                          }
                          return [value.toLocaleString(), 'Volume'];
                        }}
                        labelFormatter={(label) => {
                          const date = new Date(label);
                          return date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          });
                        }}
                      />
                      <Bar 
                        dataKey="volume" 
                        fill="#6B7280"
                        opacity={0.6}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-gray-500 dark:text-gray-400">No chart data available</div>
              </div>
            )}
          </div>

          {/* Time Period Filters */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex space-x-2">
              {dashboardConfig.timePeriods.map((period) => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>

          {/* VIX Information Panel */}
          {selectedSymbol === 'VIX' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">VIX Volatility Guide</h4>
              <div className="space-y-2">
                {/* < 15 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-green-700 dark:text-green-400">
                    &lt; 15
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">Very low volatility</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Market calm, often complacent — &ldquo;too quiet.&rdquo;</div>
                  </div>
                </div>

                {/* 15-20 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-blue-700 dark:text-blue-400">
                    15 – 20
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300">Normal range</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Healthy, steady market.</div>
                  </div>
                </div>

                {/* 20-25 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-yellow-700 dark:text-yellow-400">
                    20 – 25
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Caution zone</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">Rising fear, small corrections possible.</div>
                  </div>
                </div>

                {/* 25-30 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-orange-700 dark:text-orange-400">
                    25 – 30
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-orange-800 dark:text-orange-300">Elevated risk</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Often during pullbacks or earnings uncertainty.</div>
                  </div>
                </div>

                {/* > 30 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-red-700 dark:text-red-400">
                    &gt; 30
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800 dark:text-red-300">Panic mode</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Fear spike — market drops, volatility funds blow up.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* US10Y Information Panel */}
          {selectedSymbol === 'US10Y' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">10-Year Treasury Yield Guide</h4>
              <div className="space-y-2">
                {/* < 2% */}
                <div className="flex items-start space-x-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-green-700 dark:text-green-400">
                    &lt; 2%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">Very low rates</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Economic weakness, recession fears, or Fed stimulus.</div>
                  </div>
                </div>

                {/* 2-3% */}
                <div className="flex items-start space-x-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-blue-700 dark:text-blue-400">
                    2 – 3%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300">Low-moderate</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Accommodative Fed, stable growth environment.</div>
                  </div>
                </div>

                {/* 3-4% */}
                <div className="flex items-start space-x-3 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-yellow-700 dark:text-yellow-400">
                    3 – 4%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Normal range</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">Balanced economic growth, neutral Fed policy.</div>
                  </div>
                </div>

                {/* 4-5% */}
                <div className="flex items-start space-x-3 p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-orange-700 dark:text-orange-400">
                    4 – 5%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-orange-800 dark:text-orange-300">Rising rates</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Inflation concerns, Fed tightening cycle.</div>
                  </div>
                </div>

                {/* > 5% */}
                <div className="flex items-start space-x-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-red-700 dark:text-red-400">
                    &gt; 5%
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800 dark:text-red-300">High rates</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Aggressive Fed, recession risk, credit stress.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DXY (Dollar Index) Information Panel */}
          {selectedSymbol === 'DXY' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Dollar Index (DXY) Guide</h4>
              <div className="space-y-2">
                {/* > 108 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-red-700 dark:text-red-400">
                    &gt; 108
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-red-800 dark:text-red-300">Very strong dollar</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Global stress → USD demand spikes (capital leaving risk assets).</div>
                  </div>
                </div>

                {/* 102-107 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-blue-700 dark:text-blue-400">
                    102 – 107
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300">Normal range</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Neutral.</div>
                  </div>
                </div>

                {/* < 100 */}
                <div className="flex items-start space-x-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex-shrink-0 w-16 text-xs font-bold text-green-700 dark:text-green-400">
                    &lt; 100
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">Weak dollar</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Risk-on → Liquidity flows back to stocks, gold, crypto.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gold Information Panel */}
          {selectedSymbol === 'GLD' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Gold Price (GLD ETF)</h4>
              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-2 rounded bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">📈</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-yellow-800 dark:text-yellow-300">SPDR Gold Shares ETF (GLD)</div>
                    <div className="text-xs text-yellow-600 dark:text-yellow-400">Tracks gold bullion price. Flight to safety during market uncertainty.</div>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">📉</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-800 dark:text-green-300">Falling while equities rise</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Risk-on.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 30-Year Mortgage Rate Information Panel */}
          {selectedSymbol === 'MORTGAGE30Y' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">US 30-Year Mortgage Rate</h4>
              <div className="space-y-2">
                <div className="flex items-start space-x-3 p-2 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">🏠</span>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-orange-800 dark:text-orange-300">Linked to 10-Year Yield</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Direct link to 10-year yield; when &gt;7% → housing slowdown → recession signal.</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* News Section */}
          {showEarnings && selectedSymbol !== 'VIX' && selectedSymbol !== 'US10Y' && selectedSymbol !== 'DXY' && selectedSymbol !== 'GLD' && selectedSymbol !== 'BTC' && selectedSymbol !== 'MORTGAGE30Y' && selectedSymbol !== 'SPX' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Latest News - {selectedSymbol}</h4>
              {newsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">Loading news...</div>
                </div>
              ) : newsData.length > 0 ? (
                <div className="space-y-2">
                  {newsData.map((news, index) => {
                    // Parse the timestamp
                    const timeStr = news.time_published;
                    const year = timeStr.slice(0, 4);
                    const month = timeStr.slice(4, 6);
                    const day = timeStr.slice(6, 8);
                    const hour = timeStr.slice(9, 11);
                    const minute = timeStr.slice(11, 13);
                    const formattedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
                    const timeAgo = Math.floor((Date.now() - formattedDate.getTime()) / (1000 * 60 * 60));
                    
                    // Determine sentiment color
                    const sentimentColor = 
                      news.sentiment_label === 'Bullish' ? 'text-green-600 dark:text-green-400' :
                      news.sentiment_label === 'Bearish' ? 'text-red-600 dark:text-red-400' :
                      news.sentiment_label === 'Somewhat-Bullish' ? 'text-green-500 dark:text-green-500' :
                      news.sentiment_label === 'Somewhat-Bearish' ? 'text-orange-500 dark:text-orange-400' :
                      'text-gray-600 dark:text-gray-400';
                    
                    return (
                      <a
                        key={index}
                        href={news.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h5 className="text-sm font-medium text-green-900 dark:text-green-300 line-clamp-2 mb-1">
                              {news.title}
                            </h5>
                            <p className="text-xs text-green-700 dark:text-green-400 line-clamp-2 mb-2">
                              {news.summary}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                              <span className="font-medium">{news.source}</span>
                              <span>•</span>
                              <span>{timeAgo}h ago</span>
                              {news.sentiment_label && (
                                <>
                                  <span>•</span>
                                  <span className={sentimentColor}>{news.sentiment_label}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h5 className="text-sm font-medium text-orange-900 dark:text-orange-300">No News Available</h5>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                        Unable to fetch news. This may be due to API rate limiting.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Earnings Information Panel */}
          {showEarnings && selectedSymbol !== 'VIX' && selectedSymbol !== 'US10Y' && selectedSymbol !== 'DXY' && selectedSymbol !== 'GLD' && selectedSymbol !== 'BTC' && selectedSymbol !== 'MORTGAGE30Y' && selectedSymbol !== 'SPX' && (
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <h4 className="text-sm font-semibold mb-3 text-gray-900 dark:text-white">Earnings Information - {selectedSymbol}</h4>
              {earningsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500 dark:text-gray-400">Loading earnings data...</div>
                </div>
              ) : earningsData.length > 0 ? (
                <div className="space-y-3">
                  {/* Most Recent Earnings */}
                  <div className="p-3 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">Most Recent Earnings</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-xs text-blue-700 dark:text-blue-400">Date:</span>
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
                          {new Date(earningsData[0]?.date || '').toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-blue-700 dark:text-blue-400">Estimated EPS:</span>
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-300">
                          ${earningsData[0]?.epsEstimate?.toFixed(2) || 'N/A'}
                        </span>
                      </div>
                      {earningsData[0]?.epsActual !== null && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-blue-700 dark:text-blue-400">Actual EPS:</span>
                            <span className={`text-xs font-medium ${
                              earningsData[0].epsActual > earningsData[0].epsEstimate 
                                ? 'text-green-600 dark:text-green-400' 
                                : earningsData[0].epsActual < earningsData[0].epsEstimate
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-900 dark:text-blue-300'
                            }`}>
                              ${earningsData[0].epsActual.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-blue-700 dark:text-blue-400">Surprise:</span>
                            <span className={`text-xs font-medium ${
                              earningsData[0].epsActual > earningsData[0].epsEstimate 
                                ? 'text-green-600 dark:text-green-400' 
                                : earningsData[0].epsActual < earningsData[0].epsEstimate
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-blue-900 dark:text-blue-300'
                            }`}>
                              {earningsData[0].epsActual > earningsData[0].epsEstimate ? '+' : ''}
                              ${(earningsData[0].epsActual - earningsData[0].epsEstimate).toFixed(2)} 
                              ({((earningsData[0].epsActual - earningsData[0].epsEstimate) / earningsData[0].epsEstimate * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Previous Earnings */}
                  {earningsData.length > 1 && (
                    <div className="p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                      <h5 className="text-sm font-medium text-green-900 dark:text-green-300 mb-2">Previous Earnings</h5>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span className="text-xs text-green-700 dark:text-green-400">Date:</span>
                          <span className="text-xs font-medium text-green-900 dark:text-green-300">
                            {new Date(earningsData[1]?.date || '').toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-green-700 dark:text-green-400">Estimated EPS:</span>
                          <span className="text-xs font-medium text-green-900 dark:text-green-300">
                            ${earningsData[1]?.epsEstimate?.toFixed(2) || 'N/A'}
                          </span>
                        </div>
                        {earningsData[1]?.epsActual !== null && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-xs text-green-700 dark:text-green-400">Actual EPS:</span>
                              <span className={`text-xs font-medium ${
                                earningsData[1].epsActual > earningsData[1].epsEstimate 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : earningsData[1].epsActual < earningsData[1].epsEstimate
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-900 dark:text-green-300'
                              }`}>
                                ${earningsData[1].epsActual.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-xs text-green-700 dark:text-green-400">Surprise:</span>
                              <span className={`text-xs font-medium ${
                                earningsData[1].epsActual > earningsData[1].epsEstimate 
                                  ? 'text-green-600 dark:text-green-400' 
                                  : earningsData[1].epsActual < earningsData[1].epsEstimate
                                    ? 'text-red-600 dark:text-red-400'
                                    : 'text-green-900 dark:text-green-300'
                              }`}>
                                {earningsData[1].epsActual > earningsData[1].epsEstimate ? '+' : ''}
                                ${(earningsData[1].epsActual - earningsData[1].epsEstimate).toFixed(2)}
                                ({((earningsData[1].epsActual - earningsData[1].epsEstimate) / earningsData[1].epsEstimate * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Investor Relations Link */}
                  {earningsData[0]?.link && (
                    <div className="p-3 rounded bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                      <h5 className="text-sm font-medium text-purple-900 dark:text-purple-300 mb-2">Investor Relations</h5>
                      <a
                        href={earningsData[0].link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                      >
                        View Investor Relations Page
                        <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <h5 className="text-sm font-medium text-orange-900 dark:text-orange-300">No Earnings Data Available</h5>
                      <p className="text-xs text-orange-700 dark:text-orange-400 mt-1">
                        Unable to fetch earnings information. This may be due to API rate limiting or the data is not available for this symbol.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Watchlist Sidebar */}
        <div className="w-80 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Watchlist</h3>
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | 'GROWTH' | 'DIVIDEND & VALUE' | 'MARKETS' | 'WATCHLIST')}
              className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="ALL">All Categories</option>
              <option value="MARKETS">Markets</option>
              <option value="GROWTH">Growth</option>
              <option value="DIVIDEND & VALUE">Dividend & Value</option>
              <option value="WATCHLIST">Watchlist</option>
            </select>
          </div>

          <div className="overflow-y-auto max-h-screen">
            {Object.entries(dashboardConfig.watchlist)
              .filter(([category]) => categoryFilter === 'ALL' || category === categoryFilter)
              .map(([category, symbols]) => {
              // Merge config symbols with custom symbols for this category
              const customSymbolsForCategory = customSymbols.filter(s => s.category === category);
              const allSymbolsForCategory = [...symbols, ...customSymbolsForCategory];
              
              return (
                <div key={category} className="border-b border-gray-200 dark:border-gray-700">
                  {allSymbolsForCategory.map((symbol) => {
                    const data = getWatchlistData(symbol.symbol);
                    const isSelected = selectedSymbol === symbol.symbol;
                    const isCustom = customSymbols.some(s => s.symbol === symbol.symbol);
                    
                    return (
                      <div
                        key={symbol.symbol}
                        onClick={() => setSelectedSymbol(symbol.symbol)}
                        onDoubleClick={(e) => handleDoubleClick(e, symbol.symbol, isCustom)}
                        className={`px-4 py-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 ${
                          isSelected ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div 
                            className="flex-1 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleStockClick(symbol.symbol)}
                            title="Click to view earnings information"
                          >
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{symbol.icon}</span>
                              <span className="font-medium text-sm text-gray-900 dark:text-white">
                                {symbol.name}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 ml-7">
                              ({symbol.symbol})
                            </div>
                          </div>
                          <div className="text-right">
                            {data ? (
                              <>
                                <div className="text-sm font-medium">{formatPrice(data.last)}</div>
                                <div className={`text-xs ${data.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatChange(data.change)}
                                </div>
                                <div className={`text-xs ${data.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatChangePercent(data.changePercent)}
                                </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96 border border-gray-300 dark:border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Add Stock to Watchlist</h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewSymbol('');
                  setNewSymbolCategory('WATCHLIST');
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stock Symbol *
                </label>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                  placeholder="e.g., AAPL"
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category *
                </label>
                <select
                  value={newSymbolCategory}
                  onChange={(e) => setNewSymbolCategory(e.target.value as 'GROWTH' | 'DIVIDEND & VALUE' | 'MARKETS' | 'WATCHLIST')}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                >
                  <option value="GROWTH">GROWTH</option>
                  <option value="DIVIDEND & VALUE">DIVIDEND & VALUE</option>
                  <option value="MARKETS">MARKETS</option>
                  <option value="WATCHLIST">WATCHLIST</option>
                </select>
              </div>
              
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={handleAddStock}
                  disabled={!newSymbol.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Add Stock
                </button>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewSymbol('');
                    setNewSymbolCategory('WATCHLIST');
                  }}
                  className="flex-1 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteStock(contextMenu.symbol);
            }}
            className="w-full px-4 py-2 text-left text-sm text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete {contextMenu.symbol}</span>
          </button>
        </div>
      )}

      {/* Navigation Link */}
      <div className="fixed bottom-4 right-4">
        <Link 
          href="/"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg transition-colors"
        >
          Company Research →
        </Link>
      </div>
    </div>
  );
}
