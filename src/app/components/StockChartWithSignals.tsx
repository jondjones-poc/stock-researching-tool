'use client';

import React, { useState } from 'react';
import StockPriceChart from './StockPriceChart';
import SignalRiskModal from './SignalRiskModal';
import { buildHeartbeatMovePrompt } from '../utils/buildHeartbeatMovePrompt';
import type { HeartbeatSignalEvent } from '../utils/heartbeatBreakoutSignals';

function formatSignalDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export type StockChartMeta = {
  price: number | null;
  changePercent: number | null;
  periodLabel: string;
};

/**
 * Shared price chart + heartbeat/breakout signal table, move summaries,
 * Ask AI (explain move) and Ask AI – Signal Risk. Used by stock search + companies.
 */
export default function StockChartWithSignals({
  symbol,
  name,
  sector,
  industry,
  chartHeightClassName = 'h-[560px]',
  showTitle = false,
  title = 'Price chart',
  onMeta,
  onMessage,
}: {
  symbol: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  chartHeightClassName?: string;
  showTitle?: boolean;
  title?: string;
  onMeta?: (meta: StockChartMeta) => void;
  onMessage?: (message: string | null) => void;
}) {
  const [periodLabel, setPeriodLabel] = useState('1M');
  const [signalEvents, setSignalEvents] = useState<HeartbeatSignalEvent[]>([]);
  const [moveAskAiId, setMoveAskAiId] = useState<string | null>(null);
  const [riskEvent, setRiskEvent] = useState<HeartbeatSignalEvent | null>(null);

  const handleAskMoveAi = async (event: HeartbeatSignalEvent) => {
    try {
      setMoveAskAiId(event.id);
      onMessage?.(null);
      const prompt = buildHeartbeatMovePrompt({
        symbol,
        name,
        periodLabel,
        event,
      });
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        onMessage?.('Move prompt copied — paste into ChatGPT (Felix / Goat Academy lens).');
        setTimeout(() => {
          setMoveAskAiId(null);
          onMessage?.(null);
        }, 3500);
      } else {
        onMessage?.('Could not access clipboard.');
        setMoveAskAiId(null);
      }
    } catch (e) {
      onMessage?.(e instanceof Error ? e.message : 'Failed to copy prompt');
      setMoveAskAiId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-4 lg:p-6 ${
          showTitle ? '' : ''
        }`}
      >
        {showTitle && (
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">{title}</h2>
        )}
        <div className={chartHeightClassName}>
          <StockPriceChart
            symbol={symbol}
            onMeta={(meta) => {
              setPeriodLabel(meta.periodLabel);
              onMeta?.(meta);
            }}
            onSignals={(events) => setSignalEvents(events)}
          />
        </div>
      </div>

      {signalEvents.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden shadow-md">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Heartbeat &amp; breakout signals
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Detected in the current chart window ({periodLabel}). Try a longer period if the table
              is empty.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">150d MA</th>
                  <th className="px-4 py-2 font-medium">+5d</th>
                  <th className="px-4 py-2 font-medium">+10d</th>
                  <th className="px-4 py-2 font-medium">Snapshot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {signalEvents.map((ev) => (
                  <tr key={ev.id} className="text-gray-800 dark:text-gray-200">
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                      {formatSignalDate(ev.date)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                          ev.type === 'buy'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        }`}
                      >
                        {ev.type === 'buy' ? 'Buy / heartbeat' : 'Sell'}
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums">${ev.price.toFixed(2)}</td>
                    <td className="px-4 py-2 tabular-nums">
                      {ev.ma150 != null ? `$${ev.ma150.toFixed(2)}` : '—'}
                    </td>
                    <td
                      className={`px-4 py-2 tabular-nums ${
                        (ev.move5dPct ?? 0) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : (ev.move5dPct ?? 0) < 0
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                      }`}
                    >
                      {formatPct(ev.move5dPct)}
                    </td>
                    <td
                      className={`px-4 py-2 tabular-nums ${
                        (ev.move10dPct ?? 0) > 0
                          ? 'text-green-600 dark:text-green-400'
                          : (ev.move10dPct ?? 0) < 0
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                      }`}
                    >
                      {formatPct(ev.move10dPct)}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300 max-w-xs">
                      {ev.headline}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-4 space-y-4 border-t border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Move summaries</h4>
            {signalEvents.map((ev) => (
              <div
                key={`detail-${ev.id}`}
                className="rounded-lg border border-gray-200 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-900/40"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      <span
                        className={
                          ev.type === 'buy'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }
                      >
                        {ev.type === 'buy' ? 'Buy breakout' : 'Sell signal'}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 font-normal">
                        {' '}
                        · {formatSignalDate(ev.date)} · ${ev.price.toFixed(2)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setRiskEvent(ev)}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-amber-300 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                    >
                      🎯 Ask AI – Signal Risk
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAskMoveAi(ev)}
                      disabled={moveAskAiId === ev.id}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        moveAskAiId === ev.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                      }`}
                    >
                      {moveAskAiId === ev.id ? '✓ Prompt copied' : '🤖 Ask AI — explain this move'}
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {ev.summary}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {riskEvent && (
        <SignalRiskModal
          open={Boolean(riskEvent)}
          onClose={() => setRiskEvent(null)}
          symbol={symbol}
          name={name}
          sector={sector}
          industry={industry}
          periodLabel={periodLabel}
          event={riskEvent}
        />
      )}
    </div>
  );
}
