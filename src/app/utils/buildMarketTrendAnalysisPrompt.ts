import { formatChangePct } from './marketHeatColor';
import {
  MARKET_PERIOD_OPTIONS,
  type MarketHeatmapPeriod,
} from './marketPeriods';

interface StockForTrendPrompt {
  symbol: string;
  name?: string;
  changePercent: number | null;
}

export interface MarketForTrendPrompt {
  name: string;
  index_symbol?: string | null;
  index_is_proxy?: boolean;
  stocks: StockForTrendPrompt[];
  meanChangePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

function periodLabel(period: MarketHeatmapPeriod): string {
  return MARKET_PERIOD_OPTIONS.find((o) => o.id === period)?.label ?? period;
}

export function buildMarketTrendAnalysisPrompt(
  market: MarketForTrendPrompt,
  period: MarketHeatmapPeriod = 'today',
  context?: { regionLabel?: string; view?: string }
): string {
  const directionLabel =
    market.direction === 'up'
      ? 'up (money flowing in / positive)'
      : market.direction === 'down'
        ? 'down (money flowing out / negative)'
        : market.direction === 'flat'
          ? 'flat (little net flow)'
          : 'unknown';

  const meanLabel =
    market.meanChangePct !== null ? formatChangePct(market.meanChangePct) : 'unavailable';

  const periodWord =
    period === 'today' ? 'today' : `over the ${periodLabel(period).toLowerCase()} period`;
  const newsWindow =
    period === 'today' || period === '1w' || period === '2w'
      ? 'the last 7–14 days'
      : 'recent weeks and the macro backdrop for this timeframe';

  const stockLines =
    market.stocks.length > 0
      ? market.stocks.map((s) => {
          const pct =
            s.changePercent !== null ? formatChangePct(s.changePercent) : 'change unavailable';
          const label = s.name ? `${s.symbol} (${s.name})` : s.symbol;
          return `- ${label}: ${pct} ${periodWord}`;
        })
      : ['- (no tickers in this basket yet)'];

  const ranked = [...market.stocks]
    .filter((s) => s.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent!) - Math.abs(a.changePercent!));

  const lines: string[] = [
    'You are a US equity sector strategist explaining institutional money flow in one sector heatmap card.',
    `Use recent news and market context from ${newsWindow}.`,
    '',
    '--- SECTOR CARD ---',
    `Sector: ${market.name}`,
    context?.regionLabel ? `Region / country lens: ${context.regionLabel}` : null,
    context?.view ? `View: ${context.view}` : null,
    `Period: ${periodLabel(period)}`,
    `Mean move ${periodWord}: ${meanLabel}`,
    `Direction: ${directionLabel}`,
    market.index_symbol
      ? `Primary ETF / index proxy: ${market.index_symbol}${market.index_is_proxy ? ' (broad country proxy — interpret carefully)' : ''}`
      : null,
    '',
    '--- TICKERS ON THIS CARD ---',
    ...stockLines,
    '',
    ranked.length > 0
      ? `Largest absolute movers on the card: ${ranked
          .slice(0, 5)
          .map((s) => `${s.symbol} ${formatChangePct(s.changePercent!)}`)
          .join(', ')}`
      : null,
    '',
    '--- TASK ---',
    `1. **Explain the trend** for ${market.name} ${periodWord} in plain English — what is happening on this card?`,
    '2. **Why is money flowing in or going away?** Tie the direction to concrete drivers (earnings, guidance, Fed/rates, commodities, geopolitics, AI capex, regulation, sector rotation, risk-on/off). Say whether this looks like institutional accumulation, distribution, or noise.',
    '3. Call out which tickers on the card are **leading** the move vs **lagging**, and what that implies.',
    '4. Note **risks / counter-narratives** that could reverse the flow.',
    '5. Recommend the **3 best stocks for further research** right now related to this sector theme. Prefer liquid names with a clear angle (leadership, pure-play, earnings catalyst, valuation dislocation, or recovery). Use names on the card when they deserve it; otherwise suggest better sector peers. For each, give a one-line research thesis and what to check next.',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline (one sentence)',
    '[The trend in plain English]',
    '',
    '### Trend explanation',
    '[2–4 sentences: what the heatmap is showing for this sector]',
    '',
    '### Why money is flowing in / going away',
    '- [driver 1]',
    '- [driver 2]',
    '- [driver 3]',
    '',
    '### Leaders vs laggards on this card',
    '- [ticker — role in the move]',
    '',
    '### Risks',
    '- [what could reverse the flow]',
    '',
    '### Top 3 stocks for further research',
    '1. TICKER — thesis; what to research next',
    '2. TICKER — thesis; what to research next',
    '3. TICKER — thesis; what to research next',
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}
