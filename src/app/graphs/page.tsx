'use client';

import { useState } from 'react';
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
}

export default function Graphs() {
  const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GraphsData | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;

    setLoading(true);
    setData(null);

    try {
      const response = await fetch(`/api/graphs?symbol=${symbol.toUpperCase()}`);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <main className="max-w-6xl mx-auto p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            📈 Financial Graphs
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Analyze free cash flow, share buybacks, and revenue trends over time
          </p>
        </div>

        {/* Stock Symbol Input */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="symbol" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Stock Symbol
              </label>
              <input
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Enter stock symbol (e.g., AAPL, MSFT, GOOGL)"
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
        {data?.error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-8">
            <p className="text-red-800 dark:text-red-200">{data.error}</p>
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
      </main>
    </div>
  );
}