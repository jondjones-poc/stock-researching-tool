'use client';

import React, { useEffect, useState } from 'react';
import type { HeartbeatSignalEvent } from '../utils/heartbeatBreakoutSignals';
import {
  buildSignalRiskPrompt,
  computeLocalSignalRisk,
  computeSignalConfirmation,
  parseSignalRiskAiResponse,
  signalRiskBandEmoji,
  signalRiskBandLabel,
  type SignalRiskAssessment,
} from '../utils/buildSignalRiskPrompt';

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SignalRiskModal({
  open,
  onClose,
  symbol,
  name,
  sector,
  industry,
  periodLabel,
  event,
}: {
  open: boolean;
  onClose: () => void;
  symbol: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  periodLabel?: string;
  event: HeartbeatSignalEvent;
}) {
  const [assessment, setAssessment] = useState<SignalRiskAssessment>(() =>
    computeLocalSignalRisk(event, { sector })
  );
  const [confirmation] = useState(() => computeSignalConfirmation(event));
  const [aiConfirmation, setAiConfirmation] = useState<{ label: string; text: string } | null>(
    null
  );
  const [paste, setPaste] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAssessment(computeLocalSignalRisk(event, { sector }));
    setAiConfirmation(null);
    setPaste('');
    setPasteError(null);

    const prompt = buildSignalRiskPrompt({
      symbol,
      name,
      sector,
      industry,
      periodLabel,
      event,
    });
    void (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 3500);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [open, event, symbol, name, sector, industry, periodLabel]);

  if (!open) return null;

  const score = assessment.score;
  const emoji = signalRiskBandEmoji(score, event.type);
  const band = signalRiskBandLabel(score, event.type);
  const conf = aiConfirmation || {
    label: confirmation.label,
    text: confirmation.text,
  };

  const handleCopy = async () => {
    const prompt = buildSignalRiskPrompt({
      symbol,
      name,
      sector,
      industry,
      periodLabel,
      event,
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch {
      setPasteError('Could not copy prompt');
    }
  };

  const handleApplyPaste = () => {
    const parsed = parseSignalRiskAiResponse(paste);
    if (!parsed) {
      setPasteError('Could not parse JSON. Paste the ChatGPT JSON object and try again.');
      return;
    }
    setAssessment(parsed.assessment);
    if (parsed.confirmation) setAiConfirmation(parsed.confirmation);
    setPasteError(null);
  };

  const section = (
    icon: string,
    title: string,
    body: { score: number | null; text: string }
  ) => (
    <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40">
      <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        {icon} {title}
        {body.score != null ? (
          <span className="text-gray-500 dark:text-gray-400 font-normal"> · {body.score}/10</span>
        ) : null}
      </p>
      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{body.text}</p>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-risk-title"
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h2 id="signal-risk-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Ask AI – Signal Risk
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              {event.type.toUpperCase()} SIGNAL · {formatDate(event.date)} · {symbol}
            </p>
            <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white">
              {event.type.toUpperCase()} SIGNAL: {score.toFixed(1)} / 10
            </p>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {emoji} {band}
            </p>
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {assessment.source === 'ai'
                ? 'Score from ChatGPT (signal-date only).'
                : 'App estimate from signal-date data — paste ChatGPT JSON to refine neighbourhood.'}{' '}
              Later price does not change this score.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
            {(event.type === 'sell'
              ? [
                  ['🟢', '1–3'],
                  ['🟡', '4–6'],
                  ['🟠', '7–7.9'],
                  ['🔴', '8–10'],
                ]
              : [
                  ['🔴', '1–3'],
                  ['🟡', '4–6'],
                  ['🟠', '7–7.9'],
                  ['🟢', '8–10'],
                ]
            ).map(([e, label]) => (
              <span
                key={label}
                className="px-2 py-0.5 rounded border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"
              >
                {e} {label}
              </span>
            ))}
          </div>

          {section('🏘️', 'Neighbourhood', assessment.neighbourhood)}
          {section('📉', 'Trend', assessment.trend)}
          {section(
            '💓',
            event.type === 'buy' ? 'Pause / heartbeat vs crash' : 'Pause vs crash',
            assessment.pauseVsCrash
          )}
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 p-3 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">🎯 Overall</p>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {assessment.overall}
            </p>
          </div>

          <div className="rounded-lg border border-violet-200 dark:border-violet-800 p-3 bg-violet-50/50 dark:bg-violet-900/20">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              What happened next
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Confirmation only — does not change the original score.
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              {conf.label}{' '}
              {conf.label === 'Strongly Confirmed'
                ? event.type === 'sell'
                  ? '🔴'
                  : '🟢'
                : conf.label === 'Invalidated'
                  ? '⚪'
                  : ''}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{conf.text}</p>
            <p className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              5 sessions: {formatPct(confirmation.move5dPct)} · 10 sessions:{' '}
              {formatPct(confirmation.move10dPct)}
              {confirmation.reclaimedPrimaryMa != null
                ? ` · MA reclaimed: ${confirmation.reclaimedPrimaryMa ? 'yes' : 'no'}`
                : ''}
            </p>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`w-full px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                copied
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
              }`}
            >
              {copied ? '✓ Felix prompt copied — paste into ChatGPT' : '📋 Copy Ask AI prompt again'}
            </button>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Paste ChatGPT’s JSON reply below to replace the app estimate (especially neighbourhood).
            </p>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              rows={4}
              placeholder='{"score": 7.5, "neighbourhood": {...}, ...}'
              className="w-full text-xs px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono"
            />
            {pasteError && (
              <p className="text-xs text-red-600 dark:text-red-400">{pasteError}</p>
            )}
            <button
              type="button"
              onClick={handleApplyPaste}
              disabled={!paste.trim()}
              className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
            >
              Apply ChatGPT score
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
