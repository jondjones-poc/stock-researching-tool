import {
  MARKET_FLOW_PERIOD_DAYS,
  MARKET_FLOW_PERIODS,
  type MarketFlowPeriod,
} from '../config/marketFlow';
import {
  getCloseOnOrBefore,
  getLatestClose,
  upsertReturns,
  type MarketFlowPriceBar,
} from './marketFlowDb';

/** Coerce a date/timestamp string (ISO or Postgres/JS Date format) to YYYY-MM-DD, or null. */
export function toIsoDay(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const day = toIsoDay(isoDate);
  if (!day) throw new Error(`addCalendarDays received an unparseable date: ${isoDate}`);
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeReturnPct(startClose: number, endClose: number): number {
  if (!Number.isFinite(startClose) || !Number.isFinite(endClose) || startClose === 0) {
    return NaN;
  }
  return ((endClose - startClose) / startClose) * 100;
}

export async function recomputeFundReturns(fundId: number): Promise<void> {
  const latest = await getLatestClose(fundId);
  if (!latest) {
    for (const period of MARKET_FLOW_PERIODS) {
      await upsertReturns(fundId, period, {
        returnPct: null,
        asOfDate: null,
        startDate: null,
        startClose: null,
        endClose: null,
      });
    }
    return;
  }

  for (const period of MARKET_FLOW_PERIODS) {
    const lookback = MARKET_FLOW_PERIOD_DAYS[period];
    const targetStart = addCalendarDays(latest.date, -lookback);
    const start = await getCloseOnOrBefore(fundId, targetStart);
    if (!start) {
      await upsertReturns(fundId, period, {
        returnPct: null,
        asOfDate: latest.date,
        startDate: null,
        startClose: null,
        endClose: latest.close,
      });
      continue;
    }
    const pct = computeReturnPct(start.close, latest.close);
    await upsertReturns(fundId, period, {
      returnPct: Number.isFinite(pct) ? pct : null,
      asOfDate: latest.date,
      startDate: start.date,
      startClose: start.close,
      endClose: latest.close,
    });
  }
}

/** Normalize series to 100 at the first shared date. */
export function normalizeSeriesTo100(
  series: Array<{ date: string; close: number }>
): Array<{ date: string; value: number }> {
  if (series.length === 0) return [];
  const base = series[0].close;
  if (!Number.isFinite(base) || base === 0) return [];
  return series.map((b) => ({
    date: b.date,
    value: (b.close / base) * 100,
  }));
}

/** Align two price series on shared dates, then normalize each to 100 at start. */
export function buildNormalizedComparison(
  large: MarketFlowPriceBar[],
  small: MarketFlowPriceBar[],
  fromDate?: string
): Array<{ date: string; large: number; small: number }> {
  const largeMap = new Map(large.map((b) => [b.date, b.close]));
  const smallMap = new Map(small.map((b) => [b.date, b.close]));
  const dates = [...largeMap.keys()]
    .filter((d) => smallMap.has(d) && (!fromDate || d >= fromDate))
    .sort();

  if (dates.length === 0) return [];

  const largeBase = largeMap.get(dates[0])!;
  const smallBase = smallMap.get(dates[0])!;
  if (!largeBase || !smallBase) return [];

  return dates.map((date) => ({
    date,
    large: (largeMap.get(date)! / largeBase) * 100,
    small: (smallMap.get(date)! / smallBase) * 100,
  }));
}

export function periodStartFromAsOf(asOf: string, period: MarketFlowPeriod): string {
  return addCalendarDays(asOf, -MARKET_FLOW_PERIOD_DAYS[period]);
}
