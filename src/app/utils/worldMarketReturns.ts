import type { WorldMarketPeriod } from '../config/worldMarkets';

export interface PricePoint {
  date: string;
  close: number;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function worldHistoryFromDate(period: WorldMarketPeriod, asOf: Date = new Date()): string {
  const d = new Date(asOf);
  d.setHours(12, 0, 0, 0);
  switch (period) {
    case '10y':
      d.setFullYear(d.getFullYear() - 11);
      break;
    case '5y':
      d.setFullYear(d.getFullYear() - 6);
      break;
    case '2y':
      d.setFullYear(d.getFullYear() - 3);
      break;
    default:
      d.setFullYear(d.getFullYear() - 2);
      break;
  }
  return toDateString(d);
}

export function worldPeriodStartDate(period: WorldMarketPeriod, asOf: Date = new Date()): string | null {
  if (period === 'today') return null;

  const d = new Date(asOf);
  d.setHours(12, 0, 0, 0);

  switch (period) {
    case '3m':
      d.setMonth(d.getMonth() - 3);
      return toDateString(d);
    case '6m':
      d.setMonth(d.getMonth() - 6);
      return toDateString(d);
    case '1y':
      d.setFullYear(d.getFullYear() - 1);
      return toDateString(d);
    case '2y':
      d.setFullYear(d.getFullYear() - 2);
      return toDateString(d);
    case '5y':
      d.setFullYear(d.getFullYear() - 5);
      return toDateString(d);
    case '10y':
      d.setFullYear(d.getFullYear() - 10);
      return toDateString(d);
    default:
      return null;
  }
}

function closeOnOrBefore(points: PricePoint[], targetDate: string): number | null {
  let best: number | null = null;
  for (const point of points) {
    if (point.date <= targetDate) best = point.close;
    else break;
  }
  return best;
}

export function computeReturnFromPoints(
  points: PricePoint[],
  period: WorldMarketPeriod,
  todayChangePercent?: number | null
): { changePercent: number | null; asOfDate: string | null } {
  if (points.length === 0) {
    return { changePercent: null, asOfDate: null };
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1];

  if (period === 'today') {
    if (todayChangePercent !== undefined && todayChangePercent !== null && Number.isFinite(todayChangePercent)) {
      return { changePercent: todayChangePercent, asOfDate: latest.date };
    }
    if (sorted.length >= 2) {
      const prev = sorted[sorted.length - 2];
      if (prev.close !== 0) {
        return {
          changePercent: ((latest.close - prev.close) / prev.close) * 100,
          asOfDate: latest.date,
        };
      }
    }
    return { changePercent: null, asOfDate: latest.date };
  }

  const startDate = worldPeriodStartDate(period);
  if (!startDate) return { changePercent: null, asOfDate: latest.date };

  const startClose = closeOnOrBefore(sorted, startDate);
  if (startClose === null || startClose === 0) {
    return { changePercent: null, asOfDate: latest.date };
  }

  return {
    changePercent: ((latest.close - startClose) / startClose) * 100,
    asOfDate: latest.date,
  };
}
