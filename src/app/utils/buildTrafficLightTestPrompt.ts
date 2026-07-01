export interface TrafficLightTestStockContext {
  symbol: string;
  buyPrice?: number | null;
  activePrice?: number | null;
  monthLabel?: string;
}

export function buildTrafficLightTestPrompt(stock: TrafficLightTestStockContext): string {
  const priceLines: string[] = [];
  if (stock.buyPrice != null && Number.isFinite(Number(stock.buyPrice))) {
    priceLines.push(`Buy price (watchlist): $${Number(stock.buyPrice).toFixed(2)}`);
  }
  if (stock.activePrice != null && Number.isFinite(Number(stock.activePrice))) {
    priceLines.push(`Current / active price: $${Number(stock.activePrice).toFixed(2)}`);
  }

  const priceSection =
    priceLines.length > 0 ? `\nWatchlist prices:\n${priceLines.map((l) => `- ${l}`).join('\n')}\n` : '';

  const monthLine = stock.monthLabel ? `\nMonthly watchlist period: ${stock.monthLabel}\n` : '';

  return `I'm evaluating ${stock.symbol} for my monthly stock watchlist using a "Traffic Light Test". Please research the stock and its sector, then answer the three questions below and assign a traffic light rating.
${monthLine}${priceSection}
Answer these three questions:

1. **Is money still flowing into the sector?**
   Think neighbourhood, not house: if the entire neighbourhood is being abandoned, it doesn't matter how nice the house is. Is institutional and retail money still flowing into this sector/industry, or is capital rotating out?

2. **Which side of the trend line is the stock on?**
   Use the 150-day moving average as the key line. If price is above it, that's supportive. If below, it's like driving on black ice — danger. State clearly whether ${stock.symbol} is above or below the 150-day MA and how far.

3. **Is the stock on a pause, or a crash?**
   A pause (consolidation, healthy pullback, low-volume drift) can be fine. A crash (breakdown, panic selling, heavy volume decline) is not. Describe what the recent price action looks like.

Based on your answers, assign ONE traffic light rating:

🟢 **GREEN** — Money flowing into the sector. Price holding above the 150-day line. The drop looks like a rest / healthy pause, not a crash.

🟡 **AMBER** — Great company, wrong moment. Sector or trend is mixed. Hands off the wheel — wait for clarity before adding.

🔴 **RED** — Money leaving the neighbourhood. Price under the 150-day line. Ugly panic volume or breakdown — avoid for now.

Please structure your response as:
- **Q1 — Sector money flow:** (answer)
- **Q2 — 150-day MA:** (above/below, price vs MA, interpretation)
- **Q3 — Pause or crash:** (answer)
- **Traffic light:** GREEN / AMBER / RED
- **One-line summary:** (plain English verdict for a watchlist decision)

Be direct and practical. Use recent data where you can.`;
}

export interface PortfolioTrafficLightStock {
  symbol: string;
  activePrice?: number | null;
}

export function buildPortfolioTrafficLightTestPrompt(stocks: PortfolioTrafficLightStock[]): string {
  const stockLines = stocks.map((stock) => {
    const price =
      stock.activePrice != null && Number.isFinite(Number(stock.activePrice))
        ? `$${Number(stock.activePrice).toFixed(2)}`
        : 'unknown';
    return `- ${stock.symbol} (active price: ${price})`;
  });

  const stockList = stockLines.join('\n');
  const symbols = stocks.map((s) => s.symbol).join(', ');

  return `I'm evaluating my entire portfolio using a "Traffic Light Test". Please research each stock and its sector, then for EACH stock answer the three questions below and assign a traffic light rating.

My portfolio (${stocks.length} stock${stocks.length === 1 ? '' : 's'}):
${stockList}

For each stock (${symbols}), answer these three questions:

1. **Is money still flowing into the sector?**
   Think neighbourhood, not house: if the entire neighbourhood is being abandoned, it doesn't matter how nice the house is. Is institutional and retail money still flowing into this sector/industry, or is capital rotating out?

2. **Is the stock's medium-term trend still healthy?**
   For each stock, assess whether the trend is one of:
   - Healthy uptrend
   - Sideways consolidation
   - Weakening trend
   - Breakdown

   Use the 150-day moving average where reliable data is available, but do not rely on it as the only signal.

   Question 2 should consider:
   - Current price versus 150-day moving average, if available
   - Recent higher highs / lower highs
   - Recent higher lows / lower lows
   - Whether the stock is above or below key support
   - Recent momentum
   - Whether price action confirms or weakens the investment case

3. **Is the stock on a pause, or a crash?**
   A pause (consolidation, healthy pullback, low-volume drift) can be fine. A crash (breakdown, panic selling, heavy volume decline) is not. Describe what the recent price action looks like.

Based on your answers, assign ONE traffic light rating per stock:

🟢 **GREEN**
- Sector money flow is positive
- Medium-term trend is healthy or consolidating
- Recent move looks like a pause, not a crash

🟡 **AMBER**
- Sector flow or trend is mixed
- Stock is range-bound, weakening, or unclear
- Wait for cleaner evidence before adding

🔴 **RED**
- Sector money is leaving
- Medium-term trend is breaking down
- Recent move looks like a crash or heavy selling

Keep the report concise.

For each stock, return:

### [SYMBOL]
- **Q1 — Sector money flow:** (answer)
- **Q2 — Medium-term trend:** [Healthy uptrend / Sideways consolidation / Weakening trend / Breakdown] — (short plain-English explanation)
- **Q3 — Pause or crash:** (answer)
- **Traffic light:** GREEN / AMBER / RED
- **One-line summary:** (plain English verdict)

After all stocks, return:

### Portfolio summary
- **Counts:** X green, Y amber, Z red
- **Overall portfolio health:** (plain English verdict based on the traffic light results only)

Do not suggest trades, portfolio changes, or improvements. Stick to the three questions, traffic light ratings, and summary counts only.

Be direct and practical. Use recent data where you can.`;
}
