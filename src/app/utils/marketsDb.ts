import { query } from './db';

export interface MarketRow {
  id: number;
  name: string;
  display_order: number;
  stocks: string[];
}

export async function fetchMarketsWithStocks(): Promise<MarketRow[]> {
  const result = await query(
    `SELECT m.id, m.name, m.display_order, ms.symbol, ms.stock_order
     FROM markets m
     LEFT JOIN market_stocks ms ON ms.market_id = m.id
     ORDER BY m.display_order, m.name, ms.stock_order`
  );

  const byId = new Map<number, MarketRow>();
  for (const row of result.rows) {
    if (!byId.has(row.id)) {
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        display_order: row.display_order,
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
