import type { HeartbeatSignalEvent } from './heartbeatBreakoutSignals';

export interface SignalRiskPromptContext {
  symbol: string;
  name?: string | null;
  sector?: string | null;
  industry?: string | null;
  periodLabel?: string;
  event: HeartbeatSignalEvent;
}

export interface SignalRiskSection {
  score: number | null;
  text: string;
}

export interface SignalRiskAssessment {
  score: number;
  neighbourhood: SignalRiskSection;
  trend: SignalRiskSection;
  pauseVsCrash: SignalRiskSection;
  overall: string;
  source: 'local' | 'ai';
}

export type ConfirmationLabel =
  | 'Strongly Confirmed'
  | 'Confirmed'
  | 'Mixed / unclear'
  | 'Invalidated'
  | 'Not enough data yet';

export interface SignalConfirmation {
  label: ConfirmationLabel;
  text: string;
  move5dPct: number | null;
  move10dPct: number | null;
  reclaimedPrimaryMa: boolean | null;
}

function money(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? 'unavailable' : `$${n.toFixed(2)}`;
}

function pct(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? 'unavailable' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function clampScore(n: number): number {
  return Math.round(Math.min(10, Math.max(1, n)) * 10) / 10;
}

/** Traffic-band emoji for sell (danger) or buy (opportunity). */
export function signalRiskBandEmoji(score: number, type: 'buy' | 'sell'): string {
  if (type === 'buy') {
    if (score < 4) return '🔴';
    if (score < 7) return '🟡';
    if (score < 8) return '🟠';
    return '🟢';
  }
  if (score < 4) return '🟢';
  if (score < 7) return '🟡';
  if (score < 8) return '🟠';
  return '🔴';
}

export function signalRiskBandLabel(score: number, type: 'buy' | 'sell'): string {
  if (type === 'sell') {
    if (score < 4) return 'Weak warning / probably noise';
    if (score < 6) return 'Worth watching';
    if (score < 7) return 'Genuine caution';
    if (score < 8) return 'Meaningful warning';
    if (score < 9) return 'Strong sell / risk signal';
    if (score < 10) return 'Strongly confirmed breakdown pattern (signal-date)';
    return 'Exceptionally clear breakdown (signal-date)';
  }
  if (score < 4) return 'Weak buy evidence';
  if (score < 6) return 'Worth watching';
  if (score < 7) return 'Decent setup';
  if (score < 8) return 'Meaningful buy evidence';
  if (score < 9) return 'Strong buy / opportunity signal';
  if (score < 10) return 'Strongly confirmed breakout pattern (signal-date)';
  return 'Exceptionally clear breakout (signal-date)';
}

/**
 * Instant app-side score using only signal-date fields (not later price action).
 * Sector neighbourhood is marked unavailable unless provided later by AI.
 */
export function computeLocalSignalRisk(
  event: HeartbeatSignalEvent,
  opts?: { sector?: string | null }
): SignalRiskAssessment {
  const isSell = event.type === 'sell';
  let trend = 5;
  let pause = 5;
  let setup = 5;

  if (isSell) {
    // First close under primary MA after being above
    if (event.priorClose != null && event.distMa150Pct != null && event.distMa150Pct < 0) {
      trend = 7.5;
      if (event.distMa90Pct != null && event.distMa90Pct < 0) trend += 0.5;
      if (event.distMa30Pct != null && event.distMa30Pct < 0) trend += 0.8;
      else if (event.distMa30Pct != null && event.distMa30Pct > 0) trend -= 0.4; // 30d still held
    } else if (event.distMa150Pct != null && event.distMa150Pct < 0) {
      trend = 6.5;
    }

    const vol = event.volumeVsAvgPct;
    if (vol == null) pause = 6;
    else if (vol > 80) pause = 8; // heavy selling
    else if (vol > 30) pause = 6.5;
    else if (vol < -20) pause = 5; // not panic
    else pause = 6;

    setup = (trend + pause) / 2;
  } else {
    // Buy: heartbeat + breakout quality
    setup = 6;
    if (event.heartbeatAvgRangePct != null && event.heartbeatAvgRangePct < 2.5) setup += 0.8;
    if (event.breakoutVsPriorHighPct != null && event.breakoutVsPriorHighPct > 0) setup += 0.6;
    if (event.maSlopePct != null && event.maSlopePct > 0) setup += 0.5;
    if (event.distMa150Pct != null && event.distMa150Pct > 0) trend = 7;
    else trend = 5;
    if (event.distMa30Pct != null && event.distMa30Pct > 0) trend += 0.5;

    const vol = event.volumeVsAvgPct;
    if (vol != null && vol > 20) pause = 7; // supportive volume on breakout
    else if (vol != null && vol < -30) pause = 4.5;
    else pause = 6;
  }

  const neighbourhoodUnavailable = !opts?.sector;
  const neighbourhoodScore = neighbourhoodUnavailable ? null : 5;
  const neighbourhoodText = neighbourhoodUnavailable
    ? 'Sector money-flow (neighbourhood) is unavailable in the app snapshot — verify with ChatGPT / your sector lens before acting.'
    : `Sector tagged ${opts?.sector}. Confirm whether money is still flowing into this neighbourhood.`;

  const parts = [trend, pause, setup].filter((n) => Number.isFinite(n));
  const score = clampScore(parts.reduce((a, b) => a + b, 0) / parts.length);

  const trendText = isSell
    ? `${clampScore(trend)}/10 — First close back under the main trend MA after previously trading above is Felix’s “black ice” warning` +
      (event.distMa30Pct != null && event.distMa30Pct > 0
        ? '; the 30-day MA had not yet broken, so this is serious but not a full multi-MA collapse.'
        : '.')
    : `${clampScore(trend)}/10 — Price held above the rising medium-term MA into the breakout` +
      (event.maSlopePct != null ? ` (MA slope ${pct(event.maSlopePct)}).` : '.');

  const pauseText = isSell
    ? `${clampScore(pause)}/10 — ` +
      (event.volumeVsAvgPct != null && event.volumeVsAvgPct > 50
        ? 'Volume was elevated vs recent average, leaning toward heavier selling rather than a quiet dip.'
        : 'Volume did not clearly show panic; treat as a trend break to watch, not automatic crash confirmation.')
    : `${clampScore(pause)}/10 — ` +
      (event.heartbeatAvgRangePct != null
        ? `Quiet ${event.heartbeatAvgRangePct.toFixed(1)}% average heartbeat range preceded the breakout` +
          (event.volumeVsAvgPct != null ? `; breakout volume ${pct(event.volumeVsAvgPct)} vs 20-day avg.` : '.')
        : 'Heartbeat/breakout volume context is limited in this window.');

  const overall = isSell
    ? `${score.toFixed(1)}/10 — ${signalRiskBandLabel(score, 'sell')}. Trend has broken; treat as black ice until price reclaims the main MA with strength. Neighbourhood still needs a manual check.`
    : `${score.toFixed(1)}/10 — ${signalRiskBandLabel(score, 'buy')}. Heartbeat → trend → breakout looks constructive on price alone; confirm sector money flow before treating as green light.`;

  return {
    score,
    neighbourhood: { score: neighbourhoodScore, text: neighbourhoodText },
    trend: { score: clampScore(trend), text: trendText },
    pauseVsCrash: { score: clampScore(pause), text: pauseText },
    overall,
    source: 'local',
  };
}

/** Later price action only — never used to change the original score. */
export function computeSignalConfirmation(event: HeartbeatSignalEvent): SignalConfirmation {
  const move5dPct = event.move5dPct ?? null;
  const move10dPct = event.move10dPct ?? null;
  const reclaimedPrimaryMa = event.reclaimedPrimaryMa ?? null;
  const type = event.type;
  if (move5dPct == null && move10dPct == null) {
    return {
      label: 'Not enough data yet',
      text: 'Not enough later sessions in this chart window to judge confirmation.',
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
    };
  }

  const m5 = move5dPct ?? 0;
  const m10 = move10dPct ?? m5;

  if (type === 'sell') {
    if (reclaimedPrimaryMa) {
      return {
        label: 'Invalidated',
        text: `Price later reclaimed the broken MA. 5 sessions ${pct(move5dPct)}, 10 sessions ${pct(move10dPct)}. The original warning did not hold as a clean breakdown.`,
        move5dPct,
        move10dPct,
        reclaimedPrimaryMa,
      };
    }
    if (m5 <= -8 || m10 <= -12) {
      return {
        label: 'Strongly Confirmed',
        text: `Price fell ${pct(move5dPct)} over five sessions and ${pct(move10dPct)} over ten. The original trend-break warning proved meaningful.`,
        move5dPct,
        move10dPct,
        reclaimedPrimaryMa,
      };
    }
    if (m5 < -2 || m10 < -3) {
      return {
        label: 'Confirmed',
        text: `Follow-through was lower (${pct(move5dPct)} / ${pct(move10dPct)}) without reclaiming the MA — supportive of the warning.`,
        move5dPct,
        move10dPct,
        reclaimedPrimaryMa,
      };
    }
    return {
      label: 'Mixed / unclear',
      text: `Later returns were muted (${pct(move5dPct)} / ${pct(move10dPct)}). The signal-date warning still stands on its own; follow-through was not decisive.`,
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
    };
  }

  // buy
  if (m5 >= 5 || m10 >= 8) {
    return {
      label: 'Strongly Confirmed',
      text: `Price rose ${pct(move5dPct)} over five sessions and ${pct(move10dPct)} over ten — strong follow-through after the heartbeat breakout.`,
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
    };
  }
  if (m5 > 0 || m10 > 1) {
    return {
      label: 'Confirmed',
      text: `Modest positive follow-through (${pct(move5dPct)} / ${pct(move10dPct)}) after the breakout.`,
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
    };
  }
  if (m5 < -5 || m10 < -8) {
    return {
      label: 'Invalidated',
      text: `Price reversed after the breakout (${pct(move5dPct)} / ${pct(move10dPct)}). The buy evidence on the signal date did not get clean follow-through.`,
      move5dPct,
      move10dPct,
      reclaimedPrimaryMa,
    };
  }
  return {
    label: 'Mixed / unclear',
    text: `Later returns were mixed (${pct(move5dPct)} / ${pct(move10dPct)}). Do not rewrite the original signal-date score from this.`,
    move5dPct,
    move10dPct,
    reclaimedPrimaryMa,
  };
}

export function buildSignalRiskPrompt(ctx: SignalRiskPromptContext): string {
  const symbol = ctx.symbol.toUpperCase();
  const name = ctx.name?.trim() || symbol;
  const e = ctx.event;

  const history =
    e.recentBars && e.recentBars.length > 0
      ? e.recentBars
          .map(
            (b) =>
              `  ${b.date}: close ${money(b.close)}, vol ${b.volume > 0 ? b.volume.toLocaleString() : 'n/a'}, day ${pct(b.changePercent)}`
          )
          .join('\n')
      : '  unavailable';

  const lines: string[] = [
    `Score how seriously I should take this ${e.type.toUpperCase()} signal on ${name} (${symbol}) using Felix / The Goat Academy.`,
    '',
    'CRITICAL RULES:',
    '- Judge using information available ON THE SIGNAL DATE only for the original score.',
    '- Do NOT use later price action when calculating the original 1–10 score.',
    '- Later 5d/10d returns are for a separate Confirmation section only.',
    '- If sector flow or any MA is unavailable, say so — do not invent it.',
    '- The score is strength of evidence, NOT a statistical probability (8/10 ≠ 80% chance).',
    '',
    '--- FELIX / GOAT ACADEMY FRAMEWORK ---',
    '1. Neighbourhood first — is money flowing into the sector/industry or rotating out?',
    '2. Trend line — side of 30d / 90d / 150d MAs. First close below main MA after being above = “black ice”.',
    '3. Pause vs crash — healthy consolidation / pullback / weakening / breakdown / panic (use volume).',
    '4. BUY: quiet heartbeat → rising trend → breakout with supportive volume.',
    '5. SELL: first close back under main MA; stronger if weak sector, multiple MAs lost, heavy volume, support breaks.',
    '',
    '--- SCORE SCALE ---',
    e.type === 'sell'
      ? 'SELL: 1–3 noise, 4–5 watch, 6 caution, 7 meaningful warning, 8 strong risk, 9–10 clear breakdown evidence (signal-date).'
      : 'BUY: higher score = stronger BUY evidence (same numeric bands, opportunity not danger).',
    '',
    '--- SIGNAL-DATE SNAPSHOT (app) ---',
    `Ticker: ${symbol}`,
    `Name: ${name}`,
    `Sector: ${ctx.sector || 'unavailable'}`,
    `Industry: ${ctx.industry || 'unavailable'}`,
    `Signal type: ${e.type.toUpperCase()}`,
    `Signal date: ${e.date}`,
    `Signal price: ${money(e.price)}`,
    `Prior close: ${money(e.priorClose ?? null)}`,
    `30-day MA: ${money(e.ma30)} (${pct(e.distMa30Pct)} vs price)`,
    `90-day MA: ${money(e.ma90)} (${pct(e.distMa90Pct)} vs price)`,
    `150-day MA: ${money(e.ma150)} (${pct(e.distMa150Pct)} vs price)`,
    `Volume: ${e.volume > 0 ? e.volume.toLocaleString() : 'unavailable'}`,
    `20-day avg volume: ${e.avgVolume20 != null ? Math.round(e.avgVolume20).toLocaleString() : 'unavailable'}`,
    `Volume vs avg: ${pct(e.volumeVsAvgPct)}`,
    e.heartbeatStart ? `Heartbeat: ${e.heartbeatStart} → ${e.heartbeatEnd || '?'}` : null,
    e.priorHigh != null ? `Prior high / breakout: ${money(e.priorHigh)} (${pct(e.breakoutVsPriorHighPct)})` : null,
    e.heartbeatAvgRangePct != null
      ? `Heartbeat avg daily range: ${e.heartbeatAvgRangePct.toFixed(2)}%`
      : null,
    `Sector ETF / sector performance: unavailable in app — research if needed`,
    `Market performance on signal date: unavailable in app — research if needed`,
    '',
    'Recent price/volume (includes signal day; do not use post-signal bars for the score):',
    history,
    '',
    '--- LATER FOLLOW-THROUGH (confirmation only; do NOT change original score) ---',
    `5-session return: ${pct(e.move5dPct)}`,
    `10-session return: ${pct(e.move10dPct)}`,
    `Reclaimed primary MA later: ${
      e.reclaimedPrimaryMa == null ? 'unavailable' : e.reclaimedPrimaryMa ? 'yes' : 'no'
    }`,
    '',
    'App narrative (signal-date context):',
    e.summary,
    '',
    '--- REQUIRED OUTPUT ---',
    'Return ONLY a JSON object (no markdown fences) with this shape:',
    '{',
    '  "score": 7.5,',
    '  "neighbourhood": { "score": 7, "text": "one or two sentences" },',
    '  "trend": { "score": 8, "text": "one or two sentences" },',
    '  "pauseVsCrash": { "score": 6, "text": "one or two sentences" },',
    '  "overall": "one or two sentences with the score and plain-English takeaway",',
    '  "confirmation": { "label": "Strongly Confirmed|Confirmed|Mixed / unclear|Invalidated|Not enough data yet", "text": "one or two sentences on later price only" }',
    '}',
    '',
    'Answer the question: “How seriously should I take this signal right now?” in under 10 seconds of reading.',
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}

/** Parse ChatGPT JSON (raw or fenced) into an assessment. */
export function parseSignalRiskAiResponse(raw: string): {
  assessment: SignalRiskAssessment;
  confirmation?: { label: string; text: string };
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let jsonText = trimmed;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) jsonText = fence[1].trim();
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    const data = JSON.parse(jsonText.slice(start, end + 1)) as {
      score?: number;
      neighbourhood?: { score?: number; text?: string };
      trend?: { score?: number; text?: string };
      pauseVsCrash?: { score?: number; text?: string };
      overall?: string;
      confirmation?: { label?: string; text?: string };
    };
    if (data.score == null || !Number.isFinite(Number(data.score))) return null;
    return {
      assessment: {
        score: clampScore(Number(data.score)),
        neighbourhood: {
          score: data.neighbourhood?.score ?? null,
          text: data.neighbourhood?.text || '—',
        },
        trend: {
          score: data.trend?.score ?? null,
          text: data.trend?.text || '—',
        },
        pauseVsCrash: {
          score: data.pauseVsCrash?.score ?? null,
          text: data.pauseVsCrash?.text || '—',
        },
        overall: data.overall || `${clampScore(Number(data.score)).toFixed(1)}/10`,
        source: 'ai',
      },
      confirmation: data.confirmation?.text
        ? {
            label: data.confirmation.label || 'Mixed / unclear',
            text: data.confirmation.text,
          }
        : undefined,
    };
  } catch {
    return null;
  }
}
