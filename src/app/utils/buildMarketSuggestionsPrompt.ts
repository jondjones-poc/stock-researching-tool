/** Reference map of ~20 liquid US sector themes for a macro money-flow heatmap. */
export const CANONICAL_MARKET_THEMES = [
  { name: 'Big Tech', symbols: ['AAPL', 'MSFT', 'GOOGL'] },
  { name: 'AI & Semiconductors', symbols: ['NVDA', 'AMD', 'AVGO'] },
  { name: 'Cloud & Enterprise Software', symbols: ['CRM', 'ORCL', 'ADBE'] },
  { name: 'Consumer Staples', symbols: ['PG', 'KO', 'WMT'] },
  { name: 'Consumer Discretionary', symbols: ['AMZN', 'HD', 'MCD'] },
  { name: 'Healthcare', symbols: ['UNH', 'JNJ', 'LLY'] },
  { name: 'Biotech', symbols: ['AMGN', 'GILD', 'VRTX'] },
  { name: 'Financials & Banks', symbols: ['JPM', 'BAC', 'WFC'] },
  { name: 'Insurance & Asset Management', symbols: ['BRK.B', 'BLK', 'MET'] },
  { name: 'Energy', symbols: ['XOM', 'CVX', 'COP'] },
  { name: 'Utilities', symbols: ['NEE', 'DUK', 'SO'] },
  { name: 'Industrials', symbols: ['CAT', 'GE', 'HON'] },
  { name: 'Materials & Mining', symbols: ['LIN', 'FCX', 'NEM'] },
  { name: 'Real Estate & REITs', symbols: ['PLD', 'AMT', 'EQIX'] },
  { name: 'Telecom & Media', symbols: ['GOOGL', 'META', 'NFLX'] },
  { name: 'Defense & Aerospace', symbols: ['LMT', 'RTX', 'NOC'] },
  { name: 'Transportation', symbols: ['UNP', 'UPS', 'DAL'] },
  { name: 'Autos & EVs', symbols: ['TSLA', 'GM', 'F'] },
  { name: 'Payments & Fintech', symbols: ['V', 'MA', 'PYPL'] },
  { name: 'Emerging Markets', symbols: ['EEM', 'VWO', 'IEMG'] },
] as const;

export interface MarketForPrompt {
  name: string;
  stocks: string[];
}

export function buildMarketSuggestionsPrompt(markets: MarketForPrompt[]): string {
  const lines: string[] = [];

  lines.push(
    'You are a macro equity strategist helping build a US sector money-flow heatmap.',
    'Each market groups three large, liquid tickers that represent where capital is moving that day.',
    '',
    '--- MY CURRENT MARKETS ---'
  );

  if (markets.length === 0) {
    lines.push('(none yet)');
  } else {
    markets.forEach((m, i) => {
      lines.push(`${i + 1}. ${m.name}: ${m.stocks.join(', ')}`);
    });
    lines.push(`Total: ${markets.length} markets`);
  }

  lines.push('', '--- REFERENCE: TOP 20 MACRO THEMES ---');
  lines.push(
    'Use this as the target coverage map. Treat overlapping names as already covered (e.g. "Technology" ≈ Big Tech, "Chips" ≈ AI & Semiconductors).'
  );
  CANONICAL_MARKET_THEMES.forEach((t, i) => {
    lines.push(`${i + 1}. ${t.name} (example tickers: ${t.symbols.join(', ')})`);
  });

  lines.push(
    '',
    '--- TASK ---',
    '1. Compare my current markets to the reference themes above.',
    '2. Only suggest markets that are genuinely missing or materially under-covered — do NOT pad the list or suggest near-duplicates.',
    '3. Aim for up to 20 well-differentiated macro buckets in total. If I already cover ~18–20 distinct themes adequately, say so and return few or zero additions.',
    '4. For each suggested market provide:',
    '   - market name (short, clear label)',
    '   - exactly 3 US-listed, highly liquid symbols (large caps or sector ETFs where appropriate)',
    '   - one sentence on why it is distinct from what I already have',
    '5. Prefer sector leaders and ETFs investors actually use for macro reads (e.g. EEM for EM). Symbols must be valid US tickers.',
    '6. Be realistic: skip niche sub-sectors unless they are clearly absent from my list.',
    '',
    '--- OUTPUT FORMAT ---',
    'Start with a 2–3 sentence summary (how many gaps you see, overall coverage quality).',
    'Then list only missing markets in this exact markdown format:',
    '',
    '### Suggested market: [Name]',
    '- Symbols: SYM1, SYM2, SYM3',
    '- Why: [one sentence]',
    '',
    'If no meaningful gaps remain, say: "Coverage looks complete — no additional markets needed."'
  );

  return lines.join('\n');
}
