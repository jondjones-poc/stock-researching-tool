import {
  MARKET_FLOW_PERIOD_LABELS,
  type MarketFlowPeriod,
} from '../config/marketFlow';
import { formatPct, type MarketFlowHoldingSummary } from './marketFlowFormat';

export interface MarketFlowAskAiCard {
  slug: string;
  market: string;
  region: string;
  capType: 'large' | 'small';
  symbol: string;
  fundName: string;
  returnPct: number | null;
  relativeToSpy: number | null;
  spyReturn: number | null;
  spread: number | null;
  price: number | null;
  leader: boolean;
  holdings: MarketFlowHoldingSummary[];
  peer?: {
    symbol: string;
    fundName: string;
    returnPct: number | null;
    relativeToSpy: number | null;
    leader: boolean;
  } | null;
  context?: {
    period: MarketFlowPeriod;
    lastUpdated: string | null;
    strongestLarge: string | null;
    strongestSmall: string | null;
    bestMarket: string | null;
    worstMarket: string | null;
  };
}

/**
 * Clipboard prompt for ChatGPT / Claude about why a market/cap sleeve is leading,
 * which stocks and sectors are likely driving it, and whether it looks investable.
 */
export function buildMarketFlowAskAiPrompt(card: MarketFlowAskAiCard): string {
  const period = card.context?.period ?? '1m';
  const periodLabel = MARKET_FLOW_PERIOD_LABELS[period];
  const capLabel = card.capType === 'large' ? 'large-cap' : 'small-cap';
  const ret = formatPct(card.returnPct);
  const direction =
    card.returnPct == null ? 'unknown' : card.returnPct > 0.25 ? 'up' : card.returnPct < -0.25 ? 'down' : 'flat';

  const lines: string[] = [
    'You are a global equity strategist helping me decide whether a market opportunity is worth researching further.',
    'I track **price momentum** of liquid country/region ETFs (large-cap vs small-cap). This is **not** confirmed investor cash flow.',
    '',
    '--- FOCUS ---',
    `Market: ${card.market} (${card.region})`,
    `Sleeve: ${capLabel}`,
    `ETF: ${card.symbol} — ${card.fundName}`,
    `Return over ${periodLabel}: ${ret} (${direction})`,
    `vs SPY over same period: ${formatPct(card.relativeToSpy)} (SPY ${formatPct(card.spyReturn)})`,
    `Large-cap minus small-cap spread in this market: ${formatPct(card.spread)}`,
    card.price != null ? `Last price: $${card.price.toFixed(2)}` : 'Last price: unavailable',
    `Within this market, this sleeve is: ${card.leader ? 'LEADING the other cap size' : 'TRAILING the other cap size (or tie/n/a)'}`,
  ];

  if (card.holdings.length > 0) {
    lines.push('', '--- CACHED TOP HOLDINGS (use these as the primary stock list) ---');
    for (const h of card.holdings.slice(0, 10)) {
      const w = h.weightPct != null ? `${h.weightPct.toFixed(2)}%` : 'weight n/a';
      lines.push(`${h.rank}. ${h.symbol} — ${h.name || 'n/a'} (${w})`);
    }
  }

  if (card.peer) {
    lines.push(
      '',
      '--- SAME MARKET, OTHER SLEEVE ---',
      `${card.peer.symbol} (${card.peer.fundName}): ${formatPct(card.peer.returnPct)}` +
        ` · vs SPY ${formatPct(card.peer.relativeToSpy)}` +
        (card.peer.leader ? ' — currently leading' : '')
    );
  }

  if (card.context) {
    lines.push(
      '',
      '--- DASHBOARD CONTEXT ---',
      `Period: ${periodLabel}`,
      card.context.lastUpdated
        ? `Data as of: ${new Date(card.context.lastUpdated).toLocaleString()}`
        : 'Data as of: (not specified)',
      `Strongest large-cap market: ${card.context.strongestLarge ?? '—'}`,
      `Strongest small-cap market: ${card.context.strongestSmall ?? '—'}`,
      `Best overall market (avg of sleeves): ${card.context.bestMarket ?? '—'}`,
      `Worst overall market: ${card.context.worstMarket ?? '—'}`
    );
  }

  lines.push(
    '',
    '--- TASK ---',
    `1. Search and summarize the main reasons ${card.market} ${capLabel} equities (proxied by ${card.symbol}) have been ${direction === 'up' ? 'outperforming' : direction === 'down' ? 'underperforming' : 'range-bound'} over ${periodLabel.toLowerCase()}.`,
    '2. Using the **cached top holdings** above (and adding others only if needed), identify which stocks are most likely driving the move. Give one line per ticker.',
    '3. Break down **sectors / industries** that are leading vs lagging inside this market.',
    '4. Interpret **vs SPY**: is this true outperformance, or just riding a rising US market?',
    '5. Interpret the **large vs small spread**: narrow (LC leads) vs broad (SC leads) and what that usually implies.',
    '6. Separate **structural** drivers from **temporary** ones.',
    '7. Give a blunt **investability check**: momentum chase, mean-reversion trap, or researchable thesis?',
    '8. Suggest a short **next-step research plan** using free sources only.',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline',
    '[One sentence: why this market/sleeve is moving]',
    '',
    '### Why it is moving',
    '- [2–5 concrete drivers]',
    '',
    '### vs SPY',
    '[Is this real relative strength?]',
    '',
    '### Breadth (large vs small)',
    '[Narrow vs broad read]',
    '',
    '### Stocks pushing it (from holdings)',
    '- TICKER — role / why',
    '',
    '### Sectors leading / lagging',
    '- Leading: ...',
    '- Lagging: ...',
    '',
    '### Invest or pass?',
    '[Honest take + key risks]',
    '',
    '### Free research checklist',
    '- [specific links/queries to run next]'
  );

  return lines.join('\n');
}
