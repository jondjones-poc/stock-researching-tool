import { formatChangePct } from './marketHeatColor';
import {
  MARKET_PERIOD_OPTIONS,
  type MarketHeatmapPeriod,
} from './marketPeriods';

interface StockForMoneyFlowPrompt {
  symbol: string;
  name?: string;
  changePercent: number | null;
}

export interface MarketForMoneyFlowPrompt {
  name: string;
  stocks: StockForMoneyFlowPrompt[];
  meanChangePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

function periodLabel(period: MarketHeatmapPeriod): string {
  return MARKET_PERIOD_OPTIONS.find((o) => o.id === period)?.label ?? period;
}

function directionArrow(direction: MarketForMoneyFlowPrompt['direction']): string {
  if (direction === 'up') return '↑';
  if (direction === 'down') return '↓';
  if (direction === 'flat') return '→';
  return '?';
}

function formatStockLine(stock: StockForMoneyFlowPrompt, period: MarketHeatmapPeriod): string {
  const pct =
    stock.changePercent !== null ? formatChangePct(stock.changePercent) : 'change unavailable';
  const label = stock.name ? `${stock.symbol} (${stock.name})` : stock.symbol;
  const periodWord = period === 'today' ? 'today' : `over ${periodLabel(period).toLowerCase()}`;
  return `- ${label}: ${pct} ${periodWord}`;
}

export function buildMarketMoneyFlowPrompt(
  markets: MarketForMoneyFlowPrompt[],
  period: MarketHeatmapPeriod,
  fetchedAt?: string | null
): string {
  const sorted = [...markets].sort((a, b) => {
    const aPct = a.meanChangePct;
    const bPct = b.meanChangePct;
    if (aPct === null && bPct === null) return a.name.localeCompare(b.name);
    if (aPct === null) return 1;
    if (bPct === null) return -1;
    if (bPct !== aPct) return bPct - aPct;
    return a.name.localeCompare(b.name);
  });

  const up = sorted.filter((m) => m.direction === 'up');
  const down = sorted.filter((m) => m.direction === 'down');
  const flat = sorted.filter((m) => m.direction === 'flat' || m.direction === 'unknown');

  const allStocks = sorted.flatMap((m) =>
    m.stocks
      .filter((s) => s.changePercent !== null)
      .map((s) => ({ ...s, marketName: m.name }))
  );
  const topGainers = [...allStocks].sort((a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0)).slice(0, 8);
  const topLosers = [...allStocks].sort((a, b) => (a.changePercent ?? 0) - (b.changePercent ?? 0)).slice(0, 8);

  const periodWord = period === 'today' ? 'today' : `the ${periodLabel(period).toLowerCase()} period`;
  const newsWindow =
    period === 'today' ? 'the last 7 days' : 'recent weeks and the macro backdrop for this timeframe';

  const sectorLines = sorted.map((m, i) => {
    const mean =
      m.meanChangePct !== null ? formatChangePct(m.meanChangePct) : 'mean change unavailable';
    const stockSummary =
      m.stocks.length > 0
        ? m.stocks
            .map((s) => {
              const pct =
                s.changePercent !== null ? formatChangePct(s.changePercent) : '—';
              return `${s.symbol} ${pct}`;
            })
            .join(', ')
        : '(no stocks)';
    return `${i + 1}. ${m.name}: ${mean} ${directionArrow(m.direction)} — ${stockSummary}`;
  });

  const listMarkets = (group: MarketForMoneyFlowPrompt[]) =>
    group.length > 0
      ? group.map((m) => {
          const mean =
            m.meanChangePct !== null ? formatChangePct(m.meanChangePct) : 'change unavailable';
          return `- ${m.name}: ${mean} ${directionArrow(m.direction)}`;
        })
      : ['- (none)'];

  const listStocks = (stocks: typeof topGainers) =>
    stocks.length > 0
      ? stocks.map(
          (s) =>
            `- ${s.symbol}${s.name ? ` (${s.name})` : ''}: ${formatChangePct(s.changePercent!)} — in ${s.marketName}`
        )
      : ['- (no stock data)'];

  const lines: string[] = [
    'You are a US equity macro strategist reading a custom sector money-flow heatmap.',
    'Each market is a basket of large, liquid tickers representing a macro theme.',
    `Analyze where Wall Street money appears to be moving ${periodWord} and **why** — focus on sector rotation, risk-on vs risk-off, and the dominant narrative.`,
    '',
    '--- HEATMAP SNAPSHOT ---',
    `Period: ${periodLabel(period)}`,
    fetchedAt ? `Data as of: ${new Date(fetchedAt).toLocaleString()}` : 'Data as of: (not specified)',
    `Markets tracked: ${sorted.length}`,
    '',
    '--- ALL SECTORS (best → worst) ---',
    ...sectorLines,
    '',
    '--- MOVING UP ---',
    ...listMarkets(up),
    '',
    '--- MOVING DOWN ---',
    ...listMarkets(down),
  ];

  if (flat.length > 0) {
    lines.push('', '--- FLAT / MIXED ---', ...listMarkets(flat));
  }

  lines.push(
    '',
    '--- TOP INDIVIDUAL GAINERS ---',
    ...listStocks(topGainers),
    '',
    '--- TOP INDIVIDUAL LOSERS ---',
    ...listStocks(topLosers),
    '',
    '--- DETAIL BY SECTOR ---'
  );

  for (const market of sorted) {
    const mean =
      market.meanChangePct !== null ? formatChangePct(market.meanChangePct) : 'unavailable';
    lines.push(
      '',
      `### ${market.name} (${mean} ${directionArrow(market.direction)})`,
      ...(market.stocks.length > 0
        ? market.stocks.map((s) => formatStockLine(s, period))
        : ['- (no stocks in this basket)'])
    );
  }

  lines.push(
    '',
    '--- TASK ---',
    `1. Search and summarize the most relevant news and macro context from ${newsWindow} that explains this heatmap.`,
    '2. Identify the **overall theme**: where is money rotating *into* vs *out of*? Is this risk-on, defensive, growth-led, value-led, rates-sensitive, etc.?',
    '3. Explain **why** — connect sector winners and losers to concrete drivers (Fed/rates, earnings season, geopolitics, commodities, AI capex, consumer data, regulation, etc.).',
    '4. Call out **leadership vs laggards**: which baskets are leading the move and which stocks within them matter most?',
    '5. Note **contradictions or fragility** — anything that does not fit the main story, or risks that could reverse the trend.',
    '6. Give a concise **so-what for an investor**: what this implies for positioning and what to watch next (events, data, tickers).',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline (one sentence)',
    '[The dominant money-flow story in plain English]',
    '',
    '### Macro read',
    '[2–4 sentences: risk appetite, rotation, and the main “why”]',
    '',
    '### Winners & where money is going',
    '- [sectors/themes attracting capital and why]',
    '',
    '### Losers & where money is leaving',
    '- [sectors/themes under pressure and why]',
    '',
    '### Stock-level signals',
    '- [notable individual movers that confirm or complicate the theme]',
    '',
    '### Risks & watchlist',
    '- [what could change the narrative; key dates and data]',
    '',
    '### Research plan',
    '- [concrete next steps: sources, charts, filings, events]'
  );

  return lines.join('\n');
}
