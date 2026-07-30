import axios from 'axios';
import { isMarketFlowMockMode } from '../config/marketFlow';
import { query } from './db';

export interface MarketFlowHolding {
  symbol: string;
  name: string;
  weightPct: number | null;
  rank: number;
}

const HOLDINGS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Deterministic fallback holdings when FMP is unavailable / mock mode. */
const MOCK_HOLDINGS: Record<string, Array<{ symbol: string; name: string; weight: number }>> = {
  SPY: [
    { symbol: 'AAPL', name: 'Apple', weight: 7.1 },
    { symbol: 'MSFT', name: 'Microsoft', weight: 6.8 },
    { symbol: 'NVDA', name: 'NVIDIA', weight: 6.2 },
    { symbol: 'AMZN', name: 'Amazon', weight: 3.9 },
    { symbol: 'META', name: 'Meta', weight: 2.8 },
    { symbol: 'GOOGL', name: 'Alphabet A', weight: 2.1 },
    { symbol: 'GOOG', name: 'Alphabet C', weight: 1.8 },
    { symbol: 'BRK.B', name: 'Berkshire B', weight: 1.7 },
    { symbol: 'AVGO', name: 'Broadcom', weight: 1.6 },
    { symbol: 'TSLA', name: 'Tesla', weight: 1.5 },
  ],
  IWM: [
    { symbol: 'SMCI', name: 'Super Micro', weight: 1.2 },
    { symbol: 'MSTR', name: 'MicroStrategy', weight: 0.9 },
    { symbol: 'CVNA', name: 'Carvana', weight: 0.7 },
    { symbol: 'FTAI', name: 'FTAI Aviation', weight: 0.6 },
    { symbol: 'FIX', name: 'Comfort Systems', weight: 0.5 },
    { symbol: 'ONTO', name: 'Onto Innovation', weight: 0.5 },
    { symbol: 'FN', name: 'Fabrinet', weight: 0.5 },
    { symbol: 'UFPI', name: 'UFP Industries', weight: 0.4 },
    { symbol: 'SSB', name: 'SouthState', weight: 0.4 },
    { symbol: 'WFRD', name: 'Weatherford', weight: 0.4 },
  ],
  EWU: [
    { symbol: 'AZN', name: 'AstraZeneca', weight: 8.5 },
    { symbol: 'SHEL', name: 'Shell', weight: 7.2 },
    { symbol: 'HSBA', name: 'HSBC', weight: 6.1 },
    { symbol: 'ULVR', name: 'Unilever', weight: 5.4 },
    { symbol: 'BP', name: 'BP', weight: 4.2 },
    { symbol: 'REL', name: 'RELX', weight: 3.8 },
    { symbol: 'GSK', name: 'GSK', weight: 3.6 },
    { symbol: 'DGE', name: 'Diageo', weight: 3.3 },
    { symbol: 'RIO', name: 'Rio Tinto', weight: 3.1 },
    { symbol: 'BATS', name: 'BAT', weight: 2.9 },
  ],
  EWQ: [
    { symbol: 'MC', name: 'LVMH', weight: 12.0 },
    { symbol: 'TTE', name: 'TotalEnergies', weight: 8.5 },
    { symbol: 'SAN', name: 'Sanofi', weight: 7.2 },
    { symbol: 'AIR', name: 'Airbus', weight: 6.4 },
    { symbol: 'OR', name: "L'Oréal", weight: 6.1 },
    { symbol: 'SU', name: 'Schneider', weight: 5.5 },
    { symbol: 'AI', name: 'Air Liquide', weight: 5.2 },
    { symbol: 'BNP', name: 'BNP Paribas', weight: 4.8 },
    { symbol: 'SAF', name: 'Safran', weight: 4.1 },
    { symbol: 'EL', name: 'EssilorLuxottica', weight: 3.9 },
  ],
  MCHI: [
    { symbol: 'TSM', name: 'TSMC ADR proxy', weight: 0 },
    { symbol: 'BABA', name: 'Alibaba', weight: 9.5 },
    { symbol: '0700.HK', name: 'Tencent', weight: 9.0 },
    { symbol: 'PDD', name: 'PDD Holdings', weight: 4.2 },
    { symbol: 'MEITUAN', name: 'Meituan', weight: 3.8 },
    { symbol: 'NIO', name: 'NIO', weight: 2.1 },
    { symbol: 'BIDU', name: 'Baidu', weight: 2.0 },
    { symbol: 'JD', name: 'JD.com', weight: 1.9 },
    { symbol: 'LI', name: 'Li Auto', weight: 1.7 },
    { symbol: 'XPEV', name: 'XPeng', weight: 1.4 },
  ],
  EEM: [
    { symbol: 'TSM', name: 'TSMC', weight: 8.0 },
    { symbol: '0700.HK', name: 'Tencent', weight: 4.5 },
    { symbol: 'BABA', name: 'Alibaba', weight: 3.2 },
    { symbol: 'SMSN', name: 'Samsung', weight: 3.0 },
    { symbol: 'RELIANCE', name: 'Reliance', weight: 2.5 },
    { symbol: 'INFY', name: 'Infosys', weight: 1.8 },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', weight: 1.6 },
    { symbol: 'VALE', name: 'Vale', weight: 1.4 },
    { symbol: 'PBR', name: 'Petrobras', weight: 1.3 },
    { symbol: 'IHS', name: 'IHS Holding', weight: 1.0 },
  ],
};

function mockHoldingsForSymbol(etfSymbol: string): MarketFlowHolding[] {
  const seed = MOCK_HOLDINGS[etfSymbol.toUpperCase()] ?? [
    { symbol: `${etfSymbol}1`, name: `${etfSymbol} holding 1`, weight: 8 },
    { symbol: `${etfSymbol}2`, name: `${etfSymbol} holding 2`, weight: 6 },
    { symbol: `${etfSymbol}3`, name: `${etfSymbol} holding 3`, weight: 5 },
    { symbol: `${etfSymbol}4`, name: `${etfSymbol} holding 4`, weight: 4 },
    { symbol: `${etfSymbol}5`, name: `${etfSymbol} holding 5`, weight: 3.5 },
    { symbol: `${etfSymbol}6`, name: `${etfSymbol} holding 6`, weight: 3 },
    { symbol: `${etfSymbol}7`, name: `${etfSymbol} holding 7`, weight: 2.5 },
    { symbol: `${etfSymbol}8`, name: `${etfSymbol} holding 8`, weight: 2 },
    { symbol: `${etfSymbol}9`, name: `${etfSymbol} holding 9`, weight: 1.8 },
    { symbol: `${etfSymbol}10`, name: `${etfSymbol} holding 10`, weight: 1.5 },
  ];
  return seed.slice(0, 10).map((h, i) => ({
    symbol: h.symbol,
    name: h.name,
    weightPct: h.weight,
    rank: i + 1,
  }));
}

function parseFmpHoldings(data: unknown): MarketFlowHolding[] {
  const raw = Array.isArray(data) ? data : [];
  const parsed: Array<{ symbol: string; name: string; weight: number }> = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const symbol = String(
      row.asset ?? row.symbol ?? row.ticker ?? row.holdingSymbol ?? ''
    )
      .trim()
      .toUpperCase();
    if (!symbol) continue;
    const name = String(row.name ?? row.assetName ?? row.securityName ?? symbol);
    const weight = Number(
      row.weightPercentage ?? row.weight ?? row.percent ?? row.portfolioPercent ?? NaN
    );
    parsed.push({
      symbol,
      name,
      weight: Number.isFinite(weight) ? weight : 0,
    });
  }

  parsed.sort((a, b) => b.weight - a.weight);
  return parsed.slice(0, 10).map((h, i) => ({
    symbol: h.symbol,
    name: h.name,
    weightPct: h.weight > 0 ? h.weight : null,
    rank: i + 1,
  }));
}

export async function fetchEtfHoldings(symbol: string): Promise<{
  holdings: MarketFlowHolding[];
  source: 'mock' | 'fmp';
}> {
  if (isMarketFlowMockMode() || !process.env.FMP_API_KEY?.trim()) {
    return { holdings: mockHoldingsForSymbol(symbol), source: 'mock' };
  }

  const key = process.env.FMP_API_KEY.trim();
  const url = `https://financialmodelingprep.com/stable/etf/holdings?symbol=${encodeURIComponent(symbol)}&apikey=${key}`;
  const response = await axios.get(url, { timeout: 25000, validateStatus: () => true });

  if (response.status !== 200 || !Array.isArray(response.data)) {
    // Fall back to mock so Ask AI still has something useful
    return { holdings: mockHoldingsForSymbol(symbol), source: 'mock' };
  }

  const holdings = parseFmpHoldings(response.data);
  if (holdings.length === 0) {
    return { holdings: mockHoldingsForSymbol(symbol), source: 'mock' };
  }
  return { holdings, source: 'fmp' };
}

export async function replaceFundHoldings(
  fundId: number,
  holdings: MarketFlowHolding[]
): Promise<void> {
  await query(`DELETE FROM market_flow_holdings WHERE fund_id = $1`, [fundId]);
  for (const h of holdings) {
    await query(
      `INSERT INTO market_flow_holdings
         (fund_id, holding_symbol, holding_name, weight_pct, rank_no, fetched_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (fund_id, holding_symbol) DO UPDATE SET
         holding_name = EXCLUDED.holding_name,
         weight_pct = EXCLUDED.weight_pct,
         rank_no = EXCLUDED.rank_no,
         fetched_at = CURRENT_TIMESTAMP`,
      [fundId, h.symbol, h.name, h.weightPct, h.rank]
    );
  }
  await query(
    `UPDATE market_flow_fund_meta
     SET holdings_fetched_at = CURRENT_TIMESTAMP
     WHERE fund_id = $1`,
    [fundId]
  );
}

export async function listHoldingsForFunds(
  fundIds: number[]
): Promise<Map<number, MarketFlowHolding[]>> {
  const map = new Map<number, MarketFlowHolding[]>();
  if (fundIds.length === 0) return map;

  try {
    const placeholders = fundIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `SELECT fund_id, holding_symbol, holding_name, weight_pct, rank_no
       FROM market_flow_holdings
       WHERE fund_id IN (${placeholders})
       ORDER BY fund_id ASC, rank_no ASC`,
      fundIds
    );
    for (const row of result.rows) {
      const fundId = Number(row.fund_id);
      const list = map.get(fundId) ?? [];
      list.push({
        symbol: String(row.holding_symbol),
        name: String(row.holding_name ?? ''),
        weightPct: row.weight_pct != null ? Number(row.weight_pct) : null,
        rank: Number(row.rank_no),
      });
      map.set(fundId, list);
    }
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code !== '42P01') throw e;
  }
  return map;
}

export async function listHoldingsBySymbol(
  symbols: string[]
): Promise<Map<string, MarketFlowHolding[]>> {
  const map = new Map<string, MarketFlowHolding[]>();
  if (symbols.length === 0) return map;
  try {
    const placeholders = symbols.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(
      `SELECT f.symbol AS etf_symbol, h.holding_symbol, h.holding_name, h.weight_pct, h.rank_no
       FROM market_flow_holdings h
       JOIN market_flow_funds f ON f.id = h.fund_id
       WHERE UPPER(f.symbol) IN (${placeholders})
       ORDER BY f.symbol ASC, h.rank_no ASC`,
      symbols.map((s) => s.toUpperCase())
    );
    for (const row of result.rows) {
      const etf = String(row.etf_symbol).toUpperCase();
      const list = map.get(etf) ?? [];
      list.push({
        symbol: String(row.holding_symbol),
        name: String(row.holding_name ?? ''),
        weightPct: row.weight_pct != null ? Number(row.weight_pct) : null,
        rank: Number(row.rank_no),
      });
      map.set(etf, list);
    }
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code !== '42P01') throw e;
  }
  return map;
}

export async function holdingsNeedRefresh(fundId: number): Promise<boolean> {
  try {
    const result = await query(
      `SELECT holdings_fetched_at FROM market_flow_fund_meta WHERE fund_id = $1`,
      [fundId]
    );
    const at = result.rows[0]?.holdings_fetched_at
      ? new Date(String(result.rows[0].holdings_fetched_at)).getTime()
      : 0;
    if (!at || Number.isNaN(at)) return true;
    return Date.now() - at > HOLDINGS_TTL_MS;
  } catch {
    return true;
  }
}

export async function refreshFundHoldingsIfStale(
  fundId: number,
  symbol: string,
  force = false
): Promise<{ refreshed: boolean; count: number; source?: string }> {
  if (!force && !(await holdingsNeedRefresh(fundId))) {
    return { refreshed: false, count: 0 };
  }
  const { holdings, source } = await fetchEtfHoldings(symbol);
  await replaceFundHoldings(fundId, holdings);
  return { refreshed: true, count: holdings.length, source };
}
