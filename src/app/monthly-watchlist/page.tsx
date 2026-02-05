'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface MonthlyStock {
  id: number;
  stock_id: number;
  investment_date: string;
  stock_symbol: string;
  buy_price: number | null;
  active_price: number | null;
  created_at: string;
  updated_at: string;
}

interface StockValuation {
  id: number;
  stock: string;
}

export default function MonthlyWatchList() {
  const [monthlyStocks, setMonthlyStocks] = useState<MonthlyStock[]>([]);
  const [stockValuations, setStockValuations] = useState<StockValuation[]>([]);
  const [selectedStockId, setSelectedStockId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    loadMonthlyStocks();
    loadStockValuations();
  }, [currentMonth, currentYear]);

  const loadMonthlyStocks = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/monthly-stocks?month=${currentMonth}&year=${currentYear}`
      );
      const result = await response.json();

      if (response.ok && result.data) {
        // Sort stocks: buys first (alphabetically), then non-buys (alphabetically)
        const sortedStocks = result.data.sort((a: MonthlyStock, b: MonthlyStock) => {
          const aIsBuy = a.buy_price !== null && a.buy_price !== undefined && 
                        a.active_price !== null && a.active_price !== undefined && 
                        Number(a.active_price) < Number(a.buy_price);
          const bIsBuy = b.buy_price !== null && b.buy_price !== undefined && 
                        b.active_price !== null && b.active_price !== undefined && 
                        Number(b.active_price) < Number(b.buy_price);
          
          // If one is a buy and the other isn't, buy comes first
          if (aIsBuy && !bIsBuy) return -1;
          if (!aIsBuy && bIsBuy) return 1;
          
          // If both are buys or both are non-buys, sort alphabetically by symbol
          return a.stock_symbol.localeCompare(b.stock_symbol);
        });
        setMonthlyStocks(sortedStocks);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load monthly stocks' });
        setMonthlyStocks([]);
      }
    } catch (error: any) {
      console.error('Error loading monthly stocks:', error);
      setMessage({ type: 'error', text: `Error loading monthly stocks: ${error.message || 'Unknown error'}` });
      setMonthlyStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStockValuations = async () => {
    try {
      const response = await fetch('/api/stock-valuations/list');
      const result = await response.json();

      if (response.ok && result.data) {
        setStockValuations(result.data);
      } else {
        console.error('Failed to load stock valuations:', result.error);
      }
    } catch (error: any) {
      console.error('Error loading stock valuations:', error);
    }
  };

  const handleAddStock = async () => {
    if (!selectedStockId) {
      setMessage({ type: 'error', text: 'Please select a stock' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Create date for the first day of the current month
      const investmentDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

      // Check if this stock already exists for this month
      const existingStock = monthlyStocks.find(
        (stock) => stock.stock_id === parseInt(selectedStockId)
      );

      if (existingStock) {
        setMessage({ type: 'error', text: 'This stock already exists for the current month' });
        setSaving(false);
        return;
      }

      const response = await fetch('/api/monthly-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_id: parseInt(selectedStockId),
          investment_date: investmentDate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add stock' });
        setSaving(false);
        return;
      }

      // Reload the monthly stocks
      await loadMonthlyStocks();
      setSelectedStockId('');
      setMessage({ type: 'success', text: 'Stock added successfully!' });
    } catch (error: any) {
      console.error('Error adding stock:', error);
      setMessage({ type: 'error', text: `Error adding stock: ${error.message || 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStock = async (id: number) => {
    if (!confirm('Are you sure you want to remove this stock from the monthly watchlist?')) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/monthly-stocks?id=${id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to delete stock' });
        setSaving(false);
        return;
      }

      // Reload the monthly stocks
      await loadMonthlyStocks();
      setMessage({ type: 'success', text: 'Stock removed successfully!' });
    } catch (error: any) {
      console.error('Error deleting stock:', error);
      setMessage({ type: 'error', text: `Error deleting stock: ${error.message || 'Unknown error'}` });
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const getMonthName = (month: number) => {
    const date = new Date(2000, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Watchlist
        </h1>

        {/* Month/Year Selector */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Filter by:
            </label>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value))}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Stock Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center gap-4">
            <label htmlFor="stock-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Add Stock:
            </label>
            <select
              id="stock-select"
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
              disabled={saving || loading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">-- Select a stock --</option>
              {stockValuations.map((stock) => (
                <option key={stock.id} value={stock.id}>
                  {stock.stock}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddStock}
              disabled={saving || loading || !selectedStockId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {saving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Stocks Grid */}
        {loading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">Loading monthly stocks...</p>
          </div>
        ) : monthlyStocks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              No stocks found for {getMonthName(currentMonth)} {currentYear}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {monthlyStocks.map((stock) => (
              <div
                key={stock.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-3">
                    <Link
                      href={`/watchlist?stock_id=${stock.stock_id}`}
                      className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      {stock.stock_symbol}
                    </Link>
                    <button
                      onClick={() => handleDeleteStock(stock.id)}
                      disabled={saving}
                      className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-3">
                    {/* Buy Price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                        Buy Price
                      </label>
                      <div className="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-semibold h-[42px] flex items-center justify-center">
                        {stock.buy_price !== null && stock.buy_price !== undefined 
                          ? `$${Number(stock.buy_price).toFixed(2)}`
                          : '—'
                        }
                      </div>
                    </div>
                    {/* Active Price */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                        Active Price
                      </label>
                      <div className="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-center font-semibold h-[42px] flex items-center justify-center">
                        {stock.active_price !== null && stock.active_price !== undefined 
                          ? `$${Number(stock.active_price).toFixed(2)}`
                          : '—'
                        }
                      </div>
                    </div>
                    {/* Buy Indicator */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                        Buy
                      </label>
                      <div className={`w-full px-4 py-2 rounded-lg border-2 flex items-center justify-center font-semibold h-[42px] ${
                        stock.buy_price !== null && stock.buy_price !== undefined && 
                        stock.active_price !== null && stock.active_price !== undefined && 
                        Number(stock.active_price) < Number(stock.buy_price)
                          ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
                      }`}>
                        {stock.buy_price !== null && stock.buy_price !== undefined && 
                         stock.active_price !== null && stock.active_price !== undefined && 
                         Number(stock.active_price) < Number(stock.buy_price) ? (
                          <span className="text-lg">✓</span>
                        ) : (
                          <span className="text-lg">✗</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
