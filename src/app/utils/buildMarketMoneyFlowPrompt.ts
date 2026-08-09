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
  fetchedAt?: string | null,
  context?: { regionLabel?: string; view?: string }
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
    'Each market is a basket of large, liquid tickers or country/region ETF proxies representing a macro theme.',
    `Analyze where Wall Street money appears to be moving ${periodWord} and **why** — focus on sector rotation, risk-on vs risk-off, and the dominant narrative.`,
    '',
    '--- HEATMAP SNAPSHOT ---',
    `Period: ${periodLabel(period)}`,
    context?.regionLabel ? `Region / country lens: ${context.regionLabel}` : null,
    context?.view ? `View: ${context.view}` : null,
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
  ].filter((line): line is string => line !== null);

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
    `1. **Validate the findings**: do the heatmap rankings look coherent? Call out data quirks, proxy ETFs that may misrepresent the sector, thin coverage, or contradictions vs recent news from ${newsWindow}.`,
    '2. Identify the **overall theme**: where is institutional / Wall Street money rotating *into* vs *out of*? Risk-on, defensive, growth, value, rates-sensitive, commodities, AI capex, etc.',
    '3. Explain **why** — connect winners and losers to concrete drivers (Fed/rates, earnings, geopolitics, commodities, consumer data, regulation).',
    '4. **Areas to invest in (follow the money)**: rank 3–6 sectors/themes from this heatmap worth leaning into now, with the ETF/ticker evidence from the data and the thesis.',
    '5. **Areas to avoid / underweight**: rank 3–6 sectors/themes to avoid or reduce, with evidence and the risk.',
    '6. Note **fragility**: what would reverse this map; key events, data, or tickers to watch.',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline (one sentence)',
    '[The dominant money-flow story in plain English]',
    '',
    '### Validation',
    '- [what looks solid vs what to take with caution in this heatmap]',
    '',
    '### Macro read',
    '[2–4 sentences: risk appetite, rotation, and the main “why”]',
    '',
    '### Invest — follow Wall Street money',
    '- [sector/theme + why + supporting tickers/ETFs from the data]',
    '',
    '### Avoid — leave / underweight',
    '- [sector/theme + why + supporting tickers/ETFs from the data]',
    '',
    '### Risks & watchlist',
    '- [what could change the narrative; key dates and data]',
    '',
    '### Research plan',
    '- [concrete next steps: sources, charts, filings, events]'
  );

  return lines.join('\n');
}
