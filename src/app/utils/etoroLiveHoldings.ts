import axios from 'axios';
import { randomUUID } from 'crypto';
import { query } from './db';
import { isActiveEtoroStockPosition } from './etoroPositionFilter';
import { isUsableEtoroTicker } from './etoroTicker';

const HOLDINGS_CACHE_TTL_MS = 45_000;

export type EtoroLiveHolding = {
  instrumentId: number;
  ticker: string;
  symbol: string;
  shares: number;
  avgBuyCost: number;
  currentPrice: number | null;
};

type EtoroPosition = {
  instrumentID?: number;
  instrumentId?: number;
  units?: number;
  openRate?: number;
  closeRate?: number;
  isBuy?: boolean;
  settlementTypeID?: number;
  settlementTypeId?: number;
  isDetached?: boolean;
  unrealizedPnL?: { closeRate?: number };
};

type TickerRow = {
  ticker: string;
  symbol: string;
};

let holdingsCache: { fetchedAt: number; holdings: EtoroLiveHolding[] } | null = null;
let holdingsInFlight: Promise<EtoroLiveHolding[]> | null = null;

export function displaySymbolFromEtoroTicker(ticker: string, researchSymbol?: string | null): string {
  const research = researchSymbol?.trim().toUpperCase();
  if (research && isUsableEtoroTicker(research)) return research.split('.')[0];

  const upper = ticker.trim().toUpperCase();
  if (!isUsableEtoroTicker(upper)) return upper;
  return upper.split('.')[0];
}

export function aggregateEtoroPositions(
  positions: Array<{
    instrumentId: number;
    ticker: string;
    symbol: string;
    shares: number;
    avgBuyCost: number;
    currentPrice: number | null;
  }>
): EtoroLiveHolding[] {
  const byInstrument = new Map<
    number,
    { ticker: string; symbol: string; shares: number; cost: number; currentPrice: number | null }
  >();

  for (const position of positions) {
    if (!Number.isFinite(position.instrumentId) || position.shares <= 0) continue;
    const prev = byInstrument.get(position.instrumentId) ?? {
      ticker: position.ticker,
      symbol: position.symbol,
      shares: 0,
      cost: 0,
      currentPrice: position.currentPrice,
    };
    prev.shares += position.shares;
    prev.cost += position.shares * position.avgBuyCost;
    if (prev.currentPrice == null && position.currentPrice != null) {
      prev.currentPrice = position.currentPrice;
    }
    if (isUsableEtoroTicker(position.ticker)) prev.ticker = position.ticker;
    if (isUsableEtoroTicker(position.symbol)) prev.symbol = position.symbol;
    byInstrument.set(position.instrumentId, prev);
  }

  return [...byInstrument.entries()]
    .map(([instrumentId, row]) => ({
      instrumentId,
      ticker: row.ticker,
      symbol: row.symbol,
      shares: row.shares,
      avgBuyCost: row.shares > 0 ? row.cost / row.shares : 0,
      currentPrice: row.currentPrice,
    }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function etoroCredentials(): { publicKey: string; privateKey: string; accountType: 'real' | 'demo' } {
  const publicKey = process.env.ETORO_PUBLIC_KEY?.trim() || '';
  const privateKey = process.env.ETORO_PRIVATE_KEY?.trim() || '';
  if (!publicKey || !privateKey) {
    throw new Error('ETORO_PUBLIC_KEY and ETORO_PRIVATE_KEY must be set to load eToro holdings');
  }
  const accountType = process.env.ETORO_ACCOUNT_TYPE?.trim().toLowerCase() === 'demo' ? 'demo' : 'real';
  return { publicKey, privateKey, accountType };
}

async function resolveInstrumentTickers(instrumentIds: number[]): Promise<Map<number, TickerRow>> {
  const map = new Map<number, TickerRow>();
  if (instrumentIds.length === 0) return map;

  const placeholders = instrumentIds.map((_, i) => `$${i + 1}`).join(',');

  const hasResearchSymbol = await query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'research_symbol'`
  )
    .then((result) => result.rows.length > 0)
    .catch(() => false);

  try {
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
      const ticker = String(row.symbol_full || '').trim();
      const research = hasResearchSymbol ? String(row.research_symbol || '').trim() : '';
      if (!Number.isFinite(instrumentId) || !isUsableEtoroTicker(ticker)) continue;
      map.set(instrumentId, {
        ticker,
        symbol: displaySymbolFromEtoroTicker(ticker, research),
      });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== '42P01') throw error;
  }

  const missing = instrumentIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const missingPlaceholders = missing.map((_, i) => `$${i + 1}`).join(',');
  try {
    const legacy = await query(
      `SELECT instrument_id, symbol
       FROM etoro_instruments
       WHERE instrument_id IN (${missingPlaceholders})`,
      missing
    );
    for (const row of legacy.rows) {
      const instrumentId = Number(row.instrument_id);
      const ticker = String(row.symbol || '').trim();
      if (!Number.isFinite(instrumentId) || !isUsableEtoroTicker(ticker) || map.has(instrumentId)) continue;
      map.set(instrumentId, {
        ticker,
        symbol: displaySymbolFromEtoroTicker(ticker),
      });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== '42P01') throw error;
  }

  const stillMissing = instrumentIds.filter((id) => !map.has(id));
  if (stillMissing.length === 0) return map;

  const stillPlaceholders = stillMissing.map((_, i) => `$${i + 1}`).join(',');
  try {
    const saved = await query(
      `SELECT DISTINCT ON (instrument_id) instrument_id, ticker
       FROM portfolio_data
       WHERE instrument_id IN (${stillPlaceholders})
       ORDER BY instrument_id, last_updated DESC NULLS LAST`,
      stillMissing
    );
    for (const row of saved.rows) {
      const instrumentId = Number(row.instrument_id);
      const ticker = String(row.ticker || '').trim();
      if (!Number.isFinite(instrumentId) || !isUsableEtoroTicker(ticker) || map.has(instrumentId)) continue;
      map.set(instrumentId, {
        ticker,
        symbol: displaySymbolFromEtoroTicker(ticker),
      });
    }
  } catch (error: unknown) {
    if ((error as { code?: string }).code !== '42P01') throw error;
  }

  return map;
}

async function fetchEtoroLiveHoldingsUncached(): Promise<EtoroLiveHolding[]> {
  const { publicKey, privateKey, accountType } = etoroCredentials();
  const response = await axios.get(
    `https://public-api.etoro.com/api/v1/trading/info/${accountType}/pnl`,
    {
      headers: {
        'x-request-id': randomUUID(),
        'x-api-key': publicKey,
        'x-user-key': privateKey,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
      validateStatus: () => true,
    }
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error('eToro rejected ETORO_PUBLIC_KEY / ETORO_PRIVATE_KEY');
  }
  if (response.status === 429) {
    throw new Error('eToro rate limit reached. Wait a moment and reload.');
  }
  if (response.status !== 200) {
    const details =
      response.data?.message || response.data?.error || response.statusText || '';
    throw new Error(
      `eToro positions failed (${response.status})${details ? `: ${String(details).slice(0, 180)}` : ''}`
    );
  }

  const portfolio = response.data?.clientPortfolio;
  if (!portfolio) {
    throw new Error('eToro did not return a portfolio');
  }

  const rawPositions: EtoroPosition[] = Array.isArray(portfolio.positions) ? portfolio.positions : [];
  const stockPositions = rawPositions.filter((pos) => isActiveEtoroStockPosition(pos));
  const instrumentIds = [
    ...new Set(
      stockPositions
        .map((pos) => Number(pos.instrumentID ?? pos.instrumentId))
        .filter((id) => Number.isFinite(id) && id > 0)
    ),
  ];
  const tickers = await resolveInstrumentTickers(instrumentIds);

  const mapped = stockPositions.map((pos) => {
    const instrumentId = Number(pos.instrumentID ?? pos.instrumentId);
    const tickerRow = tickers.get(instrumentId);
    const ticker = tickerRow?.ticker || `INSTRUMENT_${instrumentId}`;
    const currentPrice = Number(pos.closeRate ?? pos.unrealizedPnL?.closeRate ?? pos.openRate);
    return {
      instrumentId,
      ticker,
      symbol: tickerRow?.symbol || displaySymbolFromEtoroTicker(ticker),
      shares: Number(pos.units) || 0,
      avgBuyCost: Number(pos.openRate) || 0,
      currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
    };
  });

  return aggregateEtoroPositions(mapped);
}

export async function fetchEtoroLiveHoldings(
  options?: { force?: boolean }
): Promise<EtoroLiveHolding[]> {
  const now = Date.now();
  if (!options?.force && holdingsCache && now - holdingsCache.fetchedAt < HOLDINGS_CACHE_TTL_MS) {
    return holdingsCache.holdings;
  }
  if (holdingsInFlight) return holdingsInFlight;

  holdingsInFlight = fetchEtoroLiveHoldingsUncached()
    .then((holdings) => {
      holdingsCache = { fetchedAt: Date.now(), holdings };
      return holdings;
    })
    .finally(() => {
      holdingsInFlight = null;
    });

  return holdingsInFlight;
}
