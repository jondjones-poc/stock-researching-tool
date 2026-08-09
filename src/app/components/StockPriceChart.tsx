'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardConfig } from '../config/dashboard';
import {
  annotateHeartbeatBreakoutSignals,
  extractHeartbeatSignalEvents,
  heartbeatZonesFromSignals,
  type HeartbeatSignalEvent,
} from '../utils/heartbeatBreakoutSignals';

type ChartRow = {
  date: string;
  price: number;
  volume: number;
  volumeUp: number | null;
  volumeDown: number | null;
  sma30?: number | null;
  sma150?: number | null;
  buyMarker?: number | null;
  sellMarker?: number | null;
  signalNote?: string | null;
};

type ChartMeta = {
  price: number | null;
  changePercent: number | null;
  periodLabel: string;
};

function getDateRange(period: string): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  const opt = dashboardConfig.timePeriods.find((p) => p.value === period);
  if (period === 'YTD') {
    from.setMonth(0, 1);
  } else if (opt?.days) {
    from.setDate(from.getDate() - opt.days);
  } else {
    from.setFullYear(from.getFullYear() - 1);
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

const PERIOD_ORDER = ['1M', '3M', '6M', '9M', '1Y', 'YTD'] as const;
const PERIODS = PERIOD_ORDER.map(
  (value) => dashboardConfig.timePeriods.find((p) => p.value === value)!
).filter(Boolean);

export default function StockPriceChart({
  symbol,
  onMeta,
  onSignals,
}: {
  symbol: string;
  onMeta?: (meta: ChartMeta) => void;
  onSignals?: (events: HeartbeatSignalEvent[]) => void;
}) {
  const [period, setPeriod] = useState('1M');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<ChartRow[]>([]);
  const [heartbeatZones, setHeartbeatZones] = useState<{ x1: string; x2: string }[]>([]);
  const [showTrailingLines, setShowTrailingLines] = useState(true);
  const [showSma30, setShowSma30] = useState(true);
  const [showSma150, setShowSma150] = useState(true);
  const [showSignals, setShowSignals] = useState(true);
  const [showHeartbeats, setShowHeartbeats] = useState(true);

  // Keep latest callbacks without putting them in load deps (inline parent
  // callbacks would otherwise re-trigger fetch → setState → re-render loop).
  const onMetaRef = useRef(onMeta);
  const onSignalsRef = useRef(onSignals);
  useEffect(() => {
    onMetaRef.current = onMeta;
  }, [onMeta]);
  useEffect(() => {
    onSignalsRef.current = onSignals;
  }, [onSignals]);

  const lastMetaKeyRef = useRef<string>('');

  const emitMeta = useCallback((meta: ChartMeta) => {
    const key = `${meta.price}|${meta.changePercent}|${meta.periodLabel}`;
    if (key === lastMetaKeyRef.current) return;
    lastMetaKeyRef.current = key;
    onMetaRef.current?.(meta);
  }, []);

  const load = useCallback(async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setLoading(true);
    setError(null);
    try {
      const { from, to } = getDateRange(period);
      const res = await fetch(
        `/api/historical-prices?symbol=${encodeURIComponent(sym)}&from=${from}&to=${to}`,
        { cache: 'no-store', credentials: 'same-origin' }
      );
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || json.message || 'Failed to load chart');
      }
      const historical = json.historical || [];
      const raw = historical
        .filter(
          (item: { close?: number }) =>
            item && item.close !== undefined && item.close !== null && !Number.isNaN(Number(item.close))
        )
        .map((item: Record<string, unknown>) => ({
          date: String(item.date),
          open: Number(item.open ?? item.close),
          high: Number(item.high ?? item.close),
          low: Number(item.low ?? item.close),
          close: Number(item.close),
          volume: Number(item.volume ?? 0),
          change: Number(item.change ?? 0),
          changePercent: Number(item.changePercent ?? 0),
          sma30:
            item.sma30 !== undefined && item.sma30 !== null && !Number.isNaN(Number(item.sma30))
              ? Number(item.sma30)
              : null,
          sma150:
            item.sma150 !== undefined && item.sma150 !== null && !Number.isNaN(Number(item.sma150))
              ? Number(item.sma150)
              : item.sma90 !== undefined && item.sma90 !== null && !Number.isNaN(Number(item.sma90))
                ? Number(item.sma90)
                : null,
        }));

      const annotated = annotateHeartbeatBreakoutSignals(raw);
      const rows: ChartRow[] = annotated.map((b) => {
        const up = b.close >= b.open;
        return {
          date: b.date,
          price: b.close,
          volume: b.volume,
          volumeUp: up ? b.volume : null,
          volumeDown: up ? null : b.volume,
          sma30: b.sma30,
          sma150: b.sma150,
          buyMarker: b.buyMarker,
          sellMarker: b.sellMarker,
          signalNote: b.signalNote,
        };
      });
      setChartData(rows);
      setHeartbeatZones(heartbeatZonesFromSignals(annotated));
      onSignalsRef.current?.(extractHeartbeatSignalEvents(annotated));

      const last = rows[rows.length - 1];
      const first = rows[0];
      const changePercent =
        last && first && first.price
          ? ((last.price - first.price) / first.price) * 100
          : null;
      emitMeta({
        price: last?.price ?? null,
        changePercent,
        periodLabel: period,
      });
    } catch (e) {
      setChartData([]);
      setHeartbeatZones([]);
      onSignalsRef.current?.([]);
      setError(e instanceof Error ? e.message : 'Failed to load chart');
      emitMeta({ price: null, changePercent: null, periodLabel: period });
    } finally {
      setLoading(false);
    }
  }, [symbol, period, emitMeta]);

  useEffect(() => {
    void load();
  }, [load]);

  // Reset meta dedupe / old series when symbol changes so parent gets a fresh price.
  useEffect(() => {
    lastMetaKeyRef.current = '';
    setChartData([]);
    setHeartbeatZones([]);
    onSignalsRef.current?.([]);
    setError(null);
  }, [symbol]);

  return (
    <div className="flex flex-col min-h-0 h-full gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              disabled={loading}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                period === p.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showTrailingLines}
              onChange={(e) => setShowTrailingLines(e.target.checked)}
              className="accent-blue-600"
            />
            Trailing MAs
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40">
            <input
              type="checkbox"
              checked={showSma30}
              disabled={!showTrailingLines}
              onChange={(e) => setShowSma30(e.target.checked)}
              className="accent-blue-600"
            />
            30d
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSma150}
              disabled={!showTrailingLines}
              onChange={(e) => setShowSma150(e.target.checked)}
              className="accent-blue-600"
            />
            150d
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showSignals}
              onChange={(e) => setShowSignals(e.target.checked)}
              className="accent-blue-600"
            />
            Signals
          </label>
          <label
            className="inline-flex items-center gap-1.5 cursor-pointer"
            title="Shade quiet 3-day consolidation (heartbeat) before each buy breakout"
          >
            <input
              type="checkbox"
              checked={showHeartbeats}
              onChange={(e) => setShowHeartbeats(e.target.checked)}
              className="accent-blue-600"
            />
            Heartbeats
          </label>
        </div>
      </div>

      <div className="flex-1 min-h-[420px] bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 flex flex-col">
        {loading && chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Loading chart…</div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center text-red-600 dark:text-red-400 text-sm px-4 text-center">
            {error}
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">No chart data</div>
        ) : (
          <>
            {loading && (
              <p className="text-[11px] text-gray-500 text-center mb-1">Updating…</p>
            )}
            <div className="flex-[3] min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  {showHeartbeats &&
                    heartbeatZones.map((z) => (
                      <ReferenceArea
                        key={`${z.x1}-${z.x2}`}
                        x1={z.x1}
                        x2={z.x2}
                        fill="#22C55E"
                        fillOpacity={0.18}
                        stroke="#22C55E"
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        ifOverflow="visible"
                      />
                    ))}
                  <XAxis
                    dataKey="date"
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' });
                    }}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#F9FAFB',
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const row = payload[0]?.payload as ChartRow | undefined;
                      const dateLabel = label
                        ? new Date(label).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '';
                      const isBuy = row?.buyMarker != null;
                      const isSell = row?.sellMarker != null;
                      return (
                        <div className="rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-xs text-gray-100 shadow-lg max-w-xs">
                          <div className="font-medium text-gray-200 mb-1">{dateLabel}</div>
                          {row?.price != null && (
                            <div className="tabular-nums mb-1">
                              Price: <span className="font-semibold">${row.price.toFixed(2)}</span>
                            </div>
                          )}
                          {showTrailingLines && showSma30 && row?.sma30 != null && (
                            <div className="text-amber-300 tabular-nums">
                              30d MA: ${Number(row.sma30).toFixed(2)}
                            </div>
                          )}
                          {showTrailingLines && showSma150 && row?.sma150 != null && (
                            <div className="text-red-300 tabular-nums">
                              150d MA: ${Number(row.sma150).toFixed(2)}
                            </div>
                          )}
                          {showSignals && (isBuy || isSell) && row?.signalNote && (
                            <div
                              className={`mt-2 pt-2 border-t border-gray-600 leading-snug ${
                                isBuy ? 'text-green-300' : 'text-red-300'
                              }`}
                            >
                              <div className="font-semibold mb-0.5">{isBuy ? '▲ Buy' : '▼ Sell'}</div>
                              <div>{row.signalNote}</div>
                            </div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(value) =>
                      value === 'sma30'
                        ? '30d MA'
                        : value === 'sma150'
                          ? '150d MA'
                          : value === 'buyMarker'
                            ? 'Buy'
                            : value === 'sellMarker'
                              ? 'Sell'
                              : 'Price'
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="price"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 5 }}
                    isAnimationActive={false}
                  />
                  {showTrailingLines && showSma30 && (
                    <Line
                      type="monotone"
                      dataKey="sma30"
                      name="sma30"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      strokeDasharray="4 3"
                      isAnimationActive={false}
                    />
                  )}
                  {showTrailingLines && showSma150 && (
                    <Line
                      type="monotone"
                      dataKey="sma150"
                      name="sma150"
                      stroke="#EF4444"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                      strokeDasharray="4 3"
                      isAnimationActive={false}
                    />
                  )}
                  {showSignals && (
                    <>
                      <Line
                        type="monotone"
                        dataKey="buyMarker"
                        name="buyMarker"
                        stroke="#22C55E"
                        strokeWidth={0}
                        dot={{ r: 4, fill: '#22C55E' }}
                        connectNulls={false}
                        legendType="circle"
                        isAnimationActive={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="sellMarker"
                        name="sellMarker"
                        stroke="#EF4444"
                        strokeWidth={0}
                        dot={{ r: 4, fill: '#EF4444' }}
                        connectNulls={false}
                        legendType="circle"
                        isAnimationActive={false}
                      />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-h-[80px] mt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" hide />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={10}
                    tickFormatter={(v) =>
                      v >= 1e9 ? `${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      typeof value === 'number' ? value.toLocaleString() : value,
                      'Volume',
                    ]}
                    labelFormatter={(label) =>
                      new Date(label).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '6px',
                      color: '#F9FAFB',
                    }}
                  />
                  <Bar dataKey="volumeUp" fill="#16a34a" name="Up vol" stackId="v" isAnimationActive={false} />
                  <Bar dataKey="volumeDown" fill="#dc2626" name="Down vol" stackId="v" isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
