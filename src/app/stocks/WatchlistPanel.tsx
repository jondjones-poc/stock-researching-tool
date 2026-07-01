'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildTrafficLightTestPrompt } from '../utils/buildTrafficLightTestPrompt';
import StockCardActions from './StockCardActions';

interface MonthlyStock {
  id: number;
  stock_id: number;
  investment_date: string;
  stock_symbol: string;
  buy_price: number | null;
  active_price: number | null;
}

interface StockValuation {
  id: number;
  stock: string;
}

function getMonthName(month: number) {
  return new Date(2000, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

function isBuySignal(stock: MonthlyStock): boolean {
  return (
    stock.buy_price != null &&
    stock.active_price != null &&
    Number(stock.active_price) < Number(stock.buy_price)
  );
}

export default function WatchlistPanel() {
  const [monthlyStocks, setMonthlyStocks] = useState<MonthlyStock[]>([]);
  const [stockValuations, setStockValuations] = useState<StockValuation[]>([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [trafficLightCopiedId, setTrafficLightCopiedId] = useState<number | null>(null);

  const loadMonthlyStocks = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const response = await fetch(`/api/monthly-stocks?month=${currentMonth}&year=${currentYear}`);
      const result = await response.json();

      if (response.ok && result.data) {
        const sorted = [...result.data].sort((a: MonthlyStock, b: MonthlyStock) => {
          const aBuy = isBuySignal(a);
          const bBuy = isBuySignal(b);
          if (aBuy && !bBuy) return -1;
          if (!aBuy && bBuy) return 1;
          return a.stock_symbol.localeCompare(b.stock_symbol);
        });
        setMonthlyStocks(sorted);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to load watchlist' });
        setMonthlyStocks([]);
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load watchlist',
      });
      setMonthlyStocks([]);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, [currentMonth, currentYear]);

  const loadStockValuations = useCallback(async () => {
    try {
      const response = await fetch('/api/stock-valuations/list');
      const result = await response.json();
      if (response.ok && result.data) {
        setStockValuations(
          [...result.data].sort((a: StockValuation, b: StockValuation) =>
            a.stock.localeCompare(b.stock, undefined, { sensitivity: 'base' })
          )
        );
      }
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    loadMonthlyStocks();
    loadStockValuations();
  }, [loadMonthlyStocks, loadStockValuations]);

  const handleAddStock = async () => {
    if (!selectedStockId) {
      setMessage({ type: 'error', text: 'Please select a stock' });
      return;
    }

    setSaving(true);
    setMessage(null);
    const investmentDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;

    if (monthlyStocks.some((s) => s.stock_id === parseInt(selectedStockId, 10))) {
      setMessage({ type: 'error', text: 'This stock already exists for the selected month' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/monthly-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: parseInt(selectedStockId, 10), investment_date: investmentDate }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add stock' });
        return;
      }
      await loadMonthlyStocks({ silent: true });
      setSelectedStockId('');
      setMessage({ type: 'success', text: 'Stock added to watchlist!' });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add stock',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStock = async (id: number) => {
    if (!confirm('Remove this stock from the watchlist?')) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/monthly-stocks?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to remove stock' });
        return;
      }
      await loadMonthlyStocks({ silent: true });
      setMessage({ type: 'success', text: 'Stock removed.' });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to remove stock',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTrafficLightTest = async (stock: MonthlyStock) => {
    try {
      const prompt = buildTrafficLightTestPrompt({
        symbol: stock.stock_symbol,
        buyPrice: stock.buy_price,
        activePrice: stock.active_price,
        monthLabel: `${getMonthName(currentMonth)} ${currentYear}`,
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTrafficLightCopiedId(stock.id);
        setTimeout(() => setTrafficLightCopiedId(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Could not access clipboard.' });
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to copy prompt',
      });
    }
  };

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-4 flex-wrap justify-between">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <select
              value={selectedStockId}
              onChange={(e) => setSelectedStockId(e.target.value)}
              disabled={saving || loading}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">-- Add Stock --</option>
              {stockValuations.map((stock) => (
                <option key={stock.id} value={stock.id}>
                  {stock.stock}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void handleAddStock()}
              disabled={saving || loading || !selectedStockId}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium whitespace-nowrap"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Filter by:
            </label>
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {getMonthName(month)}
                </option>
              ))}
            </select>
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(parseInt(e.target.value, 10))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-600 dark:text-gray-400">
          Loading watchlist…
        </div>
      ) : monthlyStocks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-600 dark:text-gray-400">
          No stocks for {getMonthName(currentMonth)} {currentYear}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {monthlyStocks.map((stock) => (
            <div
              key={stock.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center mb-3">
                <Link
                  href={`/companies?stock_id=${stock.stock_id}`}
                  className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  {stock.stock_symbol}
                </Link>
                <StockCardActions
                  stockId={stock.stock_id}
                  saving={saving}
                  trafficLightCopied={trafficLightCopiedId === stock.id}
                  onTrafficLight={() => void handleTrafficLightTest(stock)}
                  onRemove={() => void handleDeleteStock(stock.id)}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    Buy Price
                  </label>
                  <div className="px-4 py-2 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-center font-semibold h-[42px] flex items-center justify-center">
                    {stock.buy_price != null ? `$${Number(stock.buy_price).toFixed(2)}` : '—'}
                  </div>
                </div>
                <div>
                  <div className="px-4 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-950/50 text-gray-900 dark:text-blue-100 text-center font-semibold h-[42px] flex items-center justify-center">
                    {stock.active_price != null ? `$${Number(stock.active_price).toFixed(2)}` : '—'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-center">
                    Buy
                  </label>
                  <div
                    className={`w-full px-4 py-2 rounded-lg border-2 flex items-center justify-center font-semibold h-[42px] ${
                      isBuySignal(stock)
                        ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400'
                        : 'bg-red-100 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-400'
                    }`}
                  >
                    <span className="text-lg">{isBuySignal(stock) ? '✓' : '✗'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
