import { NextResponse } from 'next/server';
import { query } from '@/app/utils/db';
import { isUsableEtoroTicker, SQL_ETORO_RESOLVED_TICKER } from '@/app/utils/etoroTicker';
import { MIN_ACTIVE_ETORO_UNITS } from '@/app/utils/etoroPositionFilter';

/** GET - Which portfolio_data instrument IDs lack a resolved ticker in stock_ticker_cache */
export async function GET() {
  try {
    const result = await query(
      `SELECT DISTINCT ON (pd.instrument_id)
         pd.instrument_id,
         NULLIF(TRIM(pd.ticker), '') AS portfolio_ticker,
         stc.symbol_full AS cached_symbol,
         stc.display_name AS cached_name,
         ${SQL_ETORO_RESOLVED_TICKER} AS resolved_ticker
       FROM portfolio_data pd
       LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id
       WHERE pd.instrument_id IS NOT NULL
         AND pd.shares_owned >= $1
       ORDER BY pd.instrument_id`,
      [MIN_ACTIVE_ETORO_UNITS]
    );

    const rows = result.rows.map((row: Record<string, unknown>) => {
      const instrumentId = Number(row.instrument_id);
      const portfolioTicker = row.portfolio_ticker ? String(row.portfolio_ticker) : null;
      const cachedSymbol = row.cached_symbol ? String(row.cached_symbol) : null;
      const resolved = row.resolved_ticker ? String(row.resolved_ticker) : null;
      return {
        instrumentId,
        portfolioTicker,
        cachedSymbol,
        cachedName: row.cached_name ? String(row.cached_name) : null,
        resolvedSymbol: isUsableEtoroTicker(resolved) ? resolved : null,
        mapped: isUsableEtoroTicker(resolved),
      };
    });

    const unmapped = rows.filter((r) => !r.mapped);

    return NextResponse.json({
      total: rows.length,
      mapped: rows.length - unmapped.length,
      unmapped: unmapped.length,
      rows,
      unmappedIds: unmapped.map((r) => r.instrumentId),
    });
  } catch (e: unknown) {
    console.error('symbol-mapping-status error:', e);
    return NextResponse.json(
      { error: 'Failed to load symbol mapping status', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
