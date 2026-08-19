import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';
import { enrichPortfolioStockMetrics } from '../../utils/portfolioStockMetrics';
import {
  computePositionMetrics,
  findHoldingForSymbol,
  loadPortfolioHoldingsIndex,
} from '../../utils/portfolioHoldings';
import { getUsdToGbpRate } from '../../utils/fxRates';
import { loadResearchSymbolLinks } from '../../utils/researchSymbolLinks';

type PortfolioRow = {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_default: boolean;
};

function migrationHint(error: unknown): Record<string, unknown> {
  const err = error as { code?: string };
  if (err.code === '42P01' || err.code === '42703') {
    return { hint: 'Run node scripts/apply-named-portfolios.mjs' };
  }
  return {};
}

async function listPortfolios(): Promise<PortfolioRow[]> {
  const result = await query(
    `SELECT id, slug, name, sort_order, is_default
     FROM portfolios
     ORDER BY sort_order ASC, id ASC`
  );
  return result.rows;
}

async function resolvePortfolio(opts: {
  id?: number | null;
  slug?: string | null;
}): Promise<PortfolioRow | null> {
  if (opts.id != null && Number.isFinite(opts.id)) {
    const result = await query(
      `SELECT id, slug, name, sort_order, is_default FROM portfolios WHERE id = $1 LIMIT 1`,
      [opts.id]
    );
    return result.rows[0] ?? null;
  }
  if (opts.slug) {
    const result = await query(
      `SELECT id, slug, name, sort_order, is_default FROM portfolios WHERE slug = $1 LIMIT 1`,
      [opts.slug]
    );
    return result.rows[0] ?? null;
  }
  const result = await query(
    `SELECT id, slug, name, sort_order, is_default
     FROM portfolios
     WHERE is_default = TRUE
     ORDER BY id
     LIMIT 1`
  );
  return result.rows[0] ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const slug = searchParams.get('portfolio') || searchParams.get('slug');
    const portfolioIdParam = searchParams.get('portfolio_id');
    const portfolioId = portfolioIdParam ? Number(portfolioIdParam) : null;

    const [portfolios, portfolio] = await Promise.all([
      listPortfolios(),
      resolvePortfolio({
        id: Number.isFinite(portfolioId) ? portfolioId : null,
        slug,
      }),
    ]);

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found', portfolios }, { status: 404 });
    }

    const result = await query(
      `SELECT
         ps.id,
         ps.portfolio_id,
         ps.stock_id,
         ps.created_at,
         ps.updated_at,
         sv.stock AS stock_symbol,
         sv.active_price,
         sv.change_pct,
         sv.bear_case_low_price
       FROM portfolio_stocks ps
       JOIN stock_valuations sv ON ps.stock_id = sv.id
       WHERE ps.portfolio_id = $1
       ORDER BY sv.stock ASC`,
      [portfolio.id]
    );

    const symbols = result.rows.map((row) => String(row.stock_symbol));
    const [{ dayChangeBySymbol, monthChangeBySymbol, livePriceBySymbol }, holdingsIndex, fx, symbolLinks] =
      await Promise.all([
      enrichPortfolioStockMetrics(symbols),
      loadPortfolioHoldingsIndex(),
      getUsdToGbpRate().catch(() => null),
      loadResearchSymbolLinks(),
    ]);

    return NextResponse.json({
      portfolio,
      portfolios,
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
        const storedPrice =
          row.active_price !== null && row.active_price !== undefined
            ? parseFloat(String(row.active_price))
            : null;
        const livePrice = livePriceBySymbol.get(symbol) ?? null;
        const activePrice =
          storedPrice != null && Number.isFinite(storedPrice) && storedPrice > 0
            ? storedPrice
            : livePrice;
        const holding = findHoldingForSymbol(holdingsIndex, symbol, symbolLinks);
        const position = computePositionMetrics(holding, activePrice);

        return {
          id: row.id,
          portfolio_id: Number(row.portfolio_id),
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
    if (err.code === '42P01' || err.code === '42703') {
      return NextResponse.json(
        {
          error: 'Named portfolios are not set up yet',
          ...migrationHint(error),
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stock_id } = body as { stock_id?: number; portfolio_id?: number; portfolio?: string };
    const portfolio = await resolvePortfolio({
      id: body.portfolio_id != null ? Number(body.portfolio_id) : null,
      slug: typeof body.portfolio === 'string' ? body.portfolio : null,
    });

    if (!portfolio) {
      return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 });
    }
    if (!stock_id) {
      return NextResponse.json({ error: 'stock_id is required' }, { status: 400 });
    }

    const existing = await query(
      'SELECT id FROM portfolio_stocks WHERE portfolio_id = $1 AND stock_id = $2',
      [portfolio.id, stock_id]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'This stock is already in this portfolio' }, { status: 409 });
    }

    const result = await query(
      `INSERT INTO portfolio_stocks (portfolio_id, stock_id)
       VALUES ($1, $2)
       RETURNING id, portfolio_id, stock_id, created_at, updated_at`,
      [portfolio.id, stock_id]
    );

    return NextResponse.json({ success: true, data: result.rows[0], portfolio }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01' || err.code === '42703') {
      return NextResponse.json(
        {
          error: 'Named portfolios are not set up yet',
          ...migrationHint(error),
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
