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

/**
 * Format a Date as YYYY-MM-DD using the runtime's local calendar.
 * node-pg maps PostgreSQL `date` to a JS Date at local midnight; using UTC
 * parts here shifts the calendar day back by one in positive UTC offsets (e.g. BST),
 * turning 2026-07-01 into 2026-06-30.
 */
export function formatLocalCalendarDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Normalize API/DB values to YYYY-MM-DD for statement months.
 * - Plain `YYYY-MM-DD` strings are kept as-is (canonical statement date).
 * - `Date` / ISO datetimes from node-pg use local calendar parts (pg date semantics).
 */
export function normalizeBalanceDate(balanceDate: unknown): string {
  if (balanceDate instanceof Date) {
    if (Number.isNaN(balanceDate.getTime())) {
      throw new Error(`Invalid balance_date: ${balanceDate}`);
    }
    return formatLocalCalendarDate(balanceDate);
  }
  const raw = String(balanceDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    throw new Error(`Invalid balance_date: ${balanceDate}`);
  }
  // Date-only prefix on a datetime string: if time is present, recover the
  // intended calendar day via local parts (handles ...T23:00:00.000Z from BST).
  if (/T|\s/.test(raw.slice(10))) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return formatLocalCalendarDate(parsed);
    }
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
