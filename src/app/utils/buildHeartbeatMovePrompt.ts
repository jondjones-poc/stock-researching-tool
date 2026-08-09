import type { HeartbeatSignalEvent } from './heartbeatBreakoutSignals';

export interface HeartbeatMovePromptContext {
  symbol: string;
  name?: string | null;
  periodLabel?: string;
  event: HeartbeatSignalEvent;
}

/** Ask ChatGPT to explain a heartbeat / breakout move in Felix (Goat Academy) style. */
export function buildHeartbeatMovePrompt(ctx: HeartbeatMovePromptContext): string {
  const symbol = ctx.symbol.toUpperCase();
  const name = ctx.name?.trim() || symbol;
  const e = ctx.event;
  const money = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? 'n/a' : `$${n.toFixed(2)}`;
  const pct = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n) ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;

  const lines: string[] = [
    `You are explaining a chart move on ${name} (${symbol}) using Felix's investing framework from The Goat Academy.`,
    'Be practical and plain-English. Do not invent prices that contradict the snapshot below.',
    '',
    '--- GOAT ACADEMY / FELIX LENS (apply this) ---',
    '1. Neighbourhood first: is money still flowing into the sector, or is the neighbourhood being abandoned?',
    '2. Trend line: which side of the medium-term moving average is price on? Above = supportive; below = black ice.',
    '3. Pause vs crash: was the quiet/heartbeat period a healthy pause, or is selling panic / a crash?',
    '4. For buy/heartbeat breakouts: quiet consolidation → rising trend → breakout confirmation.',
    '5. For sells under the MA: first close back under the trend line after being above — caution until reclaim.',
    '',
    '--- SIGNAL SNAPSHOT (from my app) ---',
    `Symbol: ${symbol}`,
    `Name: ${name}`,
    ctx.periodLabel ? `Chart period viewed: ${ctx.periodLabel}` : null,
    `Signal type: ${e.type.toUpperCase()}`,
    `Signal date: ${e.date}`,
    `Price at signal: ${money(e.price)}`,
    `30-day MA: ${money(e.ma30)}`,
    `150-day MA: ${money(e.ma150)}`,
    `Volume that day: ${e.volume > 0 ? e.volume.toLocaleString() : 'n/a'}`,
    e.heartbeatStart ? `Heartbeat start: ${e.heartbeatStart}` : null,
    e.heartbeatEnd ? `Heartbeat end: ${e.heartbeatEnd}` : null,
    e.priorHigh != null ? `Prior breakout high: ${money(e.priorHigh)}` : null,
    e.breakoutVsPriorHighPct != null
      ? `Breakout vs prior high: ${pct(e.breakoutVsPriorHighPct)}`
      : null,
    e.heartbeatAvgRangePct != null
      ? `Avg heartbeat daily range: ${e.heartbeatAvgRangePct.toFixed(2)}%`
      : null,
    e.maSlopePct != null ? `MA slope into signal: ${pct(e.maSlopePct)}` : null,
    e.priorClose != null ? `Prior close (sell): ${money(e.priorClose)}` : null,
    e.distanceBelowMaPct != null ? `Distance vs MA (sell): ${pct(e.distanceBelowMaPct)}` : null,
    `Follow-through 5 sessions: ${pct(e.move5dPct)}`,
    `Follow-through 10 sessions: ${pct(e.move10dPct)}`,
    '',
    'App summary of the move:',
    e.summary,
    '',
    '--- TASK ---',
    'Explain this move to me as Felix would teach it:',
    '- What happened in simple story form (setup → trigger → what it means).',
    '- Neighbourhood check: what I should verify about sector money flow for this name.',
    '- Trend-line read using the 150-day MA in the snapshot (and confirm with other MAs if useful).',
    '- Pause vs crash / heartbeat quality.',
    '- What would confirm the signal vs invalidate it next.',
    '- Traffic-light style takeaway: GREEN / AMBER / RED for acting on this signal, with one sentence why.',
    '',
    'Keep it concise (roughly half a page). No generic textbook dump — tie every point to THIS move.',
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}
