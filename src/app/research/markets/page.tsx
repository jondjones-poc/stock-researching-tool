'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MARKET_FLOW_PERIOD_LABELS,
  MARKET_FLOW_PERIODS,
  type MarketFlowPeriod,
} from '@/app/config/marketFlow';
import {
  marketChangePctToColor,
  marketChangePctToTextColor,
} from '@/app/utils/marketHeatColor';
import { buildMarketFlowAskAiPrompt } from '@/app/utils/buildMarketFlowAskAiPrompt';
import { useAuth } from '@/app/contexts/AuthContext';
import {
  capRelativeSpread,
  formatPct,
  lcScSpreadTooltip,
  type MarketFlowDashboardPayload,
  type MarketFlowView,
} from '@/app/utils/marketFlowFormat';

type SortOrder = 'best' | 'worst' | 'market';

const CHART_COLORS = [
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#65a30d',
  '#ea580c',
  '#db2777',
  '#4b5563',
];

export default function MarketFlowDashboardPage() {
  const { isAdmin } = useAuth();
  const [period, setPeriod] = useState<MarketFlowPeriod>('1m');
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<MarketFlowView>('vs');
  const [data, setData] = useState<MarketFlowDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('best');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [askAiCopiedKey, setAskAiCopiedKey] = useState<string | null>(null);
  const [askAiMessage, setAskAiMessage] = useState<string | null>(null);
  const [cardsVisible, setCardsVisible] = useState(true);
  const viewTransitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [globalCap, setGlobalCap] = useState<'large' | 'small'>('large');
  const [globalPeriod, setGlobalPeriod] = useState<MarketFlowPeriod>('1y');
  const [hiddenChartKeys, setHiddenChartKeys] = useState<string[]>([]);
  const [globalChart, setGlobalChart] = useState<{
    series: Array<{ key: string; name: string; symbol: string }>;
    benchmark: { key: string; name: string; symbol: string } | null;
    chart: Array<Record<string, string | number>>;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market-flow?period=${period}&view=${view}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Failed to load');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, view]);

  const loadGlobal = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/market-flow/global-chart?cap=${globalCap}&period=${globalPeriod}`
      );
      const json = await res.json();
      if (res.ok) {
        setGlobalChart(json);
        setHiddenChartKeys([]);
      }
    } catch {
      // non-blocking
    }
  }, [globalCap, globalPeriod]);

  const chartToggleItems = useMemo(() => {
    if (!globalChart) return [];
    const items = globalChart.series.map((series) => ({
      key: series.key,
      label: `${series.name} (${series.symbol})`,
      isBenchmark: false,
    }));
    if (globalChart.benchmark) {
      items.push({
        key: globalChart.benchmark.key,
        label: `vs SPY (${globalChart.benchmark.symbol})`,
        isBenchmark: true,
      });
    }
    return items;
  }, [globalChart]);

  const toggleChartSeries = (key: string) => {
    setHiddenChartKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]
    );
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/market-flow/refresh', { method: 'POST' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Refresh failed');
      await load();
      await loadGlobal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  }, [load, loadGlobal]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGlobal();
  }, [loadGlobal]);

  useEffect(() => {
    return () => {
      if (viewTransitionTimer.current) clearTimeout(viewTransitionTimer.current);
    };
  }, []);

  const handleViewChange = (nextView: MarketFlowView) => {
    if (nextView === view) return;
    if (viewTransitionTimer.current) clearTimeout(viewTransitionTimer.current);
    setCardsVisible(false);
    viewTransitionTimer.current = setTimeout(() => {
      setView(nextView);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setCardsVisible(true));
      });
    }, 180);
  };

  const summaryCards = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: 'Best market',
        value: data.summary.bestMarket
          ? `${data.summary.bestMarket.name} (${formatPct(data.summary.bestMarket.returnPct)})`
          : '—',
      },
      {
        label: 'Worst market',
        value: data.summary.worstMarket
          ? `${data.summary.worstMarket.name} (${formatPct(data.summary.worstMarket.returnPct)})`
          : '—',
      },
      {
        label: 'Strongest large-cap',
        value: data.summary.strongestLarge
          ? `${data.summary.strongestLarge.name} (${formatPct(data.summary.strongestLarge.returnPct)})`
          : '—',
      },
      {
        label: 'Strongest small-cap',
        value: data.summary.strongestSmall
          ? `${data.summary.strongestSmall.name} (${formatPct(data.summary.strongestSmall.returnPct)})`
          : '—',
      },
    ];
  }, [data]);

  const fundCards = useMemo(() => {
    if (!data) return [];

    const context = {
      period,
      lastUpdated: data.lastUpdated,
      strongestLarge: data.summary.strongestLarge
        ? `${data.summary.strongestLarge.name} (${formatPct(data.summary.strongestLarge.returnPct)})`
        : null,
      strongestSmall: data.summary.strongestSmall
        ? `${data.summary.strongestSmall.name} (${formatPct(data.summary.strongestSmall.returnPct)})`
        : null,
      bestMarket: data.summary.bestMarket
        ? `${data.summary.bestMarket.name} (${formatPct(data.summary.bestMarket.returnPct)})`
        : null,
      worstMarket: data.summary.worstMarket
        ? `${data.summary.worstMarket.name} (${formatPct(data.summary.worstMarket.returnPct)})`
        : null,
    };

    const spyReturn = data.benchmark.returnPct;

    const cards = data.rows.flatMap((row) => {
      const caps =
        view === 'vs'
          ? (['large', 'small'] as const)
          : ([view] as Array<'large' | 'small'>);

      return caps.map((capType) => {
        const fund = row[capType];
        const peerType = capType === 'large' ? 'small' : 'large';
        const peer = row[peerType];
        const spread = row.spread[period];
        return {
          slug: row.slug,
          market: row.name,
          region: row.region,
          capType,
          symbol: fund.symbol,
          fundName: fund.name,
          returnPct: fund.returns[period],
          relativeToSpy: fund.relativeToSpy,
          spyReturn,
          spread,
          price: fund.price,
          leader: row.leader[period] === capType,
          holdings: fund.holdings,
          peer: {
            symbol: peer.symbol,
            fundName: peer.name,
            returnPct: peer.returns[period],
            relativeToSpy: peer.relativeToSpy,
            leader: row.leader[period] === peerType,
          },
          context,
        };
      });
    });

    return cards.sort((a, b) => {
      if (sortOrder === 'market') {
        const market = a.market.localeCompare(b.market);
        if (market !== 0) return market;
        return a.capType === 'large' ? -1 : 1;
      }

      const aValue = a.returnPct;
      const bValue = b.returnPct;
      if (aValue == null && bValue == null) return a.market.localeCompare(b.market);
      if (aValue == null) return 1;
      if (bValue == null) return -1;
      return sortOrder === 'best' ? bValue - aValue : aValue - bValue;
    });
  }, [data, period, sortOrder, view]);

  const handleCardAskAi = async (card: (typeof fundCards)[number]) => {
    const key = `${card.slug}-${card.capType}`;
    try {
      setAskAiCopiedKey(key);
      setAskAiMessage(null);
      const prompt = buildMarketFlowAskAiPrompt(card);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setAskAiMessage('Prompt copied — paste into ChatGPT');
        setTimeout(() => {
          setAskAiCopiedKey(null);
          setAskAiMessage(null);
        }, 3000);
      } else {
        setAskAiMessage('Could not access clipboard.');
        setAskAiCopiedKey(null);
      }
    } catch (e) {
      setAskAiMessage(e instanceof Error ? e.message : 'Failed to copy prompt');
      setAskAiCopiedKey(null);
    }
  };

  const pillClass = (active: boolean) =>
    `px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
      active
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
    }`;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['vs', 'Large vs Small'],
                ['large', 'Large-cap'],
                ['small', 'Small-cap'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => handleViewChange(id)}
                className={pillClass(view === id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="hidden sm:block h-7 w-px shrink-0 bg-gray-300 dark:bg-gray-600"
            aria-hidden
          />

          <div className="flex flex-wrap gap-2">
            {MARKET_FLOW_PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={pillClass(period === p)}
              >
                {MARKET_FLOW_PERIOD_LABELS[p]}
              </button>
            ))}
          </div>

          <div
            className="hidden sm:block h-7 w-px shrink-0 bg-gray-300 dark:bg-gray-600"
            aria-hidden
          />

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            {data?.dataStale && (
              <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                Stale
              </span>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortMenu((open) => !open)}
                title="Sort market cards"
                aria-label="Sort market cards"
                aria-expanded={showSortMenu}
                className={`p-1.5 rounded-lg border transition-colors ${
                  showSortMenu
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 6h18M6 12h12m-9 6h6"
                  />
                </svg>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                  {(
                    [
                      ['best', 'Best to worst'],
                      ['worst', 'Worst to best'],
                      ['market', 'Market A–Z'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setSortOrder(id);
                        setShowSortMenu(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        sortOrder === id
                          ? 'bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                      {sortOrder === id && <span aria-hidden>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
                title={refreshing ? 'Refreshing market data' : 'Refresh market data'}
                aria-label={refreshing ? 'Refreshing market data' : 'Refresh market data'}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                <svg
                  className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.25}
                    d="M4 4v6h6M20 20v-6h-6M5.5 15.5A7 7 0 0018 17l2-3M18.5 8.5A7 7 0 006 7L4 10"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}

        {data?.staleWarning && !error && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            {data.staleWarning}
          </div>
        )}

        {loading && !data ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">
            Loading market flow data...
          </div>
        ) : data ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
              {summaryCards.map((card) => (
                <div
                  key={card.label}
                  className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {card.label}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{card.value}</div>
                </div>
              ))}
            </div>

            {askAiMessage && (
              <p className="mb-3 text-xs text-green-700 dark:text-green-300">{askAiMessage}</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 mb-6">
              {fundCards.map((card, index) => {
                const pct = card.returnPct;
                const backgroundColor =
                  pct == null ? '#9ca3af' : marketChangePctToColor(pct);
                const color = pct == null ? '#ffffff' : marketChangePctToTextColor(pct);
                const cardKey = `${card.slug}-${card.capType}`;
                const comparison = capRelativeSpread(card.capType, card.spread);

                return (
                  <div
                    key={cardKey}
                    className={`rounded-xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden shadow-sm min-h-[180px] flex flex-col transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-md ${
                      cardsVisible
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-3 scale-[0.98]'
                    }`}
                    style={{
                      backgroundColor,
                      color,
                      transitionDelay: cardsVisible ? `${Math.min(index * 25, 225)}ms` : '0ms',
                    }}
                  >
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Link href={`/research/markets/${card.slug}`} className="min-w-0">
                          <h2 className="font-bold text-lg leading-tight">{card.market}</h2>
                        </Link>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="rounded border border-current/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                            {card.capType === 'large' ? 'Large-cap' : 'Small-cap'}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCardAskAi(card)}
                            title="Ask AI why this market is moving"
                            className={`min-w-10 text-[10px] px-2.5 py-1 rounded font-medium border transition-colors ${
                              askAiCopiedKey === cardKey
                                ? 'border-green-600 bg-green-600/20'
                                : 'border-current/40 hover:bg-black/10'
                            }`}
                          >
                            {askAiCopiedKey === cardKey ? '✓' : 'AI'}
                          </button>
                        </div>
                      </div>

                      <Link href={`/research/markets/${card.slug}`} className="flex-1 flex flex-col">
                        <div className="text-3xl font-bold tabular-nums mb-2">
                          {formatPct(pct)}
                        </div>

                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {card.spread != null && (
                            <span className="group/spread relative inline-flex">
                              <span
                                className="cursor-help rounded border border-black/10 px-2 py-0.5 text-[10px] font-bold tabular-nums shadow-sm"
                                style={
                                  comparison.relative == null
                                    ? undefined
                                    : {
                                        backgroundColor: marketChangePctToColor(
                                          comparison.relative
                                        ),
                                        color: marketChangePctToTextColor(comparison.relative),
                                      }
                                }
                                tabIndex={0}
                                aria-describedby={`spread-tip-${cardKey}`}
                              >
                                {comparison.label}
                              </span>
                              <span
                                id={`spread-tip-${cardKey}`}
                                role="tooltip"
                                className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left text-[11px] leading-snug text-gray-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover/spread:opacity-100 group-focus-within/spread:opacity-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200"
                              >
                                {(() => {
                                  const tip = lcScSpreadTooltip(card.spread, card.capType);
                                  return (
                                    <>
                                      <span className="mb-1.5 block font-semibold text-gray-900 dark:text-white">
                                        {tip.title}
                                      </span>
                                      <span className="mb-1.5 block">
                                        <span className="font-medium text-gray-800 dark:text-gray-100">
                                          What it means:{' '}
                                        </span>
                                        {tip.meaning}
                                      </span>
                                      <span className="mb-1.5 block">
                                        <span className="font-medium text-gray-800 dark:text-gray-100">
                                          Why care:{' '}
                                        </span>
                                        {tip.whyCare}
                                      </span>
                                      <span className="block">
                                        <span className="font-medium text-gray-800 dark:text-gray-100">
                                          Theory:{' '}
                                        </span>
                                        {tip.theory}
                                      </span>
                                    </>
                                  );
                                })()}
                              </span>
                            </span>
                          )}
                        </div>

                        <div className="mt-auto">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-bold">{card.symbol}</span>
                          </div>
                          <p className="mt-1 truncate text-xs opacity-80">{card.fundName}</p>
                          {card.holdings.length > 0 && (
                            <p className="mt-2 text-[11px] leading-snug opacity-85">
                              Top:{' '}
                              {card.holdings
                                .slice(0, 3)
                                .map((h) => h.symbol)
                                .join(' · ')}
                            </p>
                          )}
                          <div className="mt-2 text-xs opacity-80">
                            <span>
                              {card.price != null
                                ? `$${card.price.toFixed(2)}`
                                : 'Price unavailable'}
                            </span>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <h2 className="text-sm font-semibold">
                  All markets — {globalCap === 'large' ? 'large-cap' : 'small-cap'} (indexed to 100)
                </h2>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGlobalCap('large')}
                    className={pillClass(globalCap === 'large')}
                  >
                    Large-cap
                  </button>
                  <button
                    type="button"
                    onClick={() => setGlobalCap('small')}
                    className={pillClass(globalCap === 'small')}
                  >
                    Small-cap
                  </button>
                  {MARKET_FLOW_PERIODS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setGlobalPeriod(p)}
                      className={pillClass(globalPeriod === p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-80 w-full">
                {globalChart && globalChart.chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={globalChart.chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={40} />
                      <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={44} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        wrapperStyle={{ zIndex: 1000 }}
                        formatter={(
                          value: number,
                          name: string,
                          item: { dataKey?: unknown; payload?: unknown }
                        ) => {
                          const benchmarkKey = globalChart.benchmark?.key;
                          const payload = item.payload as
                            | Record<string, string | number>
                            | undefined;
                          const benchmarkValue =
                            benchmarkKey && payload
                              ? Number(payload[benchmarkKey])
                              : Number.NaN;
                          const numericValue = Number(value);
                          const isBenchmark = item.dataKey === benchmarkKey;
                          const difference =
                            !isBenchmark &&
                            Number.isFinite(benchmarkValue) &&
                            benchmarkValue !== 0
                              ? (numericValue / benchmarkValue - 1) * 100
                              : null;

                          return [
                            `${numericValue.toFixed(1)}${
                              difference == null
                                ? ''
                                : ` (${difference >= 0 ? '+' : ''}${difference.toFixed(1)}% vs SPY)`
                            }`,
                            name,
                          ];
                        }}
                      />
                      {globalChart.series.map((s, i) => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          name={`${s.name} (${s.symbol})`}
                          stroke={CHART_COLORS[i % CHART_COLORS.length]}
                          hide={hiddenChartKeys.includes(s.key)}
                          dot={false}
                          strokeWidth={1.75}
                          connectNulls
                        />
                      ))}
                      {globalChart.benchmark && (
                        <Line
                          type="monotone"
                          dataKey={globalChart.benchmark.key}
                          name={`vs SPY (${globalChart.benchmark.symbol})`}
                          stroke="#111827"
                          strokeDasharray="7 5"
                          hide={hiddenChartKeys.includes(globalChart.benchmark.key)}
                          dot={false}
                          strokeWidth={2.5}
                          connectNulls
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    No chart data yet
                  </div>
                )}
              </div>
              {chartToggleItems.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {chartToggleItems.map((item, index) => {
                    const checked = !hiddenChartKeys.includes(item.key);
                    const color = item.isBenchmark
                      ? '#111827'
                      : CHART_COLORS[index % CHART_COLORS.length];
                    return (
                      <label
                        key={item.key}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${
                          checked
                            ? item.isBenchmark
                              ? 'border-gray-800 bg-gray-100 text-gray-900 dark:border-gray-200 dark:bg-gray-700 dark:text-white'
                              : 'border-gray-300 bg-gray-50 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
                            : 'border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded border-gray-300"
                          checked={checked}
                          onChange={() => toggleChartSeries(item.key)}
                        />
                        <span
                          className="inline-block h-2 w-4 rounded-sm"
                          style={{
                            backgroundColor: checked ? color : 'transparent',
                            borderBottom: item.isBenchmark
                              ? `2px dashed ${checked ? color : '#9ca3af'}`
                              : undefined,
                            opacity: checked ? 1 : 0.35,
                          }}
                          aria-hidden
                        />
                        <span className={item.isBenchmark ? 'font-semibold' : undefined}>
                          {item.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

          </>
        ) : null}
      </div>
    </div>
  );
}
