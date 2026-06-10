'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  formatChangePct,
  marketChangePctToColor,
  marketChangePctToTextColor,
} from '../../utils/marketHeatColor';
import { buildMarketSuggestionsPrompt } from '../../utils/buildMarketSuggestionsPrompt';
import { buildMarketStockValidationPrompt } from '../../utils/buildMarketStockValidationPrompt';
import { buildMarketTrendAnalysisPrompt } from '../../utils/buildMarketTrendAnalysisPrompt';
import {
  MARKET_PERIOD_OPTIONS,
  type MarketHeatmapPeriod,
} from '../../utils/marketPeriods';
import TickerText from '../../components/TickerText';

interface MarketStock {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface HeatmapMarket {
  id: number;
  name: string;
  display_order: number;
  stocks: MarketStock[];
  meanChangePct: number | null;
  cumulativeChangePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

interface MarketListItem {
  id: number;
  name: string;
  display_order: number;
  stocks: string[];
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-300 dark:border-gray-700 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export default function MarketsHeatmapPage() {
  const [heatmap, setHeatmap] = useState<HeatmapMarket[]>([]);
  const [marketList, setMarketList] = useState<MarketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [quoteWarning, setQuoteWarning] = useState<string | null>(null);
  const [cacheStale, setCacheStale] = useState(false);
  const [cacheOldestAt, setCacheOldestAt] = useState<string | null>(null);

  const [showNewMarketModal, setShowNewMarketModal] = useState(false);
  const [newMarketName, setNewMarketName] = useState('');

  const [addStockMarket, setAddStockMarket] = useState<MarketListItem | null>(null);
  const [newStockSymbol, setNewStockSymbol] = useState('');

  const [askAiCopied, setAskAiCopied] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [marketAskAiCopiedId, setMarketAskAiCopiedId] = useState<number | null>(null);
  const [heatmapAskAiCopiedId, setHeatmapAskAiCopiedId] = useState<number | null>(null);
  const [period, setPeriod] = useState<MarketHeatmapPeriod>('today');

  const loadHeatmap = useCallback(async (opts?: { refresh?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period });
      if (opts?.refresh) params.set('refresh', 'true');

      const [heatmapRes, marketsRes] = await Promise.all([
        fetch(`/api/markets/heatmap?${params}`),
        fetch('/api/markets'),
      ]);

      const heatmapJson = await heatmapRes.json();
      const marketsJson = await marketsRes.json();

      if (!heatmapRes.ok) {
        throw new Error(heatmapJson.hint || heatmapJson.error || 'Failed to load heatmap');
      }
      if (!marketsRes.ok) {
        throw new Error(marketsJson.hint || marketsJson.error || 'Failed to load markets');
      }

      setHeatmap(heatmapJson.markets || []);
      setFetchedAt(heatmapJson.fetchedAt || null);
      setQuoteWarning(heatmapJson.quoteWarning || null);
      setCacheStale(Boolean(heatmapJson.cacheStale));
      setCacheOldestAt(heatmapJson.cacheOldestAt || null);
      setMarketList(marketsJson.markets || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void loadHeatmap();
  }, [loadHeatmap]);

  const handleCreateMarket = async () => {
    const trimmedName = newMarketName.trim();
    if (!trimmedName) {
      setError('Market name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create market');
      }
      setShowNewMarketModal(false);
      setNewMarketName('');
      await loadHeatmap();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create market');
    } finally {
      setSaving(false);
    }
  };

  const handleAddStock = async () => {
    if (!addStockMarket) return;
    const symbol = newStockSymbol.trim().toUpperCase();
    if (!symbol) {
      setError('Stock symbol is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${addStockMarket.id}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to add stock');
      }
      setAddStockMarket(null);
      setNewStockSymbol('');
      await loadHeatmap();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add stock');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStock = async (marketId: number, symbol: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/markets/${marketId}/stocks?symbol=${encodeURIComponent(symbol)}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to remove stock');
      }
      await loadHeatmap();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove stock');
    } finally {
      setSaving(false);
    }
  };

  const handleAskAi = async () => {
    try {
      setAskAiCopied(true);
      setAiMessage(null);
      const prompt = buildMarketSuggestionsPrompt(marketList);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTimeout(() => setAskAiCopied(false), 3000);
      } else {
        setAiMessage('Could not access clipboard.');
        setAskAiCopied(false);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setAskAiCopied(false);
    }
  };

  const handleMarketAskAi = async (market: MarketListItem) => {
    try {
      setMarketAskAiCopiedId(market.id);
      setAiMessage(null);
      const prompt = buildMarketStockValidationPrompt(market);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTimeout(() => setMarketAskAiCopiedId(null), 3000);
      } else {
        setAiMessage('Could not access clipboard.');
        setMarketAskAiCopiedId(null);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setMarketAskAiCopiedId(null);
    }
  };

  const handleHeatmapAskAi = async (market: HeatmapMarket) => {
    try {
      setHeatmapAskAiCopiedId(market.id);
      setAiMessage(null);
      const prompt = buildMarketTrendAnalysisPrompt(market);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTimeout(() => setHeatmapAskAiCopiedId(null), 3000);
      } else {
        setAiMessage('Could not access clipboard.');
        setHeatmapAskAiCopiedId(null);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setHeatmapAskAiCopiedId(null);
    }
  };

  const sortedHeatmap = [...heatmap].sort((a, b) => {
    const aPct = a.meanChangePct;
    const bPct = b.meanChangePct;
    if (aPct === null && bPct === null) return a.name.localeCompare(b.name);
    if (aPct === null) return 1;
    if (bPct === null) return -1;
    if (bPct !== aPct) return bPct - aPct;
    return a.name.localeCompare(b.name);
  });

  const footerTickerParts = [
    cacheStale && !loading
      ? `Stale cache${
          cacheOldestAt
            ? ` — oldest update ${new Date(cacheOldestAt).toLocaleString()}`
            : ''
        }`
      : null,
    quoteWarning && !loading ? quoteWarning : null,
    error,
  ].filter((part): part is string => Boolean(part));
  const footerTickerText = footerTickerParts.join('   •   ');

  return (
    <div className="h-[calc(100vh-120px)] min-h-0 bg-white dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden">
      <div className="flex flex-col lg:flex-row h-full min-h-0">
        <main className="flex-1 flex flex-col min-h-0 min-w-0 p-4 lg:p-6">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3 shrink-0">
            {MARKET_PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPeriod(opt.id)}
                disabled={loading}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  period === opt.id
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && heatmap.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">Loading heatmap…</div>
          ) : heatmap.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <p className="text-lg font-medium mb-2">No markets yet</p>
              <p className="text-sm max-w-md mb-4">
                Add a market from the sidebar, then attach stocks with the + button on each row.
              </p>
              <button
                type="button"
                onClick={() => setShowNewMarketModal(true)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700"
              >
                + New market
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {sortedHeatmap.map((market) => {
                const pct = market.meanChangePct ?? 0;
                const bg = marketChangePctToColor(pct);
                const fg = marketChangePctToTextColor(pct);
                const directionArrow =
                  market.direction === 'up' ? '↑' : market.direction === 'down' ? '↓' : '→';

                return (
                  <div
                    key={market.id}
                    className="rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden shadow-sm min-h-[160px] flex flex-col"
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h2 className="font-bold text-lg leading-tight">{market.name}</h2>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-2xl font-bold tabular-nums leading-none">{directionArrow}</span>
                          <button
                            type="button"
                            onClick={() => void handleHeatmapAskAi(market)}
                            title="Ask AI why this sector is moving"
                            className={`text-[10px] px-1.5 py-1 rounded font-medium border transition-colors ${
                              heatmapAskAiCopiedId === market.id
                                ? 'border-green-600 bg-green-600/20'
                                : 'border-current/40 hover:bg-black/10'
                            }`}
                          >
                            {heatmapAskAiCopiedId === market.id ? '✓' : 'AI'}
                          </button>
                        </div>
                      </div>
                      <div className="text-3xl font-bold tabular-nums mb-3">
                        {market.meanChangePct !== null ? formatChangePct(market.meanChangePct) : '—'}
                      </div>
                      <div className="mt-auto space-y-1 text-sm opacity-90">
                        {market.stocks.length === 0 ? (
                          <p className="opacity-75 italic">No stocks yet</p>
                        ) : (
                          market.stocks.map((stock) => (
                            <div key={stock.symbol} className="flex justify-between gap-2">
                              <span className="font-medium">{stock.symbol}</span>
                              <span className="tabular-nums">
                                {stock.changePercent !== null
                                  ? formatChangePct(stock.changePercent)
                                  : '—'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>

          <div className="shrink-0 pt-3 mt-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3 min-w-0">
            {footerTickerText ? (
              <TickerText
                className={`flex-1 min-w-0 text-xs ${
                  error && !quoteWarning && !cacheStale
                    ? 'text-red-700 dark:text-red-300'
                    : 'text-amber-800 dark:text-amber-200'
                }`}
                text={footerTickerText}
              />
            ) : (
              <div className="flex-1 min-w-0" />
            )}
            <div className="flex items-center justify-end gap-x-3 shrink-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: '#b91c1c', color: '#fff' }}>
                  ≤ −5%
                </span>
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: '#eab308', color: '#111' }}>
                  ~0%
                </span>
                <span className="px-2 py-0.5 rounded" style={{ backgroundColor: '#15803d', color: '#fff' }}>
                  ≥ +5%
                </span>
              </div>
              {fetchedAt && !loading && (
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(fetchedAt).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                onClick={() => void loadHeatmap({ refresh: true })}
                disabled={loading}
                className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
        </main>

        <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col min-h-0 h-full border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between p-4 lg:px-5 lg:pt-5 pb-3 shrink-0">
            <h2 className="text-lg font-semibold">Markets</h2>
            <button
              type="button"
              onClick={() => {
                setNewMarketName('');
                setShowNewMarketModal(true);
              }}
              title="Add market"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5">
          {marketList.length === 0 ? (
            <p className="text-sm text-gray-500">No markets yet. Tap + to add one.</p>
          ) : (
            <ul className="space-y-2 pb-2">
              {marketList.map((market) => (
                <li
                  key={market.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-medium truncate flex-1">{market.name}</p>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleMarketAskAi(market)}
                        title="Ask AI to validate stocks"
                        className={`text-[10px] px-1.5 py-1 rounded font-medium border transition-colors ${
                          marketAskAiCopiedId === market.id
                            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                            : 'border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                        }`}
                      >
                        {marketAskAiCopiedId === market.id ? '✓' : 'AI'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewStockSymbol('');
                          setAddStockMarket(market);
                        }}
                        title="Add stock"
                        className="w-7 h-7 flex items-center justify-center rounded-full border border-green-500 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {market.stocks.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {market.stocks.map((sym) => (
                        <span
                          key={sym}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-xs font-medium"
                        >
                          {sym}
                          <button
                            type="button"
                            onClick={() => void handleRemoveStock(market.id, sym)}
                            className="text-gray-400 hover:text-red-500"
                            aria-label={`Remove ${sym}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">No stocks — tap + to add</p>
                  )}
                </li>
              ))}
            </ul>
          )}
          </div>

          <div className="shrink-0 p-4 lg:p-5 pt-3 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={() => void handleAskAi()}
              disabled={askAiCopied}
              className={`w-full px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                askAiCopied
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
              }`}
            >
              {askAiCopied ? '✓ Copied!' : '🤖 Ask AI — missing sectors?'}
            </button>
            {aiMessage && (
              <p className="text-xs text-green-600 dark:text-green-400 leading-relaxed mt-2">{aiMessage}</p>
            )}
          </div>
        </aside>
      </div>

      {showNewMarketModal && (
        <Modal title="New market" onClose={() => setShowNewMarketModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Market name
              </label>
              <input
                type="text"
                value={newMarketName}
                onChange={(e) => setNewMarketName(e.target.value)}
                placeholder="e.g. Big Tech"
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleCreateMarket();
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Add stocks after creating the market using the + button on each row.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleCreateMarket()}
                disabled={saving || !newMarketName.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
              >
                {saving ? 'Creating…' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewMarketModal(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {addStockMarket && (
        <Modal
          title={`Add stock — ${addStockMarket.name}`}
          onClose={() => setAddStockMarket(null)}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={newStockSymbol}
                onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. AAPL"
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg uppercase text-gray-900 dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddStock();
                }}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleAddStock()}
                disabled={saving || !newStockSymbol.trim()}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
              >
                {saving ? 'Adding…' : 'Add stock'}
              </button>
              <button
                type="button"
                onClick={() => setAddStockMarket(null)}
                className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
