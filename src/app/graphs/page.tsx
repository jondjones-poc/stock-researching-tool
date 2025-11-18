'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart } from 'recharts';

interface ChartData {
  year: string;
  value: number;
  change?: number;
}

interface GraphsData {
  freeCashFlow: ChartData[];
  shareBuybacks: ChartData[];
  revenue: ChartData[];
  netIncome: ChartData[];
  portfolioValue: ChartData[];
  dividendIncome: ChartData[];
  sharesOutstanding: ChartData[];
  netMargin: ChartData[];
  grossMargin: ChartData[];
  eps: ChartData[];
  operatingIncome: ChartData[];
  error?: string;
  errors?: string[];
  symbol?: string;
}

export default function Graphs() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GraphsData | null>(null);
  const [openDialog, setOpenDialog] = useState<'growth' | 'dividend' | 'value' | null>(null);

  // Auto-load data if symbol exists in localStorage
  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const dcfData = localStorage.getItem('dcfData');
        if (dcfData) {
          const parsedData = JSON.parse(dcfData);
          if (parsedData.symbol) {
            setSymbol(parsedData.symbol);
            await fetchGraphData(parsedData.symbol);
          }
        }
      } catch (error) {
        console.log('Error loading symbol from localStorage:', error);
      }
    };

    loadFromStorage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchGraphData = async (symbolToFetch: string) => {
    setLoading(true);
    setData(null);

    try {
      const response = await fetch(`/api/graphs?symbol=${symbolToFetch.toUpperCase()}`);
      const result = await response.json();

      if (response.ok) {
        setData(result);
      } else {
        setData({ freeCashFlow: [], shareBuybacks: [], revenue: [], netIncome: [], portfolioValue: [], dividendIncome: [], sharesOutstanding: [], netMargin: [], grossMargin: [], eps: [], operatingIncome: [], error: result.error });
      }
    } catch {
      setData({ 
        freeCashFlow: [], 
        shareBuybacks: [], 
        revenue: [], 
        netIncome: [],
        portfolioValue: [],
        dividendIncome: [],
        sharesOutstanding: [],
        netMargin: [],
        grossMargin: [],
        eps: [],
        operatingIncome: [],
        error: 'Failed to fetch data' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    await fetchGraphData(symbol);
  };

  const formatNumber = (value: number) => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (Math.abs(value) >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${(change * 100).toFixed(1)}%`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900 dark:text-white">{`Year: ${label}`}</p>
          <p className="text-blue-600 dark:text-blue-400">
            {`Value: ${formatNumber(data.value)}`}
          </p>
          {data.change !== undefined && (
            <p className={`text-sm ${data.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {`Change: ${formatChange(data.change)}`}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const strategyContent = {
    growth: [
      { title: 'Revenue growth', description: 'Shows how fast the company is expanding its sales, which is the core driver of growth valuations.' },
      { title: 'Gross margin', description: 'Signals how much profit the company keeps from each sale and whether scale will lead to stronger earnings later.' },
      { title: 'Operating margin', description: 'Helps you see if the business can turn fast growth into real profitability.' },
      { title: 'Free cash flow (FCF)', description: 'Important because many growth firms run at a loss, so strong cash generation proves the model works.' },
      { title: 'Price-to-sales (P/S) ratio', description: 'Used because earnings may be low or negative, so sales-based valuations matter more.' },
    ],
    dividend: [
      { title: 'Dividend payout ratio', description: 'Shows how much of earnings go toward dividends and whether the payout is sustainable.' },
      { title: 'Dividend yield', description: 'Tells you how much income you receive for every pound invested.' },
      { title: 'Free cash flow (FCF)', description: 'Important because dividends are paid in cash, not accounting profits.' },
      { title: 'Debt-to-equity ratio', description: 'High debt can threaten long-term dividend safety during downturns.' },
      { title: 'Earnings stability', description: 'Reliable profits support reliable dividends.' },
    ],
    value: [
      { title: 'Price-to-earnings (P/E) ratio', description: 'Measures how cheap or expensive the stock is relative to its earnings.' },
      { title: 'Price-to-book (P/B) ratio', description: 'Helpful for finding undervalued companies trading below the worth of their assets.' },
      { title: 'Free cash flow yield', description: 'Shows how much cash the company produces compared to its market value.' },
      { title: 'Return on equity (ROE)', description: 'Indicates how well management turns assets into profits.' },
      { title: 'Debt levels', description: 'High leverage can hide risks that make a stock look cheap for the wrong reasons.' },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-6xl mx-auto p-8">
        <div className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            📈 Financial Graphs
          </h1>
          <div className="flex gap-3">
            <button
              onClick={() => setOpenDialog('growth')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
            >
              Growth
            </button>
            <button
              onClick={() => setOpenDialog('dividend')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
            >
              Dividend
            </button>
            <button
              onClick={() => setOpenDialog('value')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors font-medium"
            >
              Value
            </button>
          </div>
        </div>

        {/* Stock Symbol Input */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Stock Symbol"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Generate Graphs'}
              </button>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {(data?.error || (data?.errors && data.errors.length > 0)) && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
              {data.error || `API Errors Detected${data?.symbol ? ` for ${data.symbol}` : ''}`}
            </p>
            {data?.errors && Array.isArray(data.errors) && data.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-red-700 dark:text-red-300 text-sm mb-1">Detailed errors:</p>
                <ul className="list-disc list-inside text-red-600 dark:text-red-400 text-sm space-y-1">
                  {data.errors.map((err: string, index: number) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
                {data.errors.some((err: string) => err.toLowerCase().includes('rate limit')) && (
                  <p className="text-orange-600 dark:text-orange-400 text-sm mt-2">
                    ⚠️ Rate limit detected. Please wait a moment before trying again.
                  </p>
                )}
                {data.errors.some((err: string) => err.toLowerCase().includes('forbidden') || err.includes('403')) && (
                  <p className="text-orange-600 dark:text-orange-400 text-sm mt-2">
                    ⚠️ Access forbidden (403) detected. Some endpoints may require a premium API subscription or additional permissions. The Key Metrics endpoint is often premium-only.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Charts */}
        {data && !data.error && (
          <div className="space-y-8">
            {/* Revenue Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                📊 Revenue
              </h2>
              {data.revenue.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.revenue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No revenue data available</p>
              )}
            </div>

            {/* Margins Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                📊 Net & Gross Margins
              </h2>
              {(data.netMargin.length > 0 || data.grossMargin.length > 0) ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {data.netMargin.length > 0 && (
                    <div className="h-96">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                        Net Margin
                      </h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.netMargin} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="year" 
                            stroke="#6b7280" 
                            fontSize={12}
                          />
                          <YAxis 
                            stroke="#6b7280" 
                            fontSize={12}
                            tickFormatter={(value) => `${value.toFixed(1)}%`}
                            domain={['dataMin - 5', 'dataMax + 5']}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => {
                              const formattedValue = value.toFixed(2);
                              const sign = value >= 0 ? '+' : '';
                              return [`${sign}${formattedValue}%`, name];
                            }}
                            labelFormatter={(label) => `Period: ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                            name="Net Margin"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {data.grossMargin.length > 0 && (
                    <div className="h-96">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
                        Gross Margin
                      </h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data.grossMargin} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis 
                            dataKey="year" 
                            stroke="#6b7280" 
                            fontSize={12}
                          />
                          <YAxis 
                            stroke="#6b7280" 
                            fontSize={12}
                            tickFormatter={(value) => `${value.toFixed(1)}%`}
                            domain={['dataMin - 5', 'dataMax + 5']}
                          />
                          <Tooltip 
                            formatter={(value: number, name: string) => {
                              const formattedValue = value.toFixed(2);
                              const sign = value >= 0 ? '+' : '';
                              return [`${sign}${formattedValue}%`, name];
                            }}
                            labelFormatter={(label) => `Period: ${label}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                            name="Gross Margin"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No margins data available</p>
              )}
            </div>
            {/* Net Income Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                📊 Net Income 
              </h2>
              {data.netIncome.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.netIncome} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={12}
                        tickFormatter={formatNumber}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 4 }}
                        name="Net Income"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No net income data available</p>
              )}
            </div>

            {/* EPS Over Time Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                📈 EPS Over Time
              </h2>
              {data.eps.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.eps} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280" 
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(2)}`}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
                        labelFormatter={(label) => `Period: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#f59e0b" 
                        strokeWidth={3}
                        dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                        name="EPS"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No EPS data available</p>
              )}
            </div>

            {/* Free Cash Flow Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                💰 Free Cash Flow
              </h2>
              {data.freeCashFlow.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.freeCashFlow} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="value" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                        name="Free Cash Flow"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No free cash flow data available</p>
              )}
            </div>

            {/* Share Buybacks Chart with Shares Outstanding Overlay */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                🔄 Share Buybacks & Shares Outstandinng
              </h2>
              {data.shareBuybacks.length > 0 || data.sharesOutstanding.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data.shareBuybacks} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        yAxisId="left"
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <YAxis 
                        yAxisId="right"
                        orientation="right"
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => {
                          if (value >= 1000000000) {
                            return `${(value / 1000000000).toFixed(1)}B`;
                          } else if (value >= 1000000) {
                            return `${(value / 1000000).toFixed(0)}M`;
                          } else {
                            return `${(value / 1000).toFixed(0)}K`;
                          }
                        }}
                      />
                      <Tooltip 
                        formatter={(value: number, name: string) => {
                          if (name === 'Shares Outstanding') {
                            if (value >= 1000000000) {
                              return [`${(value / 1000000000).toFixed(1)}B shares`, name];
                            } else if (value >= 1000000) {
                              return [`${(value / 1000000).toFixed(1)}M shares`, name];
                            } else {
                              return [`${(value / 1000).toFixed(0)}K shares`, name];
                            }
                          }
                          return [formatNumber(value), name];
                        }}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      {data.shareBuybacks.length > 0 && (
                        <Line 
                          yAxisId="left"
                          type="monotone"
                          dataKey="value" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                          name="Share Buybacks"
                        />
                      )}
                      {data.sharesOutstanding.length > 0 && (
                        <Line 
                          yAxisId="right"
                          type="monotone"
                          dataKey="value" 
                          data={data.sharesOutstanding}
                          stroke="#ef4444" 
                          strokeWidth={3}
                          dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                          name="Shares Outstanding"
                        />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No share buyback or shares outstanding data available</p>
              )}
            </div>

        {/* Portfolio Value Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
            📈 Share Price Over Time
          </h2>
              {data.portfolioValue.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.portfolioValue} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(2)}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Stock Price']}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]}
                        name="Stock Price"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No portfolio value data available</p>
              )}
            </div>

            {/* Dividend Income Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                💰 Dividend Income 
              </h2>
              {data.dividendIncome.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dividendIncome} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => `$${value.toFixed(2)}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Dividend Income']}
                        labelFormatter={(label) => `Year: ${label}`}
                      />
                      <Bar 
                        dataKey="value" 
                        fill="#f59e0b" 
                        radius={[4, 4, 0, 0]}
                        name="Dividend Income"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No dividend income data available</p>
              )}
            </div>

            {/* Operating Income Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                📊 Operating Income
              </h2>
              {data.operatingIncome.length > 0 ? (
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.operatingIncome} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="year" 
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis 
                        stroke="#6b7280"
                        fontSize={12}
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        stroke="#3b82f6" 
                        strokeWidth={3}
                        dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                        name="Operating Income"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No operating income data available</p>
              )}
            </div>
          </div>
        )}

        {/* Strategy Dialog */}
        {openDialog && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setOpenDialog(null)}
          >
            <div 
              className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                  {openDialog === 'growth' ? 'Growth' : openDialog === 'dividend' ? 'Dividend' : 'Value'}
                </h2>
                <button
                  onClick={() => setOpenDialog(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                  aria-label="Close dialog"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-6">
                {strategyContent[openDialog].map((item, index) => (
                  <div key={index} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0 last:pb-0">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}