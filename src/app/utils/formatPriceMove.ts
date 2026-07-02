export function formatPriceMovePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export function priceMoveColorClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'text-gray-500 dark:text-gray-400';
  }
  if (value > 0.2) return 'text-green-600 dark:text-green-400';
  if (value < -0.2) return 'text-red-600 dark:text-red-400';
  return 'text-gray-600 dark:text-gray-300';
}

export function priceMoveBoxClass(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400';
  }
  if (value > 0.2) {
    return 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300';
  }
  if (value < -0.2) {
    return 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300';
  }
  return 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300';
}

export function formatBearCasePrice(price: number, usdToGbpRate?: number | null): string {
  const value = usdToGbpRate ? price * usdToGbpRate : price;
  const symbol = usdToGbpRate ? '£' : '$';
  if (value >= 1000) return `${symbol}${(value / 1000).toFixed(1)}k`;
  if (value >= 100) return `${symbol}${Math.round(value)}`;
  return `${symbol}${value.toFixed(2)}`;
}

export function formatGbpPrice(value: number): string {
  if (value >= 1_000_000) return `£${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `£${(value / 1_000).toFixed(1)}k`;
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPositionValue(value: number, usdToGbpRate?: number | null): string {
  if (usdToGbpRate) return formatGbpPrice(value * usdToGbpRate);
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
