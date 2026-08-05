/**
 * Clipboard prompt for ChatGPT / Claude: validate deep-value thinking and overview a name.
 */

export interface CompanyFinderAskAiRow {
  ticker: string;
  name: string | null;
  sector: string | null;
  country: string | null;
  price: number | null;
  marketCap: number | null;
  cash: number | null;
  cashAsOf: string | null;
  totalDebt: number | null;
  totalDebtAsOf: string | null;
  netCash: number | null;
  fcfYtd: number | null;
  fcfPeriod: string | null;
  fcfAsOf: string | null;
  ocfYtd: number | null;
  ocfPeriod: string | null;
  cashToMarketPct: number | null;
  fcfToMarketPct: number | null;
  minCashToMarketPct: number;
  minFcfToMarketPct: number;
  /** 0 = no percentage threshold. */
  minNetCashToMarketPct: number;
  /** True when rows without a SEC Total Debt fact were kept in the results. */
  includeMissingNetCash: boolean;
  minConfidenceStars: number;
  filterSector: string | null;
  filterCountry: string | null;
  confidenceScore: number | null;
  confidenceStars: number | null;
  confidenceLatestFilingDate: string | null;
  confidenceReasons: Array<{ code: string; message: string; points: number }>;
}

function money(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function pct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'n/a';
  return `${value.toFixed(1)}%`;
}

export function buildCompanyFinderAskAiPrompt(row: CompanyFinderAskAiRow): string {
  const lines: string[] = [
    `You are an equity research analyst helping me decide whether ${row.ticker} is worth deeper research.`,
    'I found this name on a **deep value / cash-backed screen** (not investment advice). Please validate that thinking and give a clear overview.',
    '',
    '--- SCREEN SNAPSHOT (from my research app cache) ---',
    `Ticker: ${row.ticker}`,
    `Name: ${row.name || 'n/a'}`,
    `Sector: ${row.sector || 'n/a'}`,
    `Country: ${row.country || 'n/a'}`,
    `Price: ${row.price != null ? `$${row.price.toFixed(2)}` : 'n/a'}`,
    `Market cap: ${money(row.marketCap)}`,
    `Cash (+ short-term investments when available): ${money(row.cash)}` +
      (row.cashAsOf ? ` (as of ${row.cashAsOf})` : ''),
    `Total Debt (single SEC fact only; null if not tagged): ${money(row.totalDebt)}` +
      (row.totalDebtAsOf ? ` (as of ${row.totalDebtAsOf})` : ''),
    `Net Cash (Cash − Total Debt): ${money(row.netCash)}` +
      (row.netCash == null
        ? ' — Total Debt missing, so Net Cash was left blank (not estimated)'
        : row.netCash > 0
          ? ' — genuine net-cash on this screen'
          : ''),
    `Cash / market value: ${pct(row.cashToMarketPct)}`,
    `FCF (YTD / matched period): ${money(row.fcfYtd)}` +
      (row.fcfPeriod || row.fcfAsOf ? ` (${row.fcfPeriod || row.fcfAsOf})` : ''),
    `FCF / market value: ${pct(row.fcfToMarketPct)}`,
    `Operating cash flow (same period family): ${money(row.ocfYtd)}` +
      (row.ocfPeriod ? ` (${row.ocfPeriod})` : ''),
    '',
    '--- ACTIVE SCREEN FILTERS (how I found this name) ---',
    ...filtersBlock(row),
    '',
    '--- DATA CONFIDENCE (SEC filing reliability — not investment quality) ---',
    ...confidenceBlock(row),
    '',
    'My working thesis: a large share of the market value is already covered by cash, so I may be paying little for the operating business — and FCF (if positive) suggests the business can still generate cash. I also prefer names with positive Net Cash when that SEC Total Debt fact is available.',
    '',
    '--- PLEASE DO THE FOLLOWING ---',
    '1. **Validate the thinking** — Is the cash-backed / deep-value angle plausible for this company? Check whether Net Cash (cash minus a single SEC Total Debt fact) is real or misleading. What traps should I watch for (unreported debt pieces, preferreds, going-concern, one-off cash, stagnant FCF, dilution, accounting quirks, liquidation risk)?',
    '2. **Validate data confidence** — My app scored SEC data reliability (stars / 100). Confirm or challenge that score: are the flags fair, missing anything material (stale filings, foreign issuer forms, going concern, reverse splits, discontinued ops, etc.)? Say whether I should trust the screen numbers.',
    '3. **What the company does** — Plain-English overview for a novice: products/services, customers, how it makes money, competitive position.',
    '4. **Is it a good company?** — Quality snapshot (moat, balance sheet, capital allocation, growth/decline) in plain language. Separate “cheap” from “good”.',
    '5. **Bull case** — Why this could work as an investment / research candidate (3–6 concrete points).',
    '6. **Base case** — Most likely path over the next 1–3 years if nothing extraordinary happens.',
    '7. **Bear case** — How this thesis fails (3–6 concrete points).',
    '8. **Verdict** — One short paragraph: worth researching further or pass, and why (include whether confidence in the data is high enough). End with: “Not investment advice.”',
    '',
    'Use current public information. Flag anything that looks wrong or outdated in my screen numbers or confidence assessment.',
  ];

  return lines.join('\n');
}

function filtersBlock(row: CompanyFinderAskAiRow): string[] {
  const confFilter =
    row.minConfidenceStars > 0
      ? `≥ ${row.minConfidenceStars}/5 stars`
      : 'Any';
  return [
    `Cash / market ≥ ${row.minCashToMarketPct}%`,
    `FCF / market ≥ ${row.minFcfToMarketPct > 0 ? `${row.minFcfToMarketPct}%` : 'Any'}`,
    `Net cash / market ≥ ${
      row.minNetCashToMarketPct > 0 ? `${row.minNetCashToMarketPct}%` : 'no % threshold'
    }`,
    `Companies with no Net Cash data: ${
      row.includeMissingNetCash ? 'included' : 'excluded'
    }`,
    `Confidence filter: ${confFilter}`,
    `Sector filter: ${row.filterSector?.trim() || 'All'}`,
    `Country filter: ${row.filterCountry?.trim() || 'All'}`,
  ];
}

function confidenceBlock(row: CompanyFinderAskAiRow): string[] {
  if (row.confidenceScore == null && row.confidenceStars == null) {
    return ['Confidence: not computed yet (treat screen numbers cautiously).'];
  }
  const stars =
    row.confidenceStars != null ? `${row.confidenceStars}/5 stars` : 'n/a';
  const score =
    row.confidenceScore != null ? `${row.confidenceScore}/100` : 'n/a';
  const out = [`Confidence: ${stars} (${score})`];
  if (row.confidenceLatestFilingDate) {
    out.push(`Latest filing date used: ${row.confidenceLatestFilingDate}`);
  }
  if (row.confidenceReasons?.length) {
    out.push('Penalty flags:');
    for (const reason of row.confidenceReasons) {
      out.push(`  −${reason.points} [${reason.code}]: ${reason.message}`);
    }
  } else {
    out.push('Penalty flags: none (clean on automated SEC checks).');
  }
  return out;
}
