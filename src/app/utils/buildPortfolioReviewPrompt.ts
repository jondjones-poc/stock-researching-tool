export interface PortfolioReviewStock {
  symbol: string;
  activePrice?: number | null;
  avgBuyPrice?: number | null;
  gainLossPercent?: number | null;
  usdToGbpRate?: number | null;
}

function formatMoney(usd: number | null | undefined, rate: number | null | undefined): string {
  if (usd == null || !Number.isFinite(usd)) return 'unknown';
  if (rate) return `£${(usd * rate).toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function formatPercent(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return 'unknown';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export function buildPortfolioReviewPrompt(stocks: PortfolioReviewStock[]): string {
  const rate = stocks[0]?.usdToGbpRate ?? null;

  const stockLines = stocks.map((stock) => {
    const current = formatMoney(stock.activePrice, stock.usdToGbpRate ?? rate);
    const avgPaid = formatMoney(stock.avgBuyPrice, stock.usdToGbpRate ?? rate);
    const pl = formatPercent(stock.gainLossPercent);
    return `- ${stock.symbol} (current: ${current}, avg paid: ${avgPaid}, P/L since buy: ${pl})`;
  });

  const stockList = stockLines.join('\n');
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Please review my portfolio holdings and assess whether each position is still a **Buy**, **Hold**, or **Sell** at today's prices. Use recent market data, news, and fundamentals.

Review date: ${today}
Portfolio size: ${stocks.length} stock${stocks.length === 1 ? '' : 's'}

My holdings (prices${rate ? ' in GBP' : ''}, from my app + eToro cost basis):
${stockList}

Create a **portfolio review matrix** as a markdown table with one row per stock. Use these columns:

| Symbol | Current Price | Avg Paid | P/L Since Buy | Verdict | Rationale (1–2 sentences) | Top News (1–2 items) |

Column guidance:
- **Current Price** — today's price (cross-check my figures above).
- **Avg Paid** — my average purchase price per share.
- **P/L Since Buy** — my gain or loss % since purchase (cross-check my figures).
- **Verdict** — **Buy** (would add / still attractive), **Hold** (keep, fair value), or **Sell** (trim or exit). Base this on whether the stock still looks like good value at the current price relative to what I paid, recent performance, and near-term outlook.
- **Rationale** — brief plain-English reason for the verdict.
- **Top News (1–2 items)** — the 1–2 most important recent headlines (earnings, guidance, product, regulatory, analyst moves). One short bullet per item.

After the table, add:

### Portfolio summary
- Count of Buy / Hold / Sell recommendations
- Which positions are working vs underwater since purchase
- One paragraph overall portfolio verdict

Be concise and practical. Prefer recent, verifiable news. If data is unavailable for a stock, say so in that row rather than guessing.`;
}
