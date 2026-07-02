import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';
import { enrichPortfolioStockMetrics } from '../../utils/portfolioStockMetrics';
import {
  computePositionMetrics,
  findHoldingForSymbol,
  loadPortfolioHoldingsBySymbol,
} from '../../utils/portfolioHoldings';
import { getUsdToGbpRate } from '../../utils/fxRates';

// GET - All portfolio stocks (all-time)
export async function GET() {
  try {
    const result = await query(
      `SELECT
         ps.id,
         ps.stock_id,
         ps.created_at,
         ps.updated_at,
         sv.stock AS stock_symbol,
         sv.active_price,
         sv.change_pct,
         sv.bear_case_low_price
       FROM portfolio_stocks ps
       JOIN stock_valuations sv ON ps.stock_id = sv.id
       ORDER BY sv.stock ASC`
    );

    const symbols = result.rows.map((row) => String(row.stock_symbol));
    const [{ dayChangeBySymbol, monthChangeBySymbol }, holdingsBySymbol, fx] = await Promise.all([
      enrichPortfolioStockMetrics(symbols),
      loadPortfolioHoldingsBySymbol(),
      getUsdToGbpRate().catch(() => null),
    ]);

    return NextResponse.json({
      currency: fx ? 'GBP' : 'USD',
      fx: fx
        ? {
            usd_to_gbp: fx.rate,
            rate_date: fx.rateDate,
            fetched_at: fx.fetchedAt,
            from_cache: fx.fromCache,
            stale: fx.stale,
            source: fx.source,
            note: 'USD prices converted to GBP using ECB reference rates (Frankfurter). Cached up to 24h.',
          }
        : null,
      data: result.rows.map((row) => {
        const symbol = String(row.stock_symbol).toUpperCase();
        const storedChangePct =
          row.change_pct !== null && row.change_pct !== undefined
            ? parseFloat(String(row.change_pct))
            : null;
        const dayChange =
          dayChangeBySymbol.get(symbol) ??
          (storedChangePct != null && Number.isFinite(storedChangePct) ? storedChangePct : null);
        const activePrice =
          row.active_price !== null && row.active_price !== undefined
            ? parseFloat(String(row.active_price))
            : null;
        const holding = findHoldingForSymbol(holdingsBySymbol, symbol);
        const position = computePositionMetrics(holding, activePrice);

        return {
          id: row.id,
          stock_id: row.stock_id,
          stock_symbol: row.stock_symbol,
          active_price: activePrice,
          bear_case_low_price:
            row.bear_case_low_price !== null && row.bear_case_low_price !== undefined
              ? parseFloat(String(row.bear_case_low_price))
              : null,
          day_change_pct: dayChange,
          month_change_pct: monthChangeBySymbol.get(symbol) ?? null,
          shares: position.shares,
          avg_buy_cost: position.avg_buy_cost,
          position_value: position.position_value,
          gain_loss_pct: position.gain_loss_pct,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      }),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'portfolio_stocks table does not exist',
          hint: 'Run node scripts/apply-portfolio-stocks.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to fetch portfolio stocks', details: err.message },
      { status: 500 }
    );
  }
}

// POST - Add stock to portfolio
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_id } = body as { stock_id?: number };

    if (!stock_id) {
      return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
    }

    const existing = await query('SELECT id FROM portfolio_stocks WHERE stock_id = $1', [stock_id]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'This stock is already in your portfolio' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO portfolio_stocks (stock_id)
       VALUES ($1)
       RETURNING id, stock_id, created_at, updated_at`,
      [stock_id]
    );

    return NextResponse.json({ success: true, data: result.rows[0] }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'portfolio_stocks table does not exist',
          hint: 'Run node scripts/apply-portfolio-stocks.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to add portfolio stock', details: err.message },
      { status: 500 }
    );
  }
}

// DELETE - Remove from portfolio
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'ID parameter is required' }, { status: 400 });
  }

  try {
    const result = await query('DELETE FROM portfolio_stocks WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Portfolio entry not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Stock removed from portfolio' });
  } catch (error: unknown) {
    const err = error as { message?: string };
    return NextResponse.json(
      { error: 'Failed to delete portfolio stock', details: err.message },
      { status: 500 }
    );
  }
}
