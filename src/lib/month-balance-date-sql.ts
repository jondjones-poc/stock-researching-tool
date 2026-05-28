/**
 * PostgreSQL expressions for statement balance_date in GMT/UTC.
 * Use the same predicates for preview and delete.
 */
export const BALANCE_DATE_UTC_DATE = `(ab.balance_date AT TIME ZONE 'UTC')::date`;

/** $1 start, $2 endExclusive, $3 YYYY-MM month key */
export function balanceDateInMonthPredicate(paramStart = 1): string {
  const s = paramStart;
  const e = paramStart + 1;
  const m = paramStart + 2;
  return `${BALANCE_DATE_UTC_DATE} >= $${s}::date
  AND ${BALANCE_DATE_UTC_DATE} < $${e}::date
  AND to_char(${BALANCE_DATE_UTC_DATE}, 'YYYY-MM') = $${m}`;
}

/** Default predicate starting at $1 (preview, delete). */
export const BALANCE_DATE_IN_MONTH_PREDICATE = balanceDateInMonthPredicate(1);
