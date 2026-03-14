import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../utils/db';

// GET - Load portfolio data from database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const params: any[] = [];

    // Check if is_dividend column exists on stock_ticker_cache (source of truth for filter)
    let hasIsDividendColumn = false;
    try {
      const colCheck = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'is_dividend'`
      );
      hasIsDividendColumn = colCheck.rows.length > 0;
    } catch {
      // ignore
    }

    // Check if dividend_per_share exists on stock_ticker_cache (so we can COALESCE with pd)
    let hasStcDividendPerShare = false;
    try {
      const dpsCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'dividend_per_share'`
      );
      hasStcDividendPerShare = dpsCol.rows.length > 0;
    } catch {
      // ignore
    }

    const columnsWithoutIsDividend = `
        pd.position_id, pd.instrument_id,
        COALESCE(NULLIF(TRIM(pd.ticker), ''), stc.symbol_full) AS ticker,
        pd.shares_owned, pd.buy_cost, pd.current_price,
        pd.current_value, pd.gain_loss, pd.gain_loss_percent,
        ${hasStcDividendPerShare
          ? 'COALESCE(NULLIF(stc.dividend_per_share, 0), NULLIF(pd.dividend_per_share, 0), stc.dividend_per_share, pd.dividend_per_share) AS dividend_per_share'
          : 'pd.dividend_per_share'},
        pd.annual_dividend, pd.dividend_yield, pd.dividend_growth_rate,
        pd.pnl, pd.open_date_time, pd.settlement_type_id, pd.is_buy, pd.leverage, pd.amount,
        pd.initial_amount_in_dollars, pd.is_settled, pd.is_detached, pd.last_updated`;

    // is_dividend comes from stock_ticker_cache (canonical source), not portfolio_data
    const columnsWithIsDividend = `${columnsWithoutIsDividend},
        stc.is_dividend`;

    let sql = `SELECT ${hasIsDividendColumn ? columnsWithIsDividend : columnsWithoutIsDividend} FROM portfolio_data pd LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id`;

    if (activeOnly) {
      sql += ` WHERE pd.is_settled = true AND pd.shares_owned > 0`;
    }
    sql += ` ORDER BY COALESCE(NULLIF(TRIM(pd.ticker), ''), stc.symbol_full) ASC, pd.position_id ASC`;

    const result = await query(sql, params);

    const toIsDividend = (val: any): boolean => {
      if (val === true || val === 't' || val === 1) return true;
      if (val === false || val === 'f' || val === 0) return false;
      if (typeof val === 'string' && val.toLowerCase() === 'true') return true;
      if (typeof val === 'string' && val.toLowerCase() === 'false') return false;
      return true; // null/undefined treat as dividend
    };

    const stocks = result.rows.map((row: any) => ({
      positionId: row.position_id,
      instrumentId: row.instrument_id,
      ticker: row.ticker,
      sharesOwned: parseFloat(row.shares_owned) || 0,
      buyCost: parseFloat(row.buy_cost) || 0,
      currentPrice: parseFloat(row.current_price) || 0,
      currentValue: row.current_value ? parseFloat(row.current_value) : undefined,
      gainLoss: row.gain_loss ? parseFloat(row.gain_loss) : undefined,
      gainLossPercent: row.gain_loss_percent ? parseFloat(row.gain_loss_percent) : undefined,
      dividendPerShare: parseFloat(row.dividend_per_share) || 0,
      annualDividend: row.annual_dividend ? parseFloat(row.annual_dividend) : undefined,
      dividendYield: row.dividend_yield ? parseFloat(row.dividend_yield) : undefined,
      dividendGrowthRate: row.dividend_growth_rate !== null ? parseFloat(row.dividend_growth_rate) : null,
      pnl: row.pnl ? parseFloat(row.pnl) : undefined,
      openDateTime: row.open_date_time ? row.open_date_time.toISOString() : undefined,
      settlementTypeId: row.settlement_type_id,
      isBuy: row.is_buy,
      leverage: row.leverage,
      amount: row.amount ? parseFloat(row.amount) : undefined,
      initialAmountInDollars: row.initial_amount_in_dollars ? parseFloat(row.initial_amount_in_dollars) : undefined,
      isSettled: row.is_settled,
      isDetached: row.is_detached,
      lastUpdated: row.last_updated ? row.last_updated.toISOString() : undefined,
      // Always send boolean so Growth filter (isDividend === false) works; when column missing or null (no cache row), default true
      isDividend: hasIsDividendColumn ? toIsDividend(row.is_dividend) : true
    }));

    return NextResponse.json({
      stocks,
      count: stocks.length,
      message: `Loaded ${stocks.length} positions from database` + (!hasIsDividendColumn ? ' (stock_ticker_cache.is_dividend not present — add column to enable Dividend/Growth filter)' : ''),
      _debug: !hasIsDividendColumn ? { hasIsDividendColumn: false, hint: 'Add is_dividend to stock_ticker_cache for filter to work' } : undefined
    });

  } catch (error: any) {
    console.error('Error loading portfolio data:', error);
    return NextResponse.json(
      { error: 'Failed to load portfolio data', details: error.message },
      { status: 500 }
    );
  }
}
