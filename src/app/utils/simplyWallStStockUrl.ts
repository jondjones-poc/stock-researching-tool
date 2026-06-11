/** Simply Wall St overview URL: https://simplywall.st/stock/{exchange}/{ticker} */

const NYSE_SYMBOLS = new Set([
  'ABBV', 'ABT', 'ACN', 'AIG', 'ALL', 'AMGN', 'AMT', 'AXP', 'BA', 'BAC', 'BK', 'BLK',
  'BMY', 'BRK.A', 'BRK.B', 'C', 'CAT', 'CL', 'CMCSA', 'COF', 'COP', 'CRM', 'CVS', 'CVX',
  'DE', 'DHR', 'DIS', 'DOW', 'DUK', 'EMR', 'F', 'FCX', 'FDX', 'GD', 'GE', 'GILD', 'GM',
  'GS', 'HD', 'HON', 'IBM', 'INTC', 'JNJ', 'JPM', 'KMB', 'KO', 'LIN', 'LLY', 'LMT', 'LOW',
  'MA', 'MCD', 'MDT', 'MET', 'MMM', 'MO', 'MRK', 'MS', 'NEE', 'NEM', 'NKE', 'ORCL', 'PEP',
  'PFE', 'PG', 'PLD', 'PM', 'PYPL', 'QCOM', 'RTX', 'SBUX', 'SCHW', 'SO', 'SPG', 'T', 'TGT',
  'TMO', 'TMUS', 'TXN', 'UNH', 'UNP', 'UPS', 'USB', 'V', 'VZ', 'WFC', 'XOM',
]);

const ARCA_SYMBOLS = new Set([
  'DIA', 'EEM', 'GLD', 'IEMG', 'IWM', 'IVV', 'QQQ', 'SCHD', 'SPY', 'VOO', 'VWO', 'XLF',
  'XLK', 'XLV',
]);

const AMEX_SYMBOLS = new Set(['GLD', 'IWM']);

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function urlSlug(symbol: string): string {
  return normalizeSymbol(symbol).toLowerCase();
}

function exchangeForSymbol(symbol: string): string {
  const upper = normalizeSymbol(symbol);
  if (ARCA_SYMBOLS.has(upper)) return 'arca';
  if (AMEX_SYMBOLS.has(upper)) return 'amex';
  if (NYSE_SYMBOLS.has(upper) || upper.includes('.')) return 'nyse';
  return 'nasdaqgs';
}

export function simplyWallStStockUrl(symbol: string): string {
  const slug = urlSlug(symbol);
  const exchange = exchangeForSymbol(symbol);
  return `https://simplywall.st/stock/${exchange}/${slug}`;
}
