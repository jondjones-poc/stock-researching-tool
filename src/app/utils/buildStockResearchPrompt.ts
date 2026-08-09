/** Prompt for deep research on a single stock / ETF. */

export interface StockResearchSnapshot {
  symbol: string;
  name?: string | null;
  price?: number | null;
  changePercent?: number | null;
  pe?: number | null;
  forwardPe?: number | null;
  marketCap?: number | null;
  freeCashFlow?: number | null;
  sector?: string | null;
  industry?: string | null;
  eps?: number | null;
  dividendYield?: number | null;
  periodLabel?: string;
  asOf?: string | null;
}

export function buildStockResearchPrompt(snapshot: StockResearchSnapshot): string {
  const symbol = snapshot.symbol.toUpperCase();
  const name = snapshot.name?.trim() || symbol;
  const money = (n: number | null | undefined, digits = 2) =>
    n == null || !Number.isFinite(n) ? 'unavailable' : n.toFixed(digits);
  const pct = (n: number | null | undefined) =>
    n == null || !Number.isFinite(n)
      ? 'unavailable'
      : `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
  const cap = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(n)) return 'unavailable';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString()}`;
  };

  const lines: string[] = [
    `You are an equity research analyst preparing a concise but rigorous research brief on ${name} (${symbol}).`,
    'Use the latest available public filings, earnings releases, guidance, sell-side consensus, and reputable news.',
    'Be specific with numbers, dates, and sources when possible. Flag uncertainty clearly.',
    '',
    '--- APP SNAPSHOT (may be incomplete — verify) ---',
    `Symbol: ${symbol}`,
    `Name: ${name}`,
    snapshot.periodLabel ? `Chart period viewed: ${snapshot.periodLabel}` : null,
    snapshot.asOf ? `Snapshot as of: ${snapshot.asOf}` : null,
    `Last price: $${money(snapshot.price)}`,
    `Recent change: ${pct(snapshot.changePercent)}`,
    `PE (TTM / current if known): ${money(snapshot.pe)}`,
    `Forward PE: ${money(snapshot.forwardPe)}`,
    `EPS (if known): ${money(snapshot.eps)}`,
    `Market cap: ${cap(snapshot.marketCap)}`,
    `Free cash flow (latest reported if known): ${cap(snapshot.freeCashFlow)}`,
    `Dividend yield: ${pct(snapshot.dividendYield)}`,
    snapshot.sector ? `Sector: ${snapshot.sector}` : null,
    snapshot.industry ? `Industry: ${snapshot.industry}` : null,
    '',
    '--- TASK ---',
    '1. **Business overview**: what does the company / ETF own or do? Who are customers/competitors? Moat in one paragraph.',
    '2. **Latest earnings**: summarize the most recent quarterly (or annual) results — revenue, EPS, margins, guidance beats/misses, management tone, and market reaction.',
    '3. **Free cash flow**: explain recent FCF / operating cash flow vs capex; quality of cash conversion; any FCF warnings (working capital, one-offs, high capex).',
    '4. **PE ratio explanation**: interpret current and forward PE vs history and peers; is valuation rich, fair, or cheap and why (growth, margins, rates, cyclicality).',
    '5. **Future projections**: consensus growth / EPS trajectory for next 1–2 years; key catalysts and what must go right.',
    '6. **Concerns / red flags**: balance sheet, dilution, competition, regulation, customer concentration, accounting, macro sensitivity, ETF concentration risks, etc.',
    '7. **Bottom line**: bull case, bear case, and what you would research next (filings, metrics, competitors).',
    '',
    '--- OUTPUT FORMAT ---',
    '### Headline',
    '[One sentence investment story]',
    '',
    '### Business',
    '[Short overview]',
    '',
    '### Latest earnings',
    '- [key points with dates/numbers]',
    '',
    '### Free cash flow',
    '- [FCF read and quality]',
    '',
    '### PE / valuation',
    '- [explanation vs peers/history]',
    '',
    '### Future projections',
    '- [consensus / catalysts]',
    '',
    '### Concerns',
    '- [risks to watch]',
    '',
    '### Bottom line',
    '- Bull: …',
    '- Bear: …',
    '- Next research steps: …',
  ].filter((line): line is string => line !== null);

  return lines.join('\n');
}
