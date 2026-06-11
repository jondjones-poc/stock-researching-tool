export const MARKETS_EOD_MIGRATION_HINT =
  'Run scripts/migrations/014_market_stock_eod_cache.sql and 015_market_stock_period_cache.sql on your database.';

export function isMissingRelationError(error: unknown): boolean {
  const err = error as { code?: string };
  return err.code === '42P01';
}

export function missingRelationMessage(error: unknown): string | null {
  if (!isMissingRelationError(error)) return null;
  const err = error as { message?: string };
  const detail = err.message?.includes('market_stock_period_cache')
    ? MARKETS_EOD_MIGRATION_HINT
    : err.message?.includes('market_stock_eod')
      ? MARKETS_EOD_MIGRATION_HINT
      : MARKETS_EOD_MIGRATION_HINT;
  return detail;
}
