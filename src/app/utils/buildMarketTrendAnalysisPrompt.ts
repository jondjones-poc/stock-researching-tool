import { formatChangePct } from './marketHeatColor';

interface StockForTrendPrompt {
  symbol: string;
  name?: string;
  changePercent: number | null;
}

export interface MarketForTrendPrompt {
  name: string;
  stocks: StockForTrendPrompt[];
  meanChangePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

export function buildMarketTrendAnalysisPrompt(market: MarketForTrendPrompt): string {
  const directionLabel =
    market.direction === 'up'
      ? 'up (positive)'
      : market.direction === 'down'
        ? 'down (negative)'
        : market.direction === 'flat'
          ? 'flat'
          : 'unknown';

  const meanLabel =
    market.meanChangePct !== null ? formatChangePct(market.meanChangePct) : 'unavailable';

  const stockLines =
    market.stocks.length > 0
      ? market.stocks.map((s) => {
          const pct =
            s.changePercent !== null ? formatChangePct(s.changePercent) : 'change unavailable';
          const label = s.name ? `${s.symbol} (${s.name})` : s.symbol;
          return `- ${label}: ${pct} today`;
        })
      : ['- (no stocks in this basket yet)'];

  const lines: string[] = [
    'You are a US equity macro analyst helping explain short-term sector money flows.',
    'Use recent news and market context — focus on developments from the **last 7 days**.',
    '',
    '--- SECTOR ---',
    `Name: ${market.name}`,
    `Today's mean move: ${meanLabel}`,
    `Direction: ${directionLabel}`,
    '',
    '--- STOCKS IN THIS BASKET ---',
    ...stockLines,
    '',
    '--- TASK ---',
    '1. Search and summarize the most relevant news from the past week affecting this sector and these tickers (earnings, guidance, macro, regulation, commodities, rates, geopolitics, sector rotation, etc.).',
    '2. Form a clear **hypothesis** for why this sector is moving in this direction today — what is the dominant narrative?',
    '3. Explain the **reasons behind** the move: which stories or data points are driving it, and which stocks in the basket are leading vs lagging?',
    '4. Note any **risks or counter-narratives** that could reverse the trend.',
    '5. Give a practical **research plan**: specific filings, earnings calls, data releases, charts, and trusted sources to dig deeper (include ticker-level angles where useful).',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline (one sentence)',
    '[The single best explanation in plain English]',
    '',
    '### News recap (last 7 days)',
    '- [bullet per major story, with date if known]',
    '',
    '### Hypothesis',
    '[2–4 sentences on why this trend exists]',
    '',
    '### Drivers & stock-level read',
    '- [what is moving the sector and which symbols matter most]',
    '',
    '### How to research further',
    '- [concrete next steps: sources, metrics, events to watch]',
  ];

  return lines.join('\n');
}
