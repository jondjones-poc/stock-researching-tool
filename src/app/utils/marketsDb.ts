import { query } from './db';

export type MarketGroup = 'sector' | 'country';

export interface MarketRow {
  id: number;
  name: string;
  display_order: number;
  index_symbol: string | null;
  /** True when index_symbol is a broad country stand-in for this region */
  index_is_proxy?: boolean;
  market_group: MarketGroup;
  stocks: string[];
}

export type MarketHeatmapView = 'index' | 'stocks';

export function parseMarketHeatmapView(value: string | null): MarketHeatmapView {
  return value === 'index' ? 'index' : 'stocks';
}

export function parseMarketGroup(value: string | null): MarketGroup | 'all' {
  if (value === 'sector' || value === 'country') return value;
  return 'all';
}

export async function fetchMarketsWithStocks(
  group: MarketGroup | 'all' = 'all'
): Promise<MarketRow[]> {
  const params: unknown[] = [];
  let groupSql = '';
  if (group !== 'all') {
    params.push(group);
    groupSql = ` WHERE m.market_group = $1`;
  }

  const result = await query(
    `SELECT m.id, m.name, m.display_order, m.index_symbol,
            COALESCE(m.market_group, 'sector') AS market_group,
            ms.symbol, ms.stock_order
     FROM markets m
     LEFT JOIN market_stocks ms ON ms.market_id = m.id
     ${groupSql}
     ORDER BY m.display_order, m.name, ms.stock_order`,
    params
  );

  const byId = new Map<number, MarketRow>();
  for (const row of result.rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        display_order: row.display_order,
        index_symbol: row.index_symbol ? String(row.index_symbol).toUpperCase() : null,
        index_is_proxy: false,
        market_group: row.market_group === 'country' ? 'country' : 'sector',
        stocks: [],
      });
    }
    if (row.symbol) {
      byId.get(row.id)!.stocks.push(row.symbol);
    }
  }

  return [...byId.values()];
}

export function normalizeSymbol(value: unknown): string | null {
  const s = String(value || '').trim().toUpperCase();
  if (!s || !/^[A-Z][A-Z0-9.\-]{0,9}$/.test(s)) return null;
  return s;
}

export async function nextStockOrder(marketId: number): Promise<number> {
  const result = await query(
    'SELECT COALESCE(MAX(stock_order), 0) + 1 AS next_order FROM market_stocks WHERE market_id = $1',
    [marketId]
  );
  return result.rows[0].next_order;
}
