import type { MarketFlowPeriod } from '../config/marketFlow';

export type MarketFlowView = 'large' | 'small' | 'vs';

export interface MarketFlowDashboardRow {
  slug: string;
  name: string;
  region: string;
  large: {
    symbol: string;
    name: string;
    returns: Record<MarketFlowPeriod, number | null>;
    price: number | null;
    asOf: string | null;
  };
  small: {
    symbol: string;
    name: string;
    returns: Record<MarketFlowPeriod, number | null>;
    price: number | null;
    asOf: string | null;
  };
  leader: Record<MarketFlowPeriod, 'large' | 'small' | 'tie' | 'n/a'>;
  spread: Record<MarketFlowPeriod, number | null>;
}

export interface MarketFlowDashboardPayload {
  disclaimer: string;
  period: MarketFlowPeriod;
  view: MarketFlowView;
  lastUpdated: string | null;
  dataStale: boolean;
  staleWarning: string | null;
  mode: string | null;
  runStatus: string | null;
  summary: {
    bestMarket: { slug: string; name: string; returnPct: number } | null;
    worstMarket: { slug: string; name: string; returnPct: number } | null;
    strongestLarge: { slug: string; name: string; returnPct: number } | null;
    strongestSmall: { slug: string; name: string; returnPct: number } | null;
  };
  ranked: {
    byMarket: Array<{ slug: string; name: string; returnPct: number }>;
    byLarge: Array<{ slug: string; name: string; symbol: string; returnPct: number }>;
    bySmall: Array<{ slug: string; name: string; symbol: string; returnPct: number }>;
  };
  rows: MarketFlowDashboardRow[];
}

export function heatClass(value: number | null): string {
  const neutral = 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400';
  if (value == null || !Number.isFinite(value)) return neutral;
  if (value >= 8) return 'bg-green-700 text-white';
  if (value >= 4) return 'bg-green-600 text-white';
  if (value >= 1.5) return 'bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100';
  if (value >= 0.25) return 'bg-green-50 dark:bg-green-900/40 text-green-800 dark:text-green-200';
  if (value > -0.25) return neutral;
  if (value > -1.5) return 'bg-red-50 dark:bg-red-900/40 text-red-800 dark:text-red-200';
  if (value > -4) return 'bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100';
  if (value > -8) return 'bg-red-600 text-white';
  return 'bg-red-700 text-white';
}

export function formatPct(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}
