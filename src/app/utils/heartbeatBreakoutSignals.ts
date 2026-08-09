import type { HistoricalPriceBar } from './yahooHistoricalPrices';

export type ChartSignal = 'buy' | 'sell' | null;

export interface SignalAnnotatedBar extends HistoricalPriceBar {
  buyMarker?: number | null;
  sellMarker?: number | null;
  signal?: ChartSignal;
  /** Human-readable reason shown on hover. */
  signalNote?: string | null;
}

export interface HeartbeatSignalEvent {
  id: string;
  type: 'buy' | 'sell';
  date: string;
  price: number;
  ma30: number | null;
  ma90: number | null;
  ma150: number | null;
  volume: number;
  avgVolume20: number | null;
  volumeVsAvgPct: number | null;
  distMa30Pct: number | null;
  distMa90Pct: number | null;
  distMa150Pct: number | null;
  /** Short table line */
  headline: string;
  /** Longer plain-English move summary (no AI) */
  summary: string;
  signalNote: string;
  /** Buy: quiet consolidation window */
  heartbeatStart?: string;
  heartbeatEnd?: string;
  priorHigh?: number;
  breakoutVsPriorHighPct?: number;
  heartbeatAvgRangePct?: number;
  maSlopePct?: number;
  /** Sell specifics */
  priorClose?: number;
  distanceBelowMaPct?: number;
  /** What happened after the signal (within loaded bars) */
  move5dPct?: number | null;
  move10dPct?: number | null;
  reclaimedPrimaryMa?: boolean | null;
  /** Compact recent history (signal-date and prior only — for AI prompt) */
  recentBars?: Array<{
    date: string;
    close: number;
    volume: number;
    changePercent: number;
  }>;
}

/**
 * Buy: 3-day “heartbeat” (tight consolidation), primary MA rising + price above it,
 * then a breakout to a new high vs the prior lookback window.
 * Sell: close crosses below the primary MA after trading above it.
 */
export function annotateHeartbeatBreakoutSignals(
  bars: HistoricalPriceBar[],
  opts?: {
    primaryMaKey?: 'sma30' | 'sma150';
    heartbeatDays?: number;
    heartbeatRangePct?: number;
    heartbeatChangePct?: number;
    slopeLookback?: number;
    breakoutLookback?: number;
  }
): SignalAnnotatedBar[] {
  const primaryMaKey = opts?.primaryMaKey ?? 'sma150';
  const heartbeatDays = opts?.heartbeatDays ?? 3;
  const heartbeatRangePct = opts?.heartbeatRangePct ?? 3.5;
  const heartbeatChangePct = opts?.heartbeatChangePct ?? 1.75;
  const slopeLookback = opts?.slopeLookback ?? 5;
  const breakoutLookback = opts?.breakoutLookback ?? 20;
  const maLabel = primaryMaKey === 'sma30' ? '30-day' : '150-day';

  const out: SignalAnnotatedBar[] = bars.map((b) => ({
    ...b,
    buyMarker: null,
    sellMarker: null,
    signal: null,
    signalNote: null,
  }));

  for (let i = 0; i < out.length; i++) {
    const bar = out[i];
    const ma = bar[primaryMaKey];
    if (ma == null || !Number.isFinite(ma)) continue;

    const above = bar.close > ma;
    const prev = i > 0 ? out[i - 1] : null;
    const prevMa = prev?.[primaryMaKey];
    const wasAbove = prev != null && prevMa != null && prev.close > prevMa;

    // Sell: first close back below MA after being above
    if (!above && wasAbove && prev && prevMa != null) {
      out[i].sellMarker = bar.close;
      out[i].signal = 'sell';
      out[i].signalNote =
        `Sell signal: price closed below the rising/held ${maLabel} MA ` +
        `($${bar.close.toFixed(2)} under $${ma.toFixed(2)}; prior close was above at $${prev.close.toFixed(2)}).`;
      continue;
    }

    if (i < Math.max(heartbeatDays, slopeLookback, breakoutLookback) + 1) continue;
    if (!above) continue;

    const maThen = out[i - slopeLookback][primaryMaKey];
    if (maThen == null || ma <= maThen) continue; // trailing line not positive

    // Heartbeat: prior 3 sessions were quiet (tight range OR small day change)
    let heartbeat = true;
    for (let j = i - heartbeatDays; j < i; j++) {
      const b = out[j];
      const mid = (b.high + b.low) / 2 || b.close;
      const rangePct = mid > 0 ? ((b.high - b.low) / mid) * 100 : 100;
      const changePct = Math.abs(b.changePercent ?? 0);
      if (rangePct > heartbeatRangePct && changePct > heartbeatChangePct) {
        heartbeat = false;
        break;
      }
    }
    if (!heartbeat) continue;

    // Breakout: close makes a new high vs prior lookback (excluding today)
    let priorHigh = -Infinity;
    for (let j = i - breakoutLookback; j < i; j++) {
      priorHigh = Math.max(priorHigh, out[j].high, out[j].close);
    }
    if (!(bar.close > priorHigh)) continue;

    out[i].buyMarker = bar.close;
    out[i].signal = 'buy';
    out[i].signalNote =
      `Buy signal: ${heartbeatDays}-day heartbeat (quiet consolidation), ` +
      `${maLabel} MA turning up with price above it ($${bar.close.toFixed(2)} > $${ma.toFixed(2)}), ` +
      `then a breakout to a new ${breakoutLookback}-day high (prior high $${priorHigh.toFixed(2)}).`;
  }

  return out;
}

/** Quiet consolidation windows that preceded a buy signal (for chart shading). */
export function heartbeatZonesFromSignals(
  bars: SignalAnnotatedBar[],
  opts?: { heartbeatDays?: number; includeBreakoutDay?: boolean }
): { x1: string; x2: string }[] {
  const heartbeatDays = opts?.heartbeatDays ?? 3;
  const includeBreakoutDay = opts?.includeBreakoutDay ?? true;
  const zones: { x1: string; x2: string }[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (bars[i].signal !== 'buy') continue;
    const startIdx = i - heartbeatDays;
    if (startIdx < 0) continue;
    const endIdx = includeBreakoutDay ? i : Math.max(startIdx, i - 1);
    const x1 = bars[startIdx]?.date;
    const x2 = bars[endIdx]?.date;
    if (!x1 || !x2) continue;
    zones.push({ x1, x2 });
  }

  return zones;
}

function pctChange(from: number, to: number): number | null {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return null;
  return ((to - from) / from) * 100;
}

function formatPct(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function distPct(price: number, ma: number | null | undefined): number | null {
  if (ma == null || !Number.isFinite(ma) || ma === 0) return null;
  return ((price - ma) / ma) * 100;
}

function avgVolume(bars: SignalAnnotatedBar[], endIdx: number, window: number): number | null {
  const start = Math.max(0, endIdx - window + 1);
  let sum = 0;
  let n = 0;
  for (let j = start; j <= endIdx; j++) {
    if (bars[j].volume > 0) {
      sum += bars[j].volume;
      n += 1;
    }
  }
  return n > 0 ? sum / n : null;
}

/**
 * Structured buy/sell events with plain-English move summaries for the stock-search UI.
 */
export function extractHeartbeatSignalEvents(
  bars: SignalAnnotatedBar[],
  opts?: {
    primaryMaKey?: 'sma30' | 'sma150';
    heartbeatDays?: number;
    slopeLookback?: number;
    breakoutLookback?: number;
  }
): HeartbeatSignalEvent[] {
  const primaryMaKey = opts?.primaryMaKey ?? 'sma150';
  const heartbeatDays = opts?.heartbeatDays ?? 3;
  const slopeLookback = opts?.slopeLookback ?? 5;
  const breakoutLookback = opts?.breakoutLookback ?? 20;
  const maLabel = primaryMaKey === 'sma30' ? '30-day' : '150-day';
  const events: HeartbeatSignalEvent[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    if (bar.signal !== 'buy' && bar.signal !== 'sell') continue;

    const ma30 = bar.sma30 ?? null;
    const ma90 = bar.sma90 ?? null;
    const ma150 = bar.sma150 ?? null;
    const primaryMa = bar[primaryMaKey] ?? ma150 ?? ma90 ?? null;
    const avgVolume20 = avgVolume(bars, i, 20);
    const volumeVsAvgPct =
      avgVolume20 != null && avgVolume20 > 0 && bar.volume > 0
        ? ((bar.volume - avgVolume20) / avgVolume20) * 100
        : null;
    const close5 = bars[i + 5]?.close;
    const close10 = bars[i + 10]?.close;
    const move5dPct = close5 != null ? pctChange(bar.close, close5) : null;
    const move10dPct = close10 != null ? pctChange(bar.close, close10) : null;

    let reclaimedPrimaryMa: boolean | null = null;
    if (primaryMa != null && (move5dPct != null || move10dPct != null)) {
      const lookAhead = Math.min(bars.length - 1, i + 10);
      let reclaimed = false;
      for (let j = i + 1; j <= lookAhead; j++) {
        const maJ = bars[j][primaryMaKey] ?? bars[j].sma150 ?? bars[j].sma90;
        if (maJ != null && bars[j].close > maJ) {
          reclaimed = true;
          break;
        }
      }
      reclaimedPrimaryMa = reclaimed;
    }

    const recentBars = bars.slice(Math.max(0, i - 9), i + 1).map((b) => ({
      date: b.date,
      close: b.close,
      volume: b.volume,
      changePercent: b.changePercent ?? 0,
    }));

    const aftermath =
      move5dPct != null || move10dPct != null
        ? ` After the signal: 5 sessions ${formatPct(move5dPct)}, 10 sessions ${formatPct(move10dPct)}.`
        : ' Not enough later bars in this chart window to measure the follow-through yet.';

    const baseFields = {
      date: bar.date,
      price: bar.close,
      ma30,
      ma90,
      ma150,
      volume: bar.volume,
      avgVolume20,
      volumeVsAvgPct,
      distMa30Pct: distPct(bar.close, ma30),
      distMa90Pct: distPct(bar.close, ma90),
      distMa150Pct: distPct(bar.close, ma150),
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
      recentBars,
    };

    if (bar.signal === 'sell') {
      const prev = bars[i - 1];
      const priorClose = prev?.close ?? null;
      const distanceBelowMaPct =
        primaryMa != null && primaryMa !== 0 ? ((bar.close - primaryMa) / primaryMa) * 100 : null;
      const headline = `Sell — closed under ${maLabel} MA`;
      const summary =
        `On ${formatDate(bar.date)}, ${bar.close.toFixed(2)} closed below the ${maLabel} MA` +
        (primaryMa != null ? ` (${primaryMa.toFixed(2)}, ${formatPct(distanceBelowMaPct)} vs MA)` : '') +
        (priorClose != null
          ? `. The prior session closed above the line at $${priorClose.toFixed(2)}, so this is the first break back under trend.`
          : '.') +
        ` Volume was ${bar.volume > 0 ? bar.volume.toLocaleString() : 'unavailable'}` +
        (volumeVsAvgPct != null ? ` (${formatPct(volumeVsAvgPct)} vs 20-day avg).` : '.') +
        ` In Felix / Goat Academy terms this is a trend-line break — treat the stock like it may be on black ice until price reclaims the MA with strength.` +
        aftermath;

      events.push({
        id: `sell-${bar.date}-${i}`,
        type: 'sell',
        ...baseFields,
        headline,
        summary,
        signalNote: bar.signalNote || headline,
        priorClose: priorClose ?? undefined,
        distanceBelowMaPct: distanceBelowMaPct ?? undefined,
      });
      continue;
    }

    // Buy + heartbeat
    const hbStart = i - heartbeatDays;
    const hbEnd = i - 1;
    let rangeSum = 0;
    let rangeCount = 0;
    for (let j = hbStart; j <= hbEnd && j >= 0; j++) {
      const b = bars[j];
      const mid = (b.high + b.low) / 2 || b.close;
      if (mid > 0) {
        rangeSum += ((b.high - b.low) / mid) * 100;
        rangeCount += 1;
      }
    }
    const heartbeatAvgRangePct = rangeCount ? rangeSum / rangeCount : null;

    let priorHigh = -Infinity;
    for (let j = i - breakoutLookback; j < i; j++) {
      if (j < 0) continue;
      priorHigh = Math.max(priorHigh, bars[j].high, bars[j].close);
    }
    const breakoutVsPriorHighPct =
      Number.isFinite(priorHigh) && priorHigh > 0 ? pctChange(priorHigh, bar.close) : null;

    const maThen = bars[i - slopeLookback]?.[primaryMaKey] ?? null;
    const maSlopePct =
      maThen != null && primaryMa != null ? pctChange(maThen, primaryMa) : null;

    const heartbeatStart = bars[hbStart]?.date;
    const heartbeatEnd = bars[hbEnd]?.date;
    const headline = `Buy — heartbeat + breakout`;
    const summary =
      `On ${formatDate(bar.date)}, price broke out at $${bar.close.toFixed(2)}` +
      (Number.isFinite(priorHigh)
        ? ` through a ${breakoutLookback}-day prior high of $${priorHigh.toFixed(2)} (${formatPct(breakoutVsPriorHighPct)}).`
        : '.') +
      (heartbeatStart && heartbeatEnd
        ? ` That followed a ${heartbeatDays}-day heartbeat (quiet consolidation) from ${formatDate(heartbeatStart)} to ${formatDate(heartbeatEnd)}` +
          (heartbeatAvgRangePct != null
            ? ` with an average daily range of about ${heartbeatAvgRangePct.toFixed(2)}%.`
            : '.')
        : '') +
      (primaryMa != null
        ? ` Price was above a rising ${maLabel} MA ($${primaryMa.toFixed(2)}` +
          (maSlopePct != null ? `, MA up ${formatPct(maSlopePct)} over ~${slopeLookback} sessions` : '') +
          `).`
        : '') +
      ` Volume on the breakout day was ${bar.volume > 0 ? bar.volume.toLocaleString() : 'unavailable'}` +
      (volumeVsAvgPct != null ? ` (${formatPct(volumeVsAvgPct)} vs 20-day avg).` : '.') +
      ` In Felix / Goat Academy terms: quiet pause (heartbeat) → reclaim/hold the trend line → breakout. Confirm sector money flow (“neighbourhood”) still supports the move before treating it as a green light.` +
      aftermath;

    events.push({
      id: `buy-${bar.date}-${i}`,
      type: 'buy',
      ...baseFields,
      headline,
      summary,
      signalNote: bar.signalNote || headline,
      heartbeatStart,
      heartbeatEnd,
      priorHigh: Number.isFinite(priorHigh) ? priorHigh : undefined,
      breakoutVsPriorHighPct: breakoutVsPriorHighPct ?? undefined,
      heartbeatAvgRangePct: heartbeatAvgRangePct ?? undefined,
      maSlopePct: maSlopePct ?? undefined,
    });
  }

  // Newest first for the table
  return events.reverse();
}
