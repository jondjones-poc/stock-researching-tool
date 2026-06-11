export interface RangeGaugeInput {
  floor: number | null | undefined;
  ceiling: number | null | undefined;
  current: number | null | undefined;
}

export interface RangeGaugeOptions {
  floorLabel: string;
  ceilingLabel: string;
  currentLabel: string;
  missingError: string;
  invalidError: string;
  spanError: string;
  formatValue: (value: number) => string;
}

export interface RangeGaugeMetrics {
  rangeProgressPct: number;
  dipFromHighPct: number;
  outOfRange: boolean;
  outOfRangeMessage: string | null;
}

export type RangeGaugeState =
  | { ok: true; metrics: RangeGaugeMetrics }
  | { ok: false; error: string };

function parseNum(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function computeRangeGauge(
  input: RangeGaugeInput,
  options: RangeGaugeOptions
): RangeGaugeState {
  const floor = parseNum(input.floor);
  const ceiling = parseNum(input.ceiling);
  const current = parseNum(input.current);

  if (floor === null || ceiling === null || current === null) {
    return { ok: false, error: options.missingError };
  }

  if (ceiling <= floor) {
    return { ok: false, error: options.spanError };
  }

  const span = ceiling - floor;
  const rawProgress = ((current - floor) / span) * 100;
  const rangeProgressPct = Math.max(0, Math.min(100, rawProgress));
  const dipFromHighPct = ceiling !== 0 ? Math.max(0, ((ceiling - current) / ceiling) * 100) : 0;

  let outOfRange = false;
  let outOfRangeMessage: string | null = null;

  if (current < floor) {
    outOfRange = true;
    outOfRangeMessage = `${options.currentLabel} (${options.formatValue(current)}) is below the ${options.floorLabel.toLowerCase()} (${options.formatValue(floor)}). Data may be stale or inconsistent.`;
  } else if (current > ceiling) {
    outOfRange = true;
    outOfRangeMessage = `${options.currentLabel} (${options.formatValue(current)}) is above the ${options.ceilingLabel.toLowerCase()} (${options.formatValue(ceiling)}). Data may be stale or inconsistent.`;
  }

  return {
    ok: true,
    metrics: { rangeProgressPct, dipFromHighPct, outOfRange, outOfRangeMessage },
  };
}

export function formatGaugePrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatGaugeRatio(value: number): string {
  return `${value.toFixed(1)}x`;
}

export function formatGaugeShares(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function formatGaugeLargeCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

/** @deprecated Use computeRangeGauge — kept for price gauge */
export function computeWeekRangeGauge(input: {
  yearlyFloor: number | null | undefined;
  yearlyCeiling: number | null | undefined;
  currentBenchmark: number | null | undefined;
}): RangeGaugeState {
  return computeRangeGauge(
    {
      floor: input.yearlyFloor,
      ceiling: input.yearlyCeiling,
      current: input.currentBenchmark,
    },
    {
      floorLabel: 'Year Low',
      ceilingLabel: 'Year High',
      currentLabel: 'Active Price',
      missingError:
        'Year Low, Year High, and Active Price are required to render the 52-week range gauge.',
      invalidError: 'Year Low, Year High, and Active Price must be positive values.',
      spanError: 'Year High must be greater than Year Low.',
      formatValue: formatGaugePrice,
    }
  );
}
