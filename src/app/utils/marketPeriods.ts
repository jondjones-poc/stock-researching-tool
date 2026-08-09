export type MarketHeatmapPeriod =
  | 'today'
  | '1w'
  | '2w'
  | '1m'
  | '3m'
  | '6m'
  | 'ytd'
  | '1y'
  | '2y';

export const MARKET_PERIOD_OPTIONS: { id: MarketHeatmapPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '1w', label: '1 Week' },
  { id: '2w', label: '2 Weeks' },
  { id: '1m', label: '1 Month' },
  { id: '3m', label: '3 Months' },
  { id: '6m', label: '6 Months' },
  { id: 'ytd', label: 'YTD' },
  { id: '1y', label: '1 Year' },
  { id: '2y', label: '2 Years' },
];

const VALID_PERIODS = new Set<string>(MARKET_PERIOD_OPTIONS.map((o) => o.id));

export function parseMarketPeriod(value: string | null): MarketHeatmapPeriod {
  if (value && VALID_PERIODS.has(value)) {
    return value as MarketHeatmapPeriod;
  }
  return 'today';
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Inclusive start date for period return (last close on or before this date vs latest close). */
export function periodStartDate(period: MarketHeatmapPeriod, asOf: Date = new Date()): string | null {
  if (period === 'today') return null;

  const d = new Date(asOf);
  d.setHours(12, 0, 0, 0);

  switch (period) {
    case '1w': {
      d.setDate(d.getDate() - 7);
      return toDateString(d);
    }
    case '2w': {
      d.setDate(d.getDate() - 14);
      return toDateString(d);
    }
    case '1m': {
      d.setMonth(d.getMonth() - 1);
      return toDateString(d);
    }
    case '3m': {
      d.setMonth(d.getMonth() - 3);
      return toDateString(d);
    }
    case '6m': {
      d.setMonth(d.getMonth() - 6);
      return toDateString(d);
    }
    case 'ytd':
      return `${d.getFullYear() - 1}-12-31`;
    case '1y': {
      d.setFullYear(d.getFullYear() - 1);
      return toDateString(d);
    }
    case '2y': {
      d.setFullYear(d.getFullYear() - 2);
      return toDateString(d);
    }
    default:
      return null;
  }
}

/** How far back to fetch EOD history (covers 2y period with buffer). */
export function eodFetchFromDate(asOf: Date = new Date()): string {
  const d = new Date(asOf);
  d.setFullYear(d.getFullYear() - 3);
  return toDateString(d);
}

export function eodFetchToDate(asOf: Date = new Date()): string {
  return toDateString(asOf);
}
