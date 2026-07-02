import { query } from './db';

export interface PortfolioHolding {
  shares: number;
  avgBuyCost: number;
}

function parseNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

/** Aggregate eToro portfolio_data by ticker symbol. */
export async function loadPortfolioHoldingsBySymbol(): Promise<Map<string, PortfolioHolding>> {
  const holdings = new Map<string, { shares: number; totalCost: number }>();

  try {
    const result = await query(
      `SELECT
         UPPER(COALESCE(NULLIF(TRIM(pd.ticker), ''), stc.symbol_full, '')) AS symbol,
         pd.shares_owned,
         pd.buy_cost
       FROM portfolio_data pd
       LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id
       WHERE (pd.is_settled IS NULL OR pd.is_settled = true)
         AND pd.shares_owned > 0`
    );

    for (const row of result.rows) {
      const symbol = String(row.symbol || '').trim().toUpperCase();
      if (!symbol || symbol.startsWith('INSTRUMENT_')) continue;

      const shares = parseNum(row.shares_owned);
      const buyCost = parseNum(row.buy_cost);
      if (shares <= 0) continue;

      const prev = holdings.get(symbol) ?? { shares: 0, totalCost: 0 };
      holdings.set(symbol, {
        shares: prev.shares + shares,
        totalCost: prev.totalCost + shares * buyCost,
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  const out = new Map<string, PortfolioHolding>();
  for (const [symbol, agg] of holdings) {
    out.set(symbol, {
      shares: agg.shares,
      avgBuyCost: agg.shares > 0 ? agg.totalCost / agg.shares : 0,
    });
  }
  return out;
}

export function findHoldingForSymbol(
  holdings: Map<string, PortfolioHolding>,
  stockSymbol: string
): PortfolioHolding | null {
  const upper = stockSymbol.trim().toUpperCase();
  if (!upper) return null;

  const direct = holdings.get(upper);
  if (direct) return direct;

  for (const [symbol, holding] of holdings) {
    const base = symbol.split('.')[0];
    if (base === upper || symbol === upper) return holding;
  }

  return null;
}

export function computePositionMetrics(
  holding: PortfolioHolding | null,
  activePrice: number | null
): {
  shares: number | null;
  avg_buy_cost: number | null;
  position_value: number | null;
  gain_loss_pct: number | null;
} {
  if (!holding || holding.shares <= 0 || activePrice == null || !Number.isFinite(activePrice)) {
    return {
      shares: holding?.shares ?? null,
      avg_buy_cost: holding?.avgBuyCost ?? null,
      position_value: null,
      gain_loss_pct: null,
    };
  }

  const positionValue = holding.shares * activePrice;
  const costBasis = holding.shares * holding.avgBuyCost;
  const gainPct = costBasis > 0 ? ((positionValue - costBasis) / costBasis) * 100 : null;

  return {
    shares: holding.shares,
    avg_buy_cost: holding.avgBuyCost,
    position_value: positionValue,
    gain_loss_pct: gainPct,
  };
}
