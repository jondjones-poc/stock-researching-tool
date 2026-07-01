export interface PortfolioReviewStock {
  symbol: string;
  activePrice?: number | null;
}

export function buildPortfolioReviewPrompt(stocks: PortfolioReviewStock[]): string {
  const stockLines = stocks.map((stock) => {
    const price =
      stock.activePrice != null && Number.isFinite(Number(stock.activePrice))
        ? `$${Number(stock.activePrice).toFixed(2)}`
        : 'unknown';
    return `- ${stock.symbol} (active price in my app: ${price})`;
  });

  const stockList = stockLines.join('\n');
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `Please review the health of my portfolio over the **last calendar month** (roughly the past 30 days). Use recent market data and news.

Review date: ${today}
Portfolio size: ${stocks.length} stock${stocks.length === 1 ? '' : 's'}

My holdings:
${stockList}

Create a **portfolio review matrix** as a markdown table with one row per stock. Use these columns:

| Symbol | Active Price | 1-Month Move | Signal | Top News (1–2 items) |

Column guidance:
- **Active Price** — current price (use my app price as a cross-check if helpful).
- **1-Month Move** — approximate % change over the last month. Show direction with an icon: 📈 if up, 📉 if down, ➡️ if roughly flat (within ~2%).
- **Signal** — a simple **Buy**, **Hold**, or **Sell** lean based mainly on the last month's price action and near-term outlook (not long-term fundamentals). Use plain language; this is a monthly health check, not financial advice.
- **Top News (1–2 items)** — the 1–2 most important headlines from the last month I should know about (e.g. earnings reported, guidance change, major product news, regulatory action, analyst downgrade). One short bullet per item.

After the table, add:

### Portfolio summary
- How many holdings are up vs down this month
- One paragraph overall portfolio health verdict for the last month

Do not suggest trades, portfolio changes, or improvements. Stick to the matrix and factual summary only.

Be concise and practical. Prefer recent, verifiable news. If data is unavailable for a stock, say so in that row rather than guessing.`;
}
