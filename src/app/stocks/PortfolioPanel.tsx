'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { buildPortfolioReviewPrompt } from '../utils/buildPortfolioReviewPrompt';
import { buildPortfolioTrafficLightTestPrompt, buildTrafficLightTestPrompt } from '../utils/buildTrafficLightTestPrompt';
import StockCardActions from './StockCardActions';

interface DcfSummary {
  id: string;
}

interface PortfolioStock {
  id: number;
  stock_id: number;
  stock_symbol: string;
  active_price: number | null;
}

interface StockValuation {
  id: number;
  stock: string;
}

export default function PortfolioPanel() {
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>([]);
  const [stockValuations, setStockValuations] = useState<StockValuation[]>([]);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trafficLightCopiedId, setTrafficLightCopiedId] = useState<number | null>(null);
  const [portfolioTrafficLightCopied, setPortfolioTrafficLightCopied] = useState(false);
  const [portfolioReviewCopied, setPortfolioReviewCopied] = useState(false);
  const [watchlistStockIds, setWatchlistStockIds] = useState<Set<number>>(new Set());
  const [addingWatchlistStockId, setAddingWatchlistStockId] = useState<number | null>(null);
  const [dcfBySymbol, setDcfBySymbol] = useState<Map<string, DcfSummary>>(new Map());

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const loadPortfolio = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const response = await fetch('/api/portfolio-stocks');
      const result = await response.json();
      if (response.ok && result.data) {
        setPortfolioStocks(
          [...result.data].sort((a: PortfolioStock, b: PortfolioStock) =>
            a.stock_symbol.localeCompare(b.stock_symbol)
          )
        );
      } else {
        setMessage({
          type: 'error',
          text: result.hint ? `${result.error}. ${result.hint}` : result.error || 'Failed to load portfolio',
        });
        setPortfolioStocks([]);
      }
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to load portfolio',
      });
      setPortfolioStocks([]);
    } finally {
      if (!options?.silent) {
        setLoading(false);
      }
    }
  }, []);

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

  const loadCurrentWatchlist = useCallback(async () => {
    try {
      const response = await fetch(`/api/monthly-stocks?month=${currentMonth}&year=${currentYear}`);
      const result = await response.json();
      if (response.ok && result.data) {
        setWatchlistStockIds(
          new Set(result.data.map((stock: { stock_id: number }) => stock.stock_id))
        );
      }
    } catch {
      // optional
    }
  }, [currentMonth, currentYear]);

  const loadDcfEntries = useCallback(async () => {
    try {
      const response = await fetch('/api/dcf/list?limit=500');
      const result = await response.json();
      if (response.ok && result.data) {
        const map = new Map<string, DcfSummary>();
        for (const entry of result.data as Array<{ id: string; symbol: string }>) {
          const symbol = String(entry.symbol).toUpperCase();
          if (!map.has(symbol)) {
            map.set(symbol, { id: String(entry.id) });
          }
        }
        setDcfBySymbol(map);
      }
    } catch {
      // optional
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
    loadStockValuations();
    loadCurrentWatchlist();
    loadDcfEntries();
  }, [loadPortfolio, loadStockValuations, loadCurrentWatchlist, loadDcfEntries]);

  useEffect(() => {
    if (message?.type !== 'success') return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleAddStock = async () => {
    if (!selectedStockId) {
      setMessage({ type: 'error', text: 'Please select a stock' });
      return;
    }

    setSaving(true);
    setMessage(null);

    if (portfolioStocks.some((s) => s.stock_id === parseInt(selectedStockId, 10))) {
      setMessage({ type: 'error', text: 'This stock is already in your portfolio' });
      setSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/portfolio-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: parseInt(selectedStockId, 10) }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add stock' });
        return;
      }
      await loadPortfolio({ silent: true });
      setSelectedStockId('');
      setMessage({ type: 'success', text: 'Stock added to portfolio!' });
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
    if (!confirm('Remove this stock from your portfolio?')) return;

    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/portfolio-stocks?id=${id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to remove stock' });
        return;
      }
      await loadPortfolio({ silent: true });
      setMessage({ type: 'success', text: 'Stock removed from portfolio.' });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to remove stock',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddToWatchlist = async (stock: PortfolioStock) => {
    if (watchlistStockIds.has(stock.stock_id)) return;

    const investmentDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    setAddingWatchlistStockId(stock.stock_id);
    setMessage(null);

    try {
      const response = await fetch('/api/monthly-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stock.stock_id, investment_date: investmentDate }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add to watchlist' });
        return;
      }
      setWatchlistStockIds((prev) => new Set([...prev, stock.stock_id]));
      setMessage({ type: 'success', text: `${stock.stock_symbol} added to watchlist!` });
    } catch (error: unknown) {
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'Failed to add to watchlist',
      });
    } finally {
      setAddingWatchlistStockId(null);
    }
  };

  const handlePortfolioReview = async () => {
    if (portfolioStocks.length === 0) {
      setMessage({ type: 'error', text: 'Add stocks to your portfolio before running Portfolio Review.' });
      return;
    }

    try {
      const prompt = buildPortfolioReviewPrompt(
        portfolioStocks.map((stock) => ({
          symbol: stock.stock_symbol,
          activePrice: stock.active_price,
        }))
      );
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setPortfolioReviewCopied(true);
        setTimeout(() => setPortfolioReviewCopied(false), 3000);
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

  const handlePortfolioTrafficLightTest = async () => {
    if (portfolioStocks.length === 0) {
      setMessage({ type: 'error', text: 'Add stocks to your portfolio before running the Traffic Light Test.' });
      return;
    }

    try {
      const prompt = buildPortfolioTrafficLightTestPrompt(
        portfolioStocks.map((stock) => ({
          symbol: stock.stock_symbol,
          activePrice: stock.active_price,
        }))
      );
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setPortfolioTrafficLightCopied(true);
        setTimeout(() => setPortfolioTrafficLightCopied(false), 3000);
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

  const handleTrafficLightTest = async (stock: PortfolioStock) => {
    try {
      const prompt = buildTrafficLightTestPrompt({
        symbol: stock.stock_symbol,
        activePrice: stock.active_price,
        monthLabel: 'My Portfolio (all-time)',
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
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
            {portfolioStocks.length} {portfolioStocks.length === 1 ? 'stock' : 'stocks'}
          </span>
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
            <button
              type="button"
              onClick={() => void handlePortfolioReview()}
              disabled={loading || portfolioStocks.length === 0}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                portfolioReviewCopied
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/40'
              }`}
            >
              {portfolioReviewCopied ? '✓ Copied!' : 'Portfolio Review'}
            </button>
            <button
              type="button"
              onClick={() => void handlePortfolioTrafficLightTest()}
              disabled={loading || portfolioStocks.length === 0}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                portfolioTrafficLightCopied
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
              }`}
            >
              {portfolioTrafficLightCopied ? '✓ Copied!' : '🚦 Traffic Light Test'}
            </button>
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
          Loading portfolio…
        </div>
      ) : portfolioStocks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-600 dark:text-gray-400">
          No stocks in your portfolio yet — add one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolioStocks.map((stock) => {
            const symbol = stock.stock_symbol.toUpperCase();
            const dcfEntry = dcfBySymbol.get(symbol);
            const hasDcfEntry = Boolean(dcfEntry);
            const dcfHref = hasDcfEntry
              ? `/dcf?id=${dcfEntry!.id}`
              : `/dcf?symbol=${encodeURIComponent(symbol)}`;

            return (
            <div
              key={stock.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-center mb-3">
                <Link
                  href={`/companies?stock_id=${stock.stock_id}`}
                  className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate"
                >
                  {stock.stock_symbol}
                </Link>
                <StockCardActions
                  stockId={stock.stock_id}
                  saving={saving}
                  trafficLightCopied={trafficLightCopiedId === stock.id}
                  onTrafficLight={() => void handleTrafficLightTest(stock)}
                  showDcf
                  hasDcfEntry={hasDcfEntry}
                  dcfHref={dcfHref}
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0 px-4 py-2 rounded-lg border-2 border-blue-200 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-950/50 text-gray-900 dark:text-blue-100 text-center font-semibold h-[42px] flex items-center justify-center text-lg">
                  {stock.active_price != null ? `$${Number(stock.active_price).toFixed(2)}` : '—'}
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddToWatchlist(stock)}
                  disabled={
                    saving ||
                    addingWatchlistStockId === stock.stock_id ||
                    watchlistStockIds.has(stock.stock_id)
                  }
                  title={
                    watchlistStockIds.has(stock.stock_id)
                      ? 'Already in watchlist this month'
                      : 'Add to watchlist for this month'
                  }
                  aria-label={
                    watchlistStockIds.has(stock.stock_id)
                      ? 'Already in watchlist this month'
                      : 'Add to watchlist for this month'
                  }
                  className={`shrink-0 h-[42px] w-[42px] flex items-center justify-center rounded-lg border text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    watchlistStockIds.has(stock.stock_id)
                      ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
                      : 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                  }`}
                >
                  {addingWatchlistStockId === stock.stock_id ? (
                    '…'
                  ) : (
                    <span className="text-lg font-bold text-emerald-700 dark:text-emerald-300">+</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteStock(stock.id)}
                  disabled={saving}
                  title="Remove from portfolio"
                  aria-label="Remove from portfolio"
                  className="shrink-0 h-[42px] w-[42px] rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold leading-none"
                >
                  ✕
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
