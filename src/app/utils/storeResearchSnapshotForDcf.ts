import Decimal from 'decimal.js';
import type { DCFData } from './dcfData';

/** Shape accepted from Company Research, Watchlist refresh, or API fetch helper */
export type ResearchSnapshotForDcfInput = {
  /** Required for storage; optional on partial objects (e.g. InsiderData typing). */
  symbol?: string;
  financials?: {
    grossProfitMargin?: number;
    revenue?: number;
    netIncome?: number;
    eps?: number;
  } | null;
  peRatios?: {
    currentPE?: number;
    currentPrice?: number;
    dividendPerShare?: number;
    epsTTM?: number;
  } | null;
  fmp?: {
    fmpPE?: number;
    price?: number;
    sharesOutstanding?: number;
  } | null;
  earningsGrowth?: {
    historicalGrowthRate?: number;
    analystGrowthRate?: number;
  } | null;
  keyMetrics?: {
    sharesOutstanding?: number;
    roic?: number;
  } | null;
  /** Same source as Companies page — includes Finnhub market-cap fallback */
  valueDriver?: {
    sharesOutstandingNow?: number | null;
    currentPrice?: number | null;
  } | null;
  finnhubMetrics?: {
    sharesOutstanding?: number | null;
  } | null;
  /** Saved company row — same EPS as Companies stock details */
  companyRecord?: {
    eps?: number | null;
    active_price?: number | null;
  } | null;
  dividendHistory?: unknown;
  dividendHistoryError?: unknown;
};

/** FMP sometimes returns shares in millions — normalize to absolute share count */
export function normalizeSharesOutstanding(shares: number | null | undefined): number {
  if (shares == null || shares <= 0) return 0;
  if (shares < 10000) return Math.round(shares * 1_000_000);
  return shares;
}

/** Resolve shares outstanding using the same priority as Companies / value-driver-classification */
export function resolveSharesOutstanding(data: ResearchSnapshotForDcfInput): number {
  const candidates = [
    data.valueDriver?.sharesOutstandingNow,
    data.finnhubMetrics?.sharesOutstanding,
    data.fmp?.sharesOutstanding,
    data.keyMetrics?.sharesOutstanding,
  ];

  for (const raw of candidates) {
    const normalized = normalizeSharesOutstanding(raw);
    if (normalized > 0) return normalized;
  }
  return 0;
}

/** EPS priority matches Companies stock details → Finnhub TTM → calculated → FMP annual last */
export function resolveCurrentEps(
  data: ResearchSnapshotForDcfInput,
  sharesOutstanding: number
): number {
  const companyEps = data.companyRecord?.eps;
  if (companyEps != null && companyEps > 0) {
    return companyEps;
  }
  if (data.peRatios?.epsTTM != null && data.peRatios.epsTTM > 0) {
    return data.peRatios.epsTTM;
  }
  const netIncome = data.financials?.netIncome ?? 0;
  if (netIncome && sharesOutstanding > 0) {
    return netIncome / sharesOutstanding;
  }
  if (data.financials?.eps != null && data.financials.eps > 0) {
    return data.financials.eps;
  }
  return 0;
}

/** Build a DCF payload from research/API snapshot fields */
export function buildDcfPayloadFromSnapshot(data: ResearchSnapshotForDcfInput): DCFData | null {
  const sym = data.symbol?.trim();
  if (!sym) return null;

  const revenueGrowthBear = 0.03;
  const revenueGrowthBase = 0.04;
  const revenueGrowthBull = 0.12;

  const baseNetIncomeGrowth = data.earningsGrowth?.historicalGrowthRate ?? 0.2;
  const netIncomeGrowthBear = new Decimal(baseNetIncomeGrowth).mul(0.75).toNumber();
  const netIncomeGrowthBase = baseNetIncomeGrowth;
  const netIncomeGrowthBull = new Decimal(baseNetIncomeGrowth).mul(1.25).toNumber();

  const currentPE = data.peRatios?.currentPE ?? data.fmp?.fmpPE ?? 16;

  const peLowBase = currentPE;
  const peLowBear = new Decimal(currentPE).mul(0.9).toNumber();
  const peLowBull = new Decimal(currentPE).mul(1.1).toNumber();

  const peHighBase = currentPE;
  const peHighBear = new Decimal(currentPE).mul(0.8).toNumber();
  const peHighBull = new Decimal(currentPE).mul(1.2).toNumber();

  const sharesOutstanding = resolveSharesOutstanding(data);

  const netIncome = data.financials?.netIncome ?? 0;
  const stockPrice =
    data.peRatios?.currentPrice ??
    data.companyRecord?.active_price ??
    data.fmp?.price ??
    data.valueDriver?.currentPrice ??
    0;
  const currentEps = resolveCurrentEps(data, sharesOutstanding);

  return {
    revenueGrowth: {
      bear: revenueGrowthBear,
      base: revenueGrowthBase,
      bull: revenueGrowthBull,
    },
    netIncomeGrowth: {
      bear: netIncomeGrowthBear,
      base: netIncomeGrowthBase,
      bull: netIncomeGrowthBull,
    },
    peLow: {
      bear: peLowBear,
      base: peLowBase,
      bull: peLowBull,
    },
    peHigh: {
      bear: peHighBear,
      base: peHighBase,
      bull: peHighBull,
    },
    revenue: data.financials?.revenue ?? 0,
    netIncome,
    sharesOutstanding,
    stockPrice,
    currentEps,
    symbol: sym.toUpperCase(),
    timestamp: new Date().toISOString(),
  };
}

/** Overlay live base inputs onto saved DCF assumptions (growth rates, PE ranges) */
export function mergeDcfBaseFields(saved: DCFData, fresh: DCFData): DCFData {
  return {
    ...saved,
    revenue: fresh.revenue,
    netIncome: fresh.netIncome,
    sharesOutstanding: fresh.sharesOutstanding,
    stockPrice: fresh.stockPrice,
    currentEps: fresh.currentEps,
    timestamp: fresh.timestamp,
  };
}

/** Fields required before projections are meaningful */
export function getMissingDcfRequiredFields(data: DCFData | null | undefined): string[] {
  if (!data) return ['Stock data'];
  const missing: string[] = [];
  if (!data.sharesOutstanding || data.sharesOutstanding <= 0) {
    missing.push('Shares outstanding');
  }
  if (!data.revenue || data.revenue <= 0) {
    missing.push('Revenue');
  }
  if (!data.stockPrice || data.stockPrice <= 0) {
    missing.push('Stock price');
  }
  if (
    (!data.currentEps || data.currentEps === 0) &&
    (data.netIncome == null || data.netIncome === 0)
  ) {
    missing.push('EPS or net income');
  }
  return missing;
}

/**
 * Writes `dcfData` to localStorage for /dcf and related pages.
 * Same assumptions as Company Research `storeDataForDCF`.
 */
export function storeResearchSnapshotForDcf(data: ResearchSnapshotForDcfInput | null | undefined): void {
  if (!data) return;
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('storeResearchSnapshotForDcf: localStorage not available');
    return;
  }

  try {
    const dcfPayload = buildDcfPayloadFromSnapshot(data);
    if (!dcfPayload) return;

    localStorage.setItem('dcfData', JSON.stringify(dcfPayload));
    console.log('[dcfData] Stored snapshot for', dcfPayload.symbol);
  } catch (error) {
    console.error('storeResearchSnapshotForDcf:', error);
  }
}

async function fetchResearchSnapshotForSymbol(
  symbol: string
): Promise<ResearchSnapshotForDcfInput | null> {
  const sym = symbol?.trim().toUpperCase();
  if (!sym) return null;

  const [financialsRes, peRatiosRes, earningsGrowthRes, fmpRes, keyMetricsRes, valueDriverRes, finnhubRes, stockValRes] =
    await Promise.allSettled([
      fetch(`/api/financials?symbol=${sym}`),
      fetch(`/api/pe-ratios?symbol=${sym}`),
      fetch(`/api/earnings-growth?symbol=${sym}`),
      fetch(`/api/fmp?symbol=${sym}`),
      fetch(`/api/key-metrics?symbol=${sym}`),
      fetch(`/api/value-driver-classification?symbol=${sym}`),
      fetch(`/api/finnhub-metrics?symbol=${sym}`),
      fetch(`/api/stock-valuations?stock=${encodeURIComponent(sym)}`),
    ]);

  const snapshot: ResearchSnapshotForDcfInput = { symbol: sym };

  if (financialsRes.status === 'fulfilled' && financialsRes.value.ok) {
    snapshot.financials = await financialsRes.value.json();
  }
  if (peRatiosRes.status === 'fulfilled' && peRatiosRes.value.ok) {
    snapshot.peRatios = await peRatiosRes.value.json();
  }
  if (earningsGrowthRes.status === 'fulfilled' && earningsGrowthRes.value.ok) {
    snapshot.earningsGrowth = await earningsGrowthRes.value.json();
  }
  if (fmpRes.status === 'fulfilled' && fmpRes.value.ok) {
    snapshot.fmp = await fmpRes.value.json();
  }
  if (keyMetricsRes.status === 'fulfilled' && keyMetricsRes.value.ok) {
    snapshot.keyMetrics = await keyMetricsRes.value.json();
  }
  if (valueDriverRes.status === 'fulfilled' && valueDriverRes.value.ok) {
    const vd = await valueDriverRes.value.json();
    snapshot.valueDriver = {
      sharesOutstandingNow: vd.sharesOutstandingNow ?? null,
      currentPrice: vd.currentPrice ?? null,
    };
  }
  if (finnhubRes.status === 'fulfilled' && finnhubRes.value.ok) {
    const fh = await finnhubRes.value.json();
    snapshot.finnhubMetrics = {
      sharesOutstanding: fh.sharesOutstanding ?? null,
    };
  }
  if (stockValRes.status === 'fulfilled' && stockValRes.value.ok) {
    const sv = await stockValRes.value.json();
    snapshot.companyRecord = {
      eps: sv.data?.eps ?? null,
      active_price: sv.data?.active_price ?? null,
    };
  }

  return snapshot;
}

/** Fetches market data and returns a DCF draft payload (no localStorage required) */
export async function fetchDcfSnapshotForSymbol(symbol: string): Promise<DCFData | null> {
  try {
    const snapshot = await fetchResearchSnapshotForSymbol(symbol);
    if (!snapshot) return null;
    return buildDcfPayloadFromSnapshot(snapshot);
  } catch (e) {
    console.error('fetchDcfSnapshotForSymbol:', e);
    return null;
  }
}

/** Fetches the same core endpoints as Watchlist “refresh” / Research and stores `dcfData`. */
export async function fetchAndStoreDcfSnapshotForSymbol(symbol: string): Promise<boolean> {
  try {
    const payload = await fetchDcfSnapshotForSymbol(symbol);
    if (!payload) return false;
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('dcfData', JSON.stringify(payload));
      console.log('[dcfData] Stored snapshot for', payload.symbol);
    }
    return true;
  } catch (e) {
    console.error('fetchAndStoreDcfSnapshotForSymbol:', e);
    return false;
  }
}
