/** Yahoo Finance quote URL for a ticker (handles BRK.B → BRK-B). */
export function yahooFinanceQuoteUrl(symbol: string): string {
  const yahooSymbol = String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\./g, '-');
  return `https://finance.yahoo.com/quote/${encodeURIComponent(yahooSymbol)}`;
}
