import { query } from './db';
import { isUsableEtoroTicker, SQL_ETORO_RESOLVED_TICKER } from './etoroTicker';
import { MIN_ACTIVE_ETORO_UNITS } from './etoroPositionFilter';
import { loadResearchSymbolLinks } from './researchSymbolLinks';
import { symbolMatchKeys, symbolsMatch, type ResearchSymbolLinks } from './symbolMatch';

export interface PortfolioHolding {
  shares: number;
  avgBuyCost: number;
}

export interface PortfolioHoldingsIndex {
  bySymbol: Map<string, PortfolioHolding>;
  byInstrumentId: Map<number, PortfolioHolding>;
}

function parseNum(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function mergeHoldings(a: PortfolioHolding | null, b: PortfolioHolding): PortfolioHolding {
  if (!a) return b;
  const shares = a.shares + b.shares;
  const totalCost = a.shares * a.avgBuyCost + b.shares * b.avgBuyCost;
  return {
    shares,
    avgBuyCost: shares > 0 ? totalCost / shares : 0,
  };
}

function registerSymbol(
  bySymbol: Map<string, PortfolioHolding>,
  symbol: string,
  holding: PortfolioHolding,
  links: ResearchSymbolLinks
): void {
  for (const key of symbolMatchKeys(symbol, links)) {
    const existing = bySymbol.get(key);
    bySymbol.set(key, existing ? mergeHoldings(existing, holding) : holding);
  }
}

/** Aggregate eToro portfolio_data by symbol and instrument_id. */
export async function loadPortfolioHoldingsIndex(): Promise<PortfolioHoldingsIndex> {
  const links = await loadResearchSymbolLinks();
  const instrumentAgg = new Map<number, { shares: number; totalCost: number }>();

  try {
    const hasResearchSymbol = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'research_symbol'`
    ).then((r) => r.rows.length > 0);

    const result = await query(
      `SELECT
         pd.instrument_id,
         ${SQL_ETORO_RESOLVED_TICKER} AS symbol,
         pd.shares_owned,
         pd.buy_cost
       FROM portfolio_data pd
       LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id
       WHERE (pd.is_settled IS NULL OR pd.is_settled = true)
         AND pd.shares_owned >= $1
         AND pd.instrument_id IS NOT NULL`,
      [MIN_ACTIVE_ETORO_UNITS]
    );

    for (const row of result.rows) {
      const instrumentId = Number(row.instrument_id);
      const shares = parseNum(row.shares_owned);
      const buyCost = parseNum(row.buy_cost);
      if (!Number.isFinite(instrumentId) || shares <= 0) continue;

      const prev = instrumentAgg.get(instrumentId) ?? { shares: 0, totalCost: 0 };
      instrumentAgg.set(instrumentId, {
        shares: prev.shares + shares,
        totalCost: prev.totalCost + shares * buyCost,
      });
    }

    const byInstrumentId = new Map<number, PortfolioHolding>();
    for (const [id, agg] of instrumentAgg) {
      byInstrumentId.set(id, {
        shares: agg.shares,
        avgBuyCost: agg.shares > 0 ? agg.totalCost / agg.shares : 0,
      });
    }

    const bySymbol = new Map<string, PortfolioHolding>();
    const registered = new Set<number>();
    const instrumentIds = [...byInstrumentId.keys()];

    if (instrumentIds.length > 0) {
      const placeholders = instrumentIds.map((_, i) => `$${i + 1}`).join(',');
      const cacheCols = hasResearchSymbol
        ? 'instrument_id, symbol_full, research_symbol'
        : 'instrument_id, symbol_full';
      const cacheResult = await query(
        `SELECT ${cacheCols}
         FROM stock_ticker_cache
         WHERE instrument_id IN (${placeholders})`,
        instrumentIds
      );

      for (const row of cacheResult.rows) {
        const instrumentId = Number(row.instrument_id);
        const symbol = String(row.symbol_full || '').trim();
        const researchSymbol = hasResearchSymbol
          ? String(row.research_symbol || '').trim().toUpperCase()
          : '';
        const holding = byInstrumentId.get(instrumentId);
        if (!holding) continue;

        if (!registered.has(instrumentId)) {
          if (isUsableEtoroTicker(symbol)) registerSymbol(bySymbol, symbol, holding, links);
          if (isUsableEtoroTicker(researchSymbol)) registerSymbol(bySymbol, researchSymbol, holding, links);
          registered.add(instrumentId);
        }
      }

      for (const row of result.rows) {
        const instrumentId = Number(row.instrument_id);
        if (registered.has(instrumentId)) continue;
        const symbol = String(row.symbol || '').trim().toUpperCase();
        if (!isUsableEtoroTicker(symbol)) continue;
        const holding = byInstrumentId.get(instrumentId);
        if (holding) {
          registerSymbol(bySymbol, symbol, holding, links);
          registered.add(instrumentId);
        }
      }
    }

    return { bySymbol, byInstrumentId };
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
    return { bySymbol: new Map(), byInstrumentId: new Map() };
  }
}

/** @deprecated Use loadPortfolioHoldingsIndex */
export async function loadPortfolioHoldingsBySymbol(): Promise<Map<string, PortfolioHolding>> {
  const index = await loadPortfolioHoldingsIndex();
  return index.bySymbol;
}

export function findHoldingForSymbol(
  index: PortfolioHoldingsIndex | Map<string, PortfolioHolding>,
  stockSymbol: string,
  links?: ResearchSymbolLinks
): PortfolioHolding | null {
  const bySymbol = index instanceof Map ? index : index.bySymbol;
  const upper = stockSymbol.trim().toUpperCase();
  if (!upper) return null;

  for (const key of symbolMatchKeys(upper, links)) {
    const holding = bySymbol.get(key);
    if (holding) return holding;
  }

  for (const [symbol, holding] of bySymbol) {
    if (symbolsMatch(symbol, upper, links)) return holding;
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
  if (!holding || holding.shares <= 0 || activePrice == null || !Number.isFinite(activePrice) || activePrice <= 0) {
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
