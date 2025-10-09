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

  // Fetch watchlist data
  const fetchWatchlistData = async () => {
    try {
      const configSymbols = Object.values(dashboardConfig.watchlist).flat();
      const allSymbols = [...configSymbols, ...customSymbols];
      const symbolList = allSymbols.map(symbol => symbol.symbol);
      
      const response = await fetch(`/api/watchlist?symbols=${symbolList.join(',')}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch watchlist data');
      }
      
      const result = await response.json();
      setWatchlistData(result.data);
    } catch (error) {
      console.error('Error fetching watchlist data:', error);
      setError('Failed to load watchlist data');
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
  }, [selectedSymbol, selectedPeriod, customSymbols]);

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
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
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
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-700 dark:text-gray-300">Watchlist</span>
            <svg className="w-4 h-4 text-gray-700 dark:text-gray-300" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex items-center space-x-2">
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
            <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
            </button>
            <button className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>
          </div>
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
            <p className="text-sm text-gray-400">NYSE • Real-time • Market open</p>
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
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          } else if (selectedPeriod === '1M') {
                            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          } else if (selectedPeriod === 'YTD' || selectedPeriod === '1Y') {
                            return date.toLocaleDateString('en-US', { month: 'short' });
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
                  <div className="px-4 py-2 bg-gray-100 dark:bg-gray-750 text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                    {category}
                  </div>
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
                          <div className="flex items-center space-x-2">
                            <span className="text-sm">{symbol.icon}</span>
                            <span className="font-medium text-sm">{symbol.symbol}</span>
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
