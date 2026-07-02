/** True when a ticker/symbol is safe to display or join on (not a placeholder). */
export function isUsableEtoroTicker(ticker: string | null | undefined): boolean {
  if (!ticker?.trim()) return false;
  const upper = ticker.trim().toUpperCase();
  if (upper.startsWith('INSTRUMENT_')) return false;
  if (upper === 'UNKNOWN' || upper === '—') return false;
  return true;
}

/** Prefer stock_ticker_cache over portfolio_data; ignore placeholder tickers. Requires pd + stc aliases. */
export const SQL_ETORO_RESOLVED_TICKER = `COALESCE(
  CASE
    WHEN stc.symbol_full IS NOT NULL
      AND TRIM(stc.symbol_full) <> ''
      AND UPPER(TRIM(stc.symbol_full)) NOT LIKE 'INSTRUMENT_%'
      AND UPPER(TRIM(stc.symbol_full)) NOT IN ('UNKNOWN', '—')
    THEN TRIM(stc.symbol_full)
  END,
  CASE
    WHEN pd.ticker IS NOT NULL
      AND TRIM(pd.ticker) <> ''
      AND UPPER(TRIM(pd.ticker)) NOT LIKE 'INSTRUMENT_%'
      AND UPPER(TRIM(pd.ticker)) NOT IN ('UNKNOWN', '—')
    THEN TRIM(pd.ticker)
  END
)`;
