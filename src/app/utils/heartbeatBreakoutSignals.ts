import type { HistoricalPriceBar } from './yahooHistoricalPrices';

export type ChartSignal = 'buy' | 'sell' | null;

export interface SignalAnnotatedBar extends HistoricalPriceBar {
  buyMarker?: number | null;
  sellMarker?: number | null;
  signal?: ChartSignal;
  /** Human-readable reason shown on hover. */
  signalNote?: string | null;
}

/**
 * Buy: 3-day “heartbeat” (tight consolidation), primary MA rising + price above it,
 * then a breakout to a new high vs the prior lookback window.
 * Sell: close crosses below the primary MA after trading above it.
 */
export function annotateHeartbeatBreakoutSignals(
  bars: HistoricalPriceBar[],
  opts?: {
    primaryMaKey?: 'sma30' | 'sma90';
    heartbeatDays?: number;
    heartbeatRangePct?: number;
    heartbeatChangePct?: number;
    slopeLookback?: number;
    breakoutLookback?: number;
  }
): SignalAnnotatedBar[] {
  const primaryMaKey = opts?.primaryMaKey ?? 'sma90';
  const heartbeatDays = opts?.heartbeatDays ?? 3;
  const heartbeatRangePct = opts?.heartbeatRangePct ?? 3.5;
  const heartbeatChangePct = opts?.heartbeatChangePct ?? 1.75;
  const slopeLookback = opts?.slopeLookback ?? 5;
  const breakoutLookback = opts?.breakoutLookback ?? 20;
  const maLabel = primaryMaKey === 'sma30' ? '30-day' : '90-day';

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
