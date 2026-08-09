'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  formatChangePct,
  marketChangePctToColor,
  marketChangePctToTextColor,
} from '../../utils/marketHeatColor';
import { buildMarketSuggestionsPrompt } from '../../utils/buildMarketSuggestionsPrompt';
import { buildMarketStockValidationPrompt } from '../../utils/buildMarketStockValidationPrompt';
import { buildMarketTrendAnalysisPrompt } from '../../utils/buildMarketTrendAnalysisPrompt';
import { buildMarketMoneyFlowPrompt } from '../../utils/buildMarketMoneyFlowPrompt';
import {
  MARKET_PERIOD_OPTIONS,
  type MarketHeatmapPeriod,
} from '../../utils/marketPeriods';
import {
  DEFAULT_SECTOR_REGION,
  SECTOR_REGIONS,
  getSectorRegion,
  type SectorRegionCode,
} from '../../config/sectorRegions';
import TickerText from '../../components/TickerText';
import { simplyWallStStockUrl } from '../../utils/simplyWallStStockUrl';
import { yahooFinanceQuoteUrl } from '../../utils/yahooFinanceQuoteUrl';

interface MarketStock {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

type SectorHeatmapView = 'index' | 'stocks';

interface HeatmapMarket {
  id: number;
  name: string;
  display_order: number;
  index_symbol?: string | null;
  index_is_proxy?: boolean;
  view?: SectorHeatmapView;
  stocks: MarketStock[];
  meanChangePct: number | null;
  cumulativeChangePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

interface MarketListItem {
  id: number;
  name: string;
  display_order: number;
  index_symbol: string | null;
  index_is_proxy?: boolean;
  changePercent?: number | null;
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
  const router = useRouter();
  const [heatmap, setHeatmap] = useState<HeatmapMarket[]>([]);
  const [marketList, setMarketList] = useState<MarketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [quoteWarning, setQuoteWarning] = useState<string | null>(null);
  const [cacheStale, setCacheStale] = useState(false);
  const [cacheOldestAt, setCacheOldestAt] = useState<string | null>(null);
  const [liveAvailable, setLiveAvailable] = useState(false);

  const [showNewMarketModal, setShowNewMarketModal] = useState(false);
  const [newMarketName, setNewMarketName] = useState('');

  const [addStockMarket, setAddStockMarket] = useState<MarketListItem | null>(null);
  const [newStockSymbol, setNewStockSymbol] = useState('');
  const [editIndexMarket, setEditIndexMarket] = useState<MarketListItem | null>(null);
  const [editIndexSymbol, setEditIndexSymbol] = useState('');
  const [newMarketIndexSymbol, setNewMarketIndexSymbol] = useState('');

  const [askAiCopied, setAskAiCopied] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [marketAskAiCopiedId, setMarketAskAiCopiedId] = useState<number | null>(null);
  const [heatmapAskAiCopiedId, setHeatmapAskAiCopiedId] = useState<number | null>(null);
  const [heatmapAskAiCopied, setHeatmapAskAiCopied] = useState(false);
  const [footerAskAiCopied, setFooterAskAiCopied] = useState(false);
  const [period, setPeriod] = useState<MarketHeatmapPeriod>('1w');
  const [view, setView] = useState<SectorHeatmapView>('index');
  const [region, setRegion] = useState<SectorRegionCode>(DEFAULT_SECTOR_REGION);
  const [hoveredRegion, setHoveredRegion] = useState<SectorRegionCode | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const loadSeq = useRef(0);
  const activeRegionMeta = getSectorRegion(region);
  const hoverRegionMeta = hoveredRegion ? getSectorRegion(hoveredRegion) : null;

  const loadHeatmap = useCallback(async (opts?: { live?: boolean }) => {
    const seq = ++loadSeq.current;
    const activeRegion = region;
    const activePeriod = period;
    const effectiveView = activeRegion === 'us' ? view : 'index';

    if (opts?.live) {
      setLiveLoading(true);
    } else {
      setLoading(true);
      // Keep prior cards visible while refetching so country/period switches
      // do not blank the page during slow EOD fills.
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        period: activePeriod,
        view: effectiveView,
        region: activeRegion,
      });
      if (opts?.live) params.set('live', 'true');

      const fetchOpts: RequestInit = { cache: 'no-store', credentials: 'same-origin' };
      const [heatmapRes, marketsRes] = await Promise.all([
        fetch(`/api/markets/heatmap?${params}`, fetchOpts),
        fetch(`/api/markets?group=sector`, fetchOpts),
      ]);

      if (seq !== loadSeq.current) return;

      const heatmapJson = await heatmapRes.json();
      const marketsJson = await marketsRes.json();

      if (seq !== loadSeq.current) return;

      if (!heatmapRes.ok) {
        throw new Error(heatmapJson.hint || heatmapJson.error || 'Failed to load heatmap');
      }
      if (!marketsRes.ok) {
        throw new Error(marketsJson.hint || marketsJson.error || 'Failed to load markets');
      }

      let markets: HeatmapMarket[] = heatmapJson.markets || [];
      const stocksById = new Map<number, string[]>(
        ((marketsJson.markets || []) as MarketListItem[]).map((m) => [m.id, m.stocks || []])
      );

      // Auto-live only when everything is empty (partial cache should still render).
      const emptyCards = markets.filter(
        (m) =>
          m.meanChangePct === null ||
          !m.stocks?.length ||
          m.stocks.every((s) => s.changePercent == null)
      ).length;
      const missingQuotes =
        !opts?.live && markets.length > 0 && emptyCards === markets.length;

      if (missingQuotes) {
        const liveParams = new URLSearchParams({
          period: activePeriod,
          view: effectiveView,
          region: activeRegion,
          live: 'true',
        });
        const liveRes = await fetch(`/api/markets/heatmap?${liveParams}`, fetchOpts);
        const liveJson = await liveRes.json();
        if (seq !== loadSeq.current) return;
        if (liveRes.ok) {
          markets = liveJson.markets || markets;
          setFetchedAt(liveJson.fetchedAt || heatmapJson.fetchedAt || null);
          setQuoteWarning(liveJson.quoteWarning || null);
          setCacheStale(Boolean(liveJson.cacheStale));
          setCacheOldestAt(liveJson.cacheOldestAt || null);
          setLiveAvailable(Boolean(liveJson.liveAvailable));
        } else {
          setFetchedAt(heatmapJson.fetchedAt || null);
          setQuoteWarning(heatmapJson.quoteWarning || liveJson.error || null);
          setCacheStale(Boolean(heatmapJson.cacheStale));
          setCacheOldestAt(heatmapJson.cacheOldestAt || null);
          setLiveAvailable(Boolean(heatmapJson.liveAvailable));
        }
      } else {
        setFetchedAt(heatmapJson.fetchedAt || null);
        setQuoteWarning(heatmapJson.quoteWarning || null);
        setCacheStale(Boolean(heatmapJson.cacheStale));
        setCacheOldestAt(heatmapJson.cacheOldestAt || null);
        setLiveAvailable(Boolean(heatmapJson.liveAvailable));
      }

      if (seq !== loadSeq.current) return;

      // Sidebar mirrors the heatmap lens (region ETF + return), not the US-only markets table.
      const list: MarketListItem[] = [...markets]
        .sort(
          (a, b) =>
            a.display_order - b.display_order || a.name.localeCompare(b.name)
        )
        .map((m) => ({
          id: m.id,
          name: m.name,
          display_order: m.display_order,
          index_symbol: m.index_symbol ?? null,
          index_is_proxy: Boolean(m.index_is_proxy),
          changePercent: m.meanChangePct,
          stocks: stocksById.get(m.id) ?? [],
        }));

      setHeatmap(markets);
      setMarketList(list);
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setHeatmap([]);
      setMarketList([]);
      setError(e instanceof Error ? e.message : 'Failed to load markets');
    } finally {
      if (seq !== loadSeq.current) return;
      setLoading(false);
      setLiveLoading(false);
    }
  }, [period, view, region]);

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
        body: JSON.stringify({
          name: trimmedName,
          index_symbol: newMarketIndexSymbol.trim() || null,
          market_group: 'sector',
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create market');
      }
      setShowNewMarketModal(false);
      setNewMarketName('');
      setNewMarketIndexSymbol('');
      await loadHeatmap();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create market');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveIndexSymbol = async () => {
    if (!editIndexMarket) return;
    const symbol = editIndexSymbol.trim().toUpperCase();

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/markets/${editIndexMarket.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index_symbol: symbol || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update index');
      }
      setEditIndexMarket(null);
      setEditIndexSymbol('');
      await loadHeatmap();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update index');
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
      const prompt = buildMarketTrendAnalysisPrompt(market, period, {
        regionLabel: `${activeRegionMeta.icon} ${activeRegionMeta.region}`,
        view: region === 'us' ? view : 'index',
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setAiMessage(`Copied ${market.name} prompt — paste into AI for trend, money flow, and 3 stocks to research.`);
        setTimeout(() => {
          setHeatmapAskAiCopiedId(null);
          setAiMessage(null);
        }, 3500);
      } else {
        setAiMessage('Could not access clipboard.');
        setHeatmapAskAiCopiedId(null);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setHeatmapAskAiCopiedId(null);
    }
  };

  const handleFooterAskAi = async () => {
    try {
      setFooterAskAiCopied(true);
      setAiMessage(null);
      const prompt = buildMarketMoneyFlowPrompt(heatmap, period, fetchedAt, {
        regionLabel: `${activeRegionMeta.icon} ${activeRegionMeta.region}`,
        view: region === 'us' ? view : 'index',
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTimeout(() => setFooterAskAiCopied(false), 3000);
      } else {
        setAiMessage('Could not access clipboard.');
        setFooterAskAiCopied(false);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setFooterAskAiCopied(false);
    }
  };

  const handleHeatmapValidateAskAi = async () => {
    try {
      setHeatmapAskAiCopied(true);
      setAiMessage(null);
      const prompt = buildMarketMoneyFlowPrompt(heatmap, period, fetchedAt, {
        regionLabel: `${activeRegionMeta.icon} ${activeRegionMeta.region}`,
        view: region === 'us' ? view : 'index',
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setAiMessage('Prompt copied — paste into ChatGPT / Claude to validate & find invest / avoid themes.');
        setTimeout(() => {
          setHeatmapAskAiCopied(false);
          setAiMessage(null);
        }, 4000);
      } else {
        setAiMessage('Could not access clipboard.');
        setHeatmapAskAiCopied(false);
      }
    } catch (e) {
      setAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setHeatmapAskAiCopied(false);
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
          <div className="relative flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-4 shrink-0">
            <div className="relative flex flex-wrap items-center justify-center gap-1">
              {SECTOR_REGIONS.map((r) => {
                const selected = region === r.code;
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => {
                      if (r.code === region) return;
                      setRegion(r.code);
                      if (r.code !== 'us') setView('index');
                    }}
                    onMouseEnter={() => setHoveredRegion(r.code)}
                    onMouseLeave={() => setHoveredRegion(null)}
                    onFocus={() => setHoveredRegion(r.code)}
                    onBlur={() => setHoveredRegion(null)}
                    aria-pressed={selected}
                    aria-label={`${r.region}: ${r.blurb}`}
                    title={r.region}
                    className={`w-9 h-9 flex items-center justify-center rounded-lg border text-lg leading-none transition-colors ${
                      selected
                        ? 'bg-emerald-700 border-emerald-700 text-white shadow-sm'
                        : 'border-gray-300 dark:border-gray-600 hover:border-emerald-500 bg-white dark:bg-gray-800'
                    }`}
                  >
                    <span aria-hidden>{r.icon}</span>
                  </button>
                );
              })}
              {hoverRegionMeta && (
                <div
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-20 px-3 py-2 rounded-lg border shadow-lg bg-gray-900 text-white border-gray-700 max-w-xs text-center"
                  role="status"
                >
                  <p className="text-sm font-semibold">
                    {hoverRegionMeta.icon} {hoverRegionMeta.region}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">{hoverRegionMeta.blurb}</p>
                </div>
              )}
            </div>

            <span className="hidden sm:inline-block w-px h-6 bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden />

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {(
                [
                  ['index', 'Index'],
                  ['stocks', 'Stocks'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  disabled={loading || liveLoading || (region !== 'us' && id === 'stocks')}
                  title={
                    region !== 'us' && id === 'stocks'
                      ? 'Stocks view uses your US watchlist names — switch to US for constituents'
                      : undefined
                  }
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    (region === 'us' ? view : 'index') === id
                      ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-gray-900'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-500 disabled:opacity-40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <span className="hidden sm:inline-block w-px h-6 bg-gray-300 dark:bg-gray-600 shrink-0" aria-hidden />

            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {MARKET_PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPeriod(opt.id)}
                  disabled={loading || liveLoading}
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
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
          {(loading || liveLoading) && heatmap.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-gray-500">
              Loading {activeRegionMeta.region} sectors…
            </div>
          ) : heatmap.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <p className="text-lg font-medium mb-2">No markets yet</p>
              <p className="text-sm max-w-md mb-4">
                Add a sector from the sidebar, set a US index ETF, then pick a country icon to view that region’s ETF proxies.
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
            <>
              {(loading || liveLoading) && (
                <div className="mb-2 text-xs text-gray-500 text-center">
                  Updating {activeRegionMeta.region}…
                </div>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
              {sortedHeatmap.map((market) => {
                const pct = market.meanChangePct ?? 0;
                const bg = marketChangePctToColor(pct);
                const fg = marketChangePctToTextColor(pct);
                const directionArrow =
                  market.direction === 'up' ? '↑' : market.direction === 'down' ? '↓' : '→';
                const showIndex = view === 'index' || region !== 'us';
                const chartSymbol =
                  market.index_symbol?.trim() ||
                  (showIndex ? market.stocks[0]?.symbol : null) ||
                  null;

                return (
                  <div
                    key={market.id}
                    role={chartSymbol ? 'link' : undefined}
                    tabIndex={chartSymbol ? 0 : undefined}
                    title={
                      chartSymbol
                        ? `Open ${chartSymbol} in Stock search`
                        : undefined
                    }
                    onClick={() => {
                      if (!chartSymbol) return;
                      router.push(
                        `/research/stock-search?symbol=${encodeURIComponent(chartSymbol)}&from=sectors`
                      );
                    }}
                    onKeyDown={(e) => {
                      if (!chartSymbol) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        router.push(
                          `/research/stock-search?symbol=${encodeURIComponent(chartSymbol)}&from=sectors`
                        );
                      }
                    }}
                    className={`rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden shadow-sm min-h-[160px] flex flex-col ${
                      chartSymbol ? 'cursor-pointer hover:brightness-[1.03]' : ''
                    }`}
                    style={{ backgroundColor: bg, color: fg }}
                  >
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <h2 className="font-bold text-lg leading-tight">{market.name}</h2>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {activeRegionMeta.icon} {activeRegionMeta.label}
                            {market.index_is_proxy ? ' · country proxy' : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-2xl font-bold tabular-nums leading-none">{directionArrow}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleHeatmapAskAi(market);
                            }}
                            title="Ask AI: explain trend, money flow, and 3 stocks to research"
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
                          <p className="opacity-75 italic">
                            {showIndex ? 'No index set for this region' : 'No stocks yet'}
                          </p>
                        ) : (
                          market.stocks.map((stock) => (
                            <div key={stock.symbol} className="flex justify-between gap-2">
                              <a
                                href={
                                  showIndex
                                    ? yahooFinanceQuoteUrl(stock.symbol)
                                    : simplyWallStStockUrl(stock.symbol)
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="font-medium underline-offset-2 hover:underline"
                                style={{ color: 'inherit' }}
                              >
                                {showIndex ? `ETF · ${stock.symbol}` : stock.symbol}
                              </a>
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
            </>
          )}

          {heatmap.length > 0 && (
            <div className="mt-4 mb-2 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => void handleHeatmapValidateAskAi()}
                disabled={loading || liveLoading || heatmapAskAiCopied}
                className={`w-full max-w-xl px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors ${
                  heatmapAskAiCopied
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                } disabled:opacity-50`}
              >
                {heatmapAskAiCopied
                  ? '✓ Prompt copied'
                  : '🤖 Ask AI — validate heatmap · follow money · avoid list'}
              </button>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 text-center max-w-xl">
                Copies the full {activeRegionMeta.region} heatmap ({MARKET_PERIOD_OPTIONS.find((o) => o.id === period)?.label}) for AI: validate findings, where Wall Street money is going, and what to avoid.
              </p>
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
              {fetchedAt && !loading && !liveLoading && (
                <p className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(fetchedAt).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                onClick={() => void loadHeatmap()}
                disabled={loading || liveLoading}
                title="Reload from cache"
                aria-label="Reload from cache"
                className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => void loadHeatmap({ live: true })}
                disabled={loading || liveLoading || !liveAvailable}
                title={
                  liveAvailable
                    ? 'Force-fetch live data for this period'
                    : 'Cache is less than 24 hours old'
                }
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {liveLoading ? 'Live…' : 'Live'}
              </button>
              <button
                type="button"
                onClick={() => void handleFooterAskAi()}
                disabled={loading || liveLoading || heatmap.length === 0 || footerAskAiCopied}
                title="Ask AI where Wall Street money is moving"
                className={`text-xs px-2 py-1.5 rounded-lg font-medium border transition-colors ${
                  footerAskAiCopied
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-violet-300 dark:border-violet-600 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {footerAskAiCopied ? '✓' : 'AI'}
              </button>
            </div>
          </div>
        </main>

        <aside className="w-full lg:w-80 xl:w-96 shrink-0 flex flex-col min-h-0 h-full border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between p-4 lg:px-5 lg:pt-5 pb-3 shrink-0">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {activeRegionMeta.icon} {activeRegionMeta.region}
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                Sectors · ETF lens
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setNewMarketName('');
                setShowNewMarketModal(true);
              }}
              title="Add market"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 shadow-sm shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-5">
          {loading || liveLoading ? (
            <p className="text-sm text-gray-500">Loading {activeRegionMeta.region}…</p>
          ) : marketList.length === 0 ? (
            <p className="text-sm text-gray-500">No markets yet. Tap + to add one.</p>
          ) : (
            <ul className="space-y-2 pb-2">
              {marketList.map((market) => (
                <li
                  key={market.id}
                  className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{market.name}</p>
                      <p
                        className={`text-sm font-semibold tabular-nums ${
                          market.changePercent == null
                            ? 'text-gray-400'
                            : market.changePercent > 0
                              ? 'text-green-600 dark:text-green-400'
                              : market.changePercent < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-500'
                        }`}
                      >
                        {market.changePercent != null
                          ? formatChangePct(market.changePercent)
                          : '—'}
                      </p>
                    </div>
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
                      {region === 'us' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditIndexSymbol(market.index_symbol || '');
                            setEditIndexMarket(market);
                          }}
                          title="Set US index ETF"
                          className="w-7 h-7 flex items-center justify-center rounded-full border border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-[10px] font-bold"
                        >
                          Ix
                        </button>
                      )}
                      {region === 'us' && (
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
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {activeRegionMeta.label} ETF:{' '}
                    {market.index_symbol ? (
                      <>
                        <a
                          href={yahooFinanceQuoteUrl(market.index_symbol)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`Open ${market.index_symbol} on Yahoo Finance`}
                          className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          {market.index_symbol}
                        </a>
                        {market.index_is_proxy ? (
                          <span className="text-gray-400"> · proxy</span>
                        ) : null}
                        {region === 'us' && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditIndexSymbol(market.index_symbol || '');
                              setEditIndexMarket(market);
                            }}
                            title="Edit US index ETF"
                            className="ml-1.5 text-[10px] text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            edit
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="italic text-gray-400">not set</span>
                    )}
                  </p>
                  {region === 'us' ? (
                    market.stocks.length > 0 ? (
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
                    )
                  ) : (
                    <p className="text-[11px] text-gray-400">
                      Showing {activeRegionMeta.region} index returns
                    </p>
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
        <Modal
          title="New sector"
          onClose={() => {
            setShowNewMarketModal(false);
            setNewMarketIndexSymbol('');
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Sector name
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
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                US Index ETF (optional)
              </label>
              <input
                type="text"
                value={newMarketIndexSymbol}
                onChange={(e) => setNewMarketIndexSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. XLK"
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg uppercase text-gray-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-gray-500">
              US ETF is the default Index view. Other countries use region ETF mappings from the database.
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
                onClick={() => {
                  setShowNewMarketModal(false);
                  setNewMarketIndexSymbol('');
                }}
                className="flex-1 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 px-4 py-2 rounded-lg font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {editIndexMarket && (
        <Modal
          title={`Index ETF — ${editIndexMarket.name}`}
          onClose={() => {
            setEditIndexMarket(null);
            setEditIndexSymbol('');
          }}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Symbol
              </label>
              <input
                type="text"
                value={editIndexSymbol}
                onChange={(e) => setEditIndexSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. XLK"
                className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg uppercase text-gray-900 dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSaveIndexSymbol();
                }}
              />
            </div>
            <p className="text-xs text-gray-500">
              Used for Index view heat color. Leave blank to clear.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => void handleSaveIndexSymbol()}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditIndexMarket(null);
                  setEditIndexSymbol('');
                }}
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
