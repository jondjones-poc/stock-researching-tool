import type { MarketFlowPeriod } from '../config/marketFlow';

export type MarketFlowView = 'large' | 'small' | 'vs';

export interface MarketFlowHoldingSummary {
  symbol: string;
  name: string;
  weightPct: number | null;
  rank: number;
}

export interface MarketFlowFundSleeve {
  symbol: string;
  name: string;
  returns: Record<MarketFlowPeriod, number | null>;
  price: number | null;
  asOf: string | null;
  /** Fund return minus SPY return for the selected period. */
  relativeToSpy: number | null;
  holdings: MarketFlowHoldingSummary[];
}

export interface MarketFlowDashboardRow {
  slug: string;
  name: string;
  region: string;
  large: MarketFlowFundSleeve;
  small: MarketFlowFundSleeve;
  leader: Record<MarketFlowPeriod, 'large' | 'small' | 'tie' | 'n/a'>;
  /** Large-cap return minus small-cap return for each period. */
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
  benchmark: {
    symbol: string;
    name: string;
    returnPct: number | null;
  };
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

/**
 * Card-relative size gap.
 * `spread` is always large-cap return minus small-cap return.
 * Large-cap cards show vs Small-cap (same sign).
 * Small-cap cards show vs Large-cap (flipped sign).
 */
export function capRelativeSpread(
  capType: 'large' | 'small',
  spread: number | null
): { label: string; relative: number | null } {
  if (spread == null || !Number.isFinite(spread)) {
    return {
      label: capType === 'large' ? 'vs Small-cap —' : 'vs Large-cap —',
      relative: null,
    };
  }
  const relative = capType === 'large' ? spread : -spread;
  const peer = capType === 'large' ? 'Small-cap' : 'Large-cap';
  return {
    label: `vs ${peer} ${formatPct(relative)}`,
    relative,
  };
}

/** Hover copy for size-comparison badges, written from the current card's point of view. */
export function lcScSpreadTooltip(
  spread: number | null,
  capType: 'large' | 'small' = 'large'
): {
  title: string;
  meaning: string;
  whyCare: string;
  theory: string;
} {
  const peer = capType === 'large' ? 'small-cap' : 'large-cap';
  const peerTitle = capType === 'large' ? 'Small-cap' : 'Large-cap';
  const thisSleeve = capType === 'large' ? 'large-cap' : 'small-cap';
  const { relative } = capRelativeSpread(capType, spread);

  if (relative == null) {
    return {
      title: `vs ${peerTitle} unavailable`,
      meaning: `We could not compare this ${thisSleeve} fund with its ${peer} pair for this period.`,
      whyCare: 'Without the gap, you cannot tell whether this sleeve is leading or lagging inside the same market.',
      theory: 'Wait until both sleeves have returns, then compare again.',
    };
  }

  if (Math.abs(relative) < 1) {
    return {
      title: `Almost even with ${peer}`,
      meaning: `This shows how far this ${thisSleeve} return is ahead of (or behind) the paired ${peer} fund. Near zero means both moved almost the same.`,
      whyCare: 'There is no clear size leadership in this market right now.',
      theory:
        'In theory, no size tilt is required. Choose based on other signals (trend vs SPY, valuation, holdings).',
    };
  }

  if (relative > 0) {
    return {
      title: `Ahead of ${peer}`,
      meaning: `${formatPct(relative)} means this ${thisSleeve} fund beat the paired ${peer} fund by that amount over the selected period.`,
      whyCare:
        capType === 'large'
          ? 'Large-cap leadership often means investors prefer bigger, more liquid names and risk appetite may be more cautious.'
          : 'Small-cap leadership often means stronger risk appetite and broader participation beyond mega-caps—usually with more volatility.',
      theory:
        capType === 'large'
          ? 'In theory, favour this large-cap sleeve (or wait for small-caps to catch up) before adding higher-beta small-cap exposure.'
          : 'In theory, this can support leaning into this small-cap sleeve—still check liquidity, valuations, and how it compares with SPY first.',
    };
  }

  return {
    title: `Behind ${peer}`,
    meaning: `${formatPct(relative)} means this ${thisSleeve} fund lagged the paired ${peer} fund by ${formatPct(Math.abs(relative))} over the selected period.`,
    whyCare:
      capType === 'large'
        ? 'Large-caps trailing small-caps can signal stronger risk appetite elsewhere in the market; this sleeve is not the leadership story.'
        : 'Small-caps trailing large-caps can mean leadership is concentrated in bigger names and this sleeve is not participating as strongly.',
    theory:
      capType === 'large'
        ? 'In theory, prefer the leading small-cap sleeve for this market, or wait for large-caps to regain leadership before adding here.'
        : 'In theory, prefer the leading large-cap sleeve for this market, or wait for small-caps to catch up before adding higher-beta exposure.',
  };
}
