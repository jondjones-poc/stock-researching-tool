export function buildMarketStockValidationPrompt(market: {
  name: string;
  stocks: string[];
}): string {
  const lines: string[] = [
    'You are a US equity sector analyst helping validate a macro heatmap basket.',
    'Each market groups liquid tickers that represent where money is flowing in that sector today.',
    '',
    `--- MARKET ---`,
    `Name: ${market.name}`,
    market.stocks.length > 0
      ? `Current symbols: ${market.stocks.join(', ')}`
      : 'Current symbols: (none yet)',
    '',
    '--- TASK ---',
    '1. Assess whether the current symbols (if any) are appropriate representatives of this sector for a daily money-flow heatmap.',
    '2. Identify any that are weak fits, duplicates of the same theme, too small/illiquid, or missing obvious sector leaders.',
    '3. Recommend US-listed symbols for the largest market-cap / highest market-share names in this sector — the stocks institutions actually use as sector proxies.',
    '4. Prefer 3–5 names unless the sector truly needs more; use sector ETFs only when they are the standard macro read (e.g. EEM for EM).',
    '5. Be realistic — do not suggest tickers just to fill a list. If the current basket is already solid, say so.',
    '',
    '--- OUTPUT FORMAT ---',
    '### Assessment',
    '[2–4 sentences on whether the current picks are correct]',
    '',
    '### Recommended symbols',
    'List the top market-share / market-cap tickers for this sector (comma-separated US symbols), e.g. AAPL, MSFT, GOOGL',
    '',
    '### Changes (if any)',
    '- Keep: [symbols to keep]',
    '- Add: [symbols to add, or "none"]',
    '- Remove/replace: [symbols to drop and why, or "none"]',
  ];

  return lines.join('\n');
}
