export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export type MonthName = (typeof MONTH_NAMES)[number];

/** Statement months are calendar dates interpreted in GMT/UTC (no local timezone). */
export const STATEMENT_TIMEZONE = 'GMT' as const;

export function monthNumberFromName(monthName: string): number | null {
  const idx = MONTH_NAMES.indexOf(monthName as MonthName);
  return idx >= 0 ? idx + 1 : null;
}

/** First day of statement month (YYYY-MM-DD). */
export function balanceDateForMonth(year: number, monthName: string): string {
  const monthNum = monthNumberFromName(monthName);
  if (!monthNum) {
    throw new Error(`Invalid month name: ${monthName}`);
  }
  return `${year}-${String(monthNum).padStart(2, '0')}-01`;
}

/** Inclusive start and exclusive end for filtering/deleting a calendar month. */
export function monthDateRange(
  year: number,
  monthName: string
): { start: string; endExclusive: string } | null {
  const monthNum = monthNumberFromName(monthName);
  if (!monthNum) return null;
  const start = `${year}-${String(monthNum).padStart(2, '0')}-01`;
  if (monthNum === 12) {
    return { start, endExclusive: `${year + 1}-01-01` };
  }
  return { start, endExclusive: `${year}-${String(monthNum + 1).padStart(2, '0')}-01` };
}

/** YYYY-MM key for GMT calendar month matching (extra delete safety). */
export function monthYearKey(year: number, monthName: string): string | null {
  const monthNum = monthNumberFromName(monthName);
  if (!monthNum) return null;
  return `${year}-${String(monthNum).padStart(2, '0')}`;
}

/** Format a Date as YYYY-MM-DD in UTC (GMT). */
export function formatUtcDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Normalize API/DB values to YYYY-MM-DD (GMT calendar date, never local TZ). */
export function normalizeBalanceDate(balanceDate: unknown): string {
  if (balanceDate instanceof Date) {
    return formatUtcDate(balanceDate);
  }
  const raw = String(balanceDate).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid balance_date: ${balanceDate}`);
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** True when balance_date falls in the requested statement month (GMT). */
export function balanceDateMatchesStatementMonth(
  balanceDate: unknown,
  year: number,
  monthName: string
): boolean {
  const key = monthYearKey(year, monthName);
  if (!key) return false;
  const iso = normalizeBalanceDate(balanceDate);
  return iso.slice(0, 7) === key;
}

/** Statement month label from balance_date (calendar month of YYYY-MM-DD). */
export function monthNameFromBalanceDate(balanceDate: unknown): MonthName {
  const iso = normalizeBalanceDate(balanceDate);
  const monthNum = parseInt(iso.slice(5, 7), 10);
  if (monthNum >= 1 && monthNum <= 12) {
    return MONTH_NAMES[monthNum - 1];
  }
  throw new Error(`Invalid balance_date month: ${balanceDate}`);
}
