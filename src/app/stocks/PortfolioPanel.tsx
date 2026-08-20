'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildPortfolioReviewPrompt } from '../utils/buildPortfolioReviewPrompt';
import { buildPortfolioTrafficLightTestPrompt, buildTrafficLightTestPrompt } from '../utils/buildTrafficLightTestPrompt';
import { formatPositionValue, formatPriceMovePercent, priceMoveBoxClass } from '../utils/formatPriceMove';
import PortfolioStockCard from './PortfolioStockCard';
import PortfolioStockTable from './PortfolioStockTable';

type PortfolioViewMode = 'cards' | 'table';
type PortfolioBook = 'main' | 'contrarian';

const VIEW_MODE_KEY = 'portfolio-view-mode-v2';

const PORTFOLIO_BOOKS: Array<{ slug: PortfolioBook; name: string; href: string }> = [
  { slug: 'main', name: 'My Portfolio', href: '/stocks/portfolio' },
  { slug: 'contrarian', name: 'The Contrarian Portfolio', href: '/stocks/portfolio/contrarian' },
];

function readViewMode(): PortfolioViewMode {
  if (typeof window === 'undefined') return 'table';
  const stored = window.localStorage.getItem(VIEW_MODE_KEY);
  if (stored === 'cards') return 'cards';
  if (stored === 'table') return 'table';
  return 'table';
}

interface DcfSummary {
  id: string;
}

interface PortfolioStock {
  id: number;
  stock_id: number;
  stock_symbol: string;
  active_price: number | null;
  bear_case_low_price?: number | null;
  day_change_pct?: number | null;
  month_change_pct?: number | null;
  shares?: number | null;
  avg_buy_cost?: number | null;
  position_value?: number | null;
  gain_loss_pct?: number | null;
}

interface StockValuation {
  id: number;
  stock: string;
}

export default function PortfolioPanel({ book = 'main' }: { book?: PortfolioBook }) {
  const activeSlug = book;
  const isTrading212 = book === 'contrarian';
  const isEtoroLive = book === 'main';
  const isLiveBroker = isTrading212 || isEtoroLive;
  const [portfolioStocks, setPortfolioStocks] = useState<PortfolioStock[]>([]);
  const [stockValuations, setStockValuations] = useState<StockValuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trafficLightCopiedId, setTrafficLightCopiedId] = useState<number | null>(null);
  const [portfolioTrafficLightCopied, setPortfolioTrafficLightCopied] = useState(false);
  const [portfolioReviewCopied, setPortfolioReviewCopied] = useState(false);
  const [watchlistStockIds, setWatchlistStockIds] = useState<Set<number>>(new Set());
  const [addingWatchlistStockId, setAddingWatchlistStockId] = useState<number | null>(null);
  const [dcfBySymbol, setDcfBySymbol] = useState<Map<string, DcfSummary>>(new Map());
  const [usdToGbpRate, setUsdToGbpRate] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<PortfolioViewMode>('table');
  const [reloadingEtoro, setReloadingEtoro] = useState(false);
  const [styleCategories, setStyleCategories] = useState<Array<{ slug: string; label: string }>>([]);
  const [styleTagsBySymbol, setStyleTagsBySymbol] = useState<Record<string, string>>({});
  const [taggingSymbol, setTaggingSymbol] = useState<string | null>(null);

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const loadPortfolio = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
      setMessage(null);
    }
    try {
      const response = await fetch(
        isTrading212
          ? '/api/trading212/portfolio'
          : isEtoroLive
            ? '/api/etoro/portfolio/live'
            : `/api/portfolio-stocks?portfolio=${encodeURIComponent(activeSlug)}`
      );
      const result = await response.json();
      if (response.ok && result.data) {
        setPortfolioStocks(
          [...result.data].sort((a: PortfolioStock, b: PortfolioStock) =>
            a.stock_symbol.localeCompare(b.stock_symbol)
          )
        );
        if (result.fx?.usd_to_gbp && Number.isFinite(result.fx.usd_to_gbp)) {
          setUsdToGbpRate(result.fx.usd_to_gbp);
        } else {
          setUsdToGbpRate(null);
        }
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
  }, [activeSlug, isEtoroLive, isTrading212]);

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

  const loadStyleTags = useCallback(async () => {
    if (!isEtoroLive) {
      setStyleCategories([]);
      setStyleTagsBySymbol({});
      return;
    }
    try {
      const response = await fetch('/api/portfolio-style-tags', { credentials: 'include' });
      const result = await response.json();
      if (response.ok) {
        setStyleCategories(
          Array.isArray(result.categories)
            ? result.categories.map((item: { slug: string; label: string }) => ({
                slug: item.slug,
                label: item.label,
              }))
            : []
        );
        setStyleTagsBySymbol((result.tags || {}) as Record<string, string>);
      }
    } catch {
      // optional until migration applied
    }
  }, [isEtoroLive]);

  const handleStyleTagChange = useCallback(
    async (symbol: string, category: string | null) => {
      const normalized = symbol.trim().toUpperCase();
      if (!normalized) return;
      setTaggingSymbol(normalized);
      setMessage(null);
      try {
        const response = await fetch('/api/portfolio-style-tags', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ symbol: normalized, category }),
        });
        const result = await response.json();
        if (!response.ok) {
          setMessage({
            type: 'error',
            text: result.hint ? `${result.error}. ${result.hint}` : result.error || 'Failed to save tag',
          });
          return;
        }
        setStyleTagsBySymbol((prev) => {
          const next = { ...prev };
          if (category) next[normalized] = category;
          else delete next[normalized];
          return next;
        });
      } catch (error: unknown) {
        setMessage({
          type: 'error',
          text: error instanceof Error ? error.message : 'Failed to save tag',
        });
      } finally {
        setTaggingSymbol(null);
      }
    },
    []
  );

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
    setViewMode(readViewMode());
  }, []);

  const handleViewModeChange = (mode: PortfolioViewMode) => {
    setViewMode(mode);
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  useEffect(() => {
    void loadPortfolio();
  }, [loadPortfolio]);

  useEffect(() => {
    void loadStockValuations();
    void loadCurrentWatchlist();
    void loadDcfEntries();
  }, [loadStockValuations, loadCurrentWatchlist, loadDcfEntries]);

  useEffect(() => {
    void loadStyleTags();
  }, [loadStyleTags]);

  useEffect(() => {
    if (message?.type !== 'success') return;
    const timer = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const handleDeleteStock = async (id: number) => {
    if (!confirm('Remove this stock from this portfolio?')) return;

    if (isLiveBroker) {
      setMessage({
        type: 'error',
        text: isTrading212
          ? 'The Contrarian Portfolio is loaded live from Trading 212, so holdings cannot be removed here.'
          : 'My Portfolio is loaded live from eToro, so holdings cannot be removed here.',
      });
      return;
    }

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
      setMessage({ type: 'success', text: 'Stock removed from this portfolio.' });
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
    const stockId =
      stock.stock_id ||
      stockValuations.find((item) => item.stock.toUpperCase() === stock.stock_symbol.toUpperCase())?.id ||
      0;
    if (!stockId) {
      setMessage({ type: 'error', text: `${stock.stock_symbol} is not in Companies Research yet.` });
      return;
    }
    if (watchlistStockIds.has(stockId)) return;

    const investmentDate = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    setAddingWatchlistStockId(stockId);
    setMessage(null);

    try {
      const response = await fetch('/api/monthly-stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock_id: stockId, investment_date: investmentDate }),
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage({ type: 'error', text: result.error || 'Failed to add to watchlist' });
        return;
      }
      setWatchlistStockIds((prev) => new Set([...prev, stockId]));
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
          avgBuyPrice: stock.avg_buy_cost,
          gainLossPercent: stock.gain_loss_pct,
          usdToGbpRate,
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

  const handleReloadHoldings = async () => {
    if (isLiveBroker) {
      setReloadingEtoro(true);
      setMessage(null);
      try {
        const response = await fetch(
          isTrading212
            ? '/api/trading212/portfolio?refresh=1'
            : '/api/etoro/portfolio/live?refresh=1'
        );
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || 'Failed to reload holdings');
        }
        setPortfolioStocks(
          [...(result.data || [])].sort((a: PortfolioStock, b: PortfolioStock) =>
            a.stock_symbol.localeCompare(b.stock_symbol)
          )
        );
        if (result.fx?.usd_to_gbp && Number.isFinite(result.fx.usd_to_gbp)) {
          setUsdToGbpRate(result.fx.usd_to_gbp);
        }
        setMessage({
          type: 'success',
          text: isTrading212 ? 'Trading 212 holdings reloaded.' : 'eToro holdings reloaded.',
        });
      } catch (error: unknown) {
        setMessage({
          type: 'error',
          text:
            error instanceof Error
              ? error.message
              : isTrading212
                ? 'Failed to reload from Trading 212'
                : 'Failed to reload from eToro',
        });
      } finally {
        setReloadingEtoro(false);
      }
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
        monthLabel: activePortfolioName,
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

  const activePortfolioName =
    PORTFOLIO_BOOKS.find((item) => item.slug === activeSlug)?.name || 'My Portfolio';

  const totalPositionValueUsd = useMemo(() => {
    let sum = 0;
    let hasValue = false;
    for (const stock of portfolioStocks) {
      if (stock.position_value == null || !Number.isFinite(stock.position_value)) continue;
      sum += stock.position_value;
      hasValue = true;
    }
    return hasValue ? sum : null;
  }, [portfolioStocks]);

  const totalDayChangePct = useMemo(() => {
    let weightedSum = 0;
    let weight = 0;
    for (const stock of portfolioStocks) {
      const value = stock.position_value;
      const dayChange = stock.day_change_pct;
      if (value == null || !Number.isFinite(value) || value <= 0) continue;
      if (dayChange == null || !Number.isFinite(dayChange)) continue;
      weightedSum += value * dayChange;
      weight += value;
    }
    return weight > 0 ? weightedSum / weight : null;
  }, [portfolioStocks]);

  const resolvedPortfolioStocks = useMemo(
    () =>
      portfolioStocks.map((stock) => {
        if (stock.stock_id) return stock;
        const match = stockValuations.find(
          (item) => item.stock.toUpperCase() === stock.stock_symbol.toUpperCase()
        );
        return match ? { ...stock, stock_id: match.id } : stock;
      }),
    [portfolioStocks, stockValuations]
  );

  const dcfByStockId = useMemo(() => {
    const map = new Map<number, { hasDcfEntry: boolean; dcfHref: string }>();
    for (const stock of resolvedPortfolioStocks) {
      const symbol = stock.stock_symbol.toUpperCase();
      const dcfEntry = dcfBySymbol.get(symbol);
      const hasDcfEntry = Boolean(dcfEntry);
      map.set(stock.id, {
        hasDcfEntry,
        dcfHref: hasDcfEntry
          ? `/dcf?id=${dcfEntry!.id}`
          : `/dcf?symbol=${encodeURIComponent(symbol)}`,
      });
    }
    return map;
  }, [resolvedPortfolioStocks, dcfBySymbol]);

  const barBoxClass =
    'h-16 min-w-[8.5rem] px-4 inline-flex flex-col items-center justify-center rounded-lg border-2';
  const barButtonClass =
    'h-16 px-4 inline-flex items-center justify-center rounded-lg border-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const barIconButtonClass =
    'h-16 w-16 inline-flex items-center justify-center rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  const viewToggleClass = (active: boolean) =>
    `inline-flex h-full w-16 items-center justify-center transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
    }`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900/60 p-1">
        {PORTFOLIO_BOOKS.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className={`flex-1 min-w-[8rem] px-4 py-2.5 text-sm font-medium rounded-md text-center transition-colors ${
              activeSlug === item.slug
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {item.name}
          </Link>
        ))}
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`${barBoxClass} border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 text-center`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Total value
            </div>
            <div className="text-base font-semibold tabular-nums leading-tight text-gray-900 dark:text-gray-100">
              {totalPositionValueUsd != null
                ? formatPositionValue(totalPositionValueUsd, usdToGbpRate)
                : '—'}
            </div>
          </div>
          <div className={`${barBoxClass} text-center ${priceMoveBoxClass(totalDayChangePct)}`}>
            <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Today</div>
            <div className="text-base font-semibold tabular-nums leading-tight">
              {formatPriceMovePercent(totalDayChangePct)}
            </div>
          </div>
          <div className={`${barBoxClass} border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900/40 text-center`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Holdings
            </div>
            <div className="text-base font-semibold tabular-nums leading-tight text-gray-900 dark:text-gray-100">
              {resolvedPortfolioStocks.length}{' '}
              {resolvedPortfolioStocks.length === 1 ? 'stock' : 'stocks'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handlePortfolioReview()}
            disabled={loading || portfolioStocks.length === 0}
            className={`${barButtonClass} ${
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
            className={`${barButtonClass} ${
              portfolioTrafficLightCopied
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
            }`}
          >
            {portfolioTrafficLightCopied ? '✓ Copied!' : '🚦 Traffic Light Test'}
          </button>
          <button
            type="button"
            onClick={() => void handleReloadHoldings()}
            disabled={loading || reloadingEtoro}
            title={isTrading212 ? 'Reload holdings from Trading 212' : 'Reload holdings from eToro'}
            aria-label={isTrading212 ? 'Reload holdings from Trading 212' : 'Reload holdings from eToro'}
            className={barIconButtonClass}
          >
            {reloadingEtoro ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M15 9a6 6 0 1 1-1.76-4.24M15 3v4h-4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <div
            className="flex h-16 rounded-lg border-2 border-gray-300 dark:border-gray-600 overflow-hidden shrink-0"
            role="group"
            aria-label="Portfolio view"
          >
            <button
              type="button"
              onClick={() => handleViewModeChange('table')}
              title="Table view"
              aria-label="Table view"
              className={viewToggleClass(viewMode === 'table')}
            >
              <svg className="h-5 w-5" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path
                  d="M2 4.5h14M2 9h14M2 13.5h14M6 2v14M12 2v14"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleViewModeChange('cards')}
              title="Card view"
              aria-label="Card view"
              className={viewToggleClass(viewMode === 'cards')}
            >
              <svg className="h-5 w-5" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
                <rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
              </svg>
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
          Loading {activePortfolioName}…
        </div>
      ) : resolvedPortfolioStocks.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-600 dark:text-gray-400">
          No stocks in {activePortfolioName} yet.
        </div>
      ) : viewMode === 'table' ? (
        <PortfolioStockTable
          stocks={resolvedPortfolioStocks}
          usdToGbpRate={usdToGbpRate}
          dcfByStockId={dcfByStockId}
          saving={saving}
          trafficLightCopiedId={trafficLightCopiedId}
          watchlistStockIds={watchlistStockIds}
          addingWatchlistStockId={addingWatchlistStockId}
          onTrafficLight={(stock) => void handleTrafficLightTest(stock)}
          onAddToWatchlist={(stock) => void handleAddToWatchlist(stock)}
          onRemove={
            isLiveBroker ? undefined : (id) => void handleDeleteStock(id)
          }
          styleTagging={isEtoroLive}
          styleCategories={styleCategories}
          styleTagsBySymbol={styleTagsBySymbol}
          taggingSymbol={taggingSymbol}
          onStyleTagChange={(symbol, category) => void handleStyleTagChange(symbol, category)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resolvedPortfolioStocks.map((stock) => {
            const symbol = stock.stock_symbol.toUpperCase();
            const dcfEntry = dcfBySymbol.get(symbol);
            const hasDcfEntry = Boolean(dcfEntry);
            const dcfHref = hasDcfEntry
              ? `/dcf?id=${dcfEntry!.id}`
              : `/dcf?symbol=${encodeURIComponent(symbol)}`;

            return (
              <PortfolioStockCard
                key={stock.id}
                stock={stock}
                usdToGbpRate={usdToGbpRate}
                hasDcfEntry={hasDcfEntry}
                dcfHref={dcfHref}
                saving={saving}
                trafficLightCopied={trafficLightCopiedId === stock.id}
                onTrafficLight={() => void handleTrafficLightTest(stock)}
                onAddToWatchlist={() => void handleAddToWatchlist(stock)}
                onRemove={
                  isLiveBroker ? undefined : () => void handleDeleteStock(stock.id)
                }
                watchlistAdded={watchlistStockIds.has(stock.stock_id)}
                addingToWatchlist={addingWatchlistStockId === stock.stock_id}
                styleTagging={isEtoroLive}
                styleCategories={styleCategories}
                styleTag={styleTagsBySymbol[symbol] || null}
                tagging={taggingSymbol === symbol}
                onStyleTagChange={(category) => void handleStyleTagChange(symbol, category)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
