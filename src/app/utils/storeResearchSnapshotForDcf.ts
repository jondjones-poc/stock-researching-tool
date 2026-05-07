import Decimal from 'decimal.js';

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
  dividendHistory?: unknown;
  dividendHistoryError?: unknown;
};

/**
 * Writes `dcfData` to localStorage for /dcf and related pages.
 * Same assumptions as Company Research `storeDataForDCF`.
 */
export function storeResearchSnapshotForDcf(data: ResearchSnapshotForDcfInput | null | undefined): void {
  if (!data) return;
  const sym = data.symbol?.trim();
  if (!sym) return;
  if (typeof window === 'undefined' || !window.localStorage) {
    console.warn('storeResearchSnapshotForDcf: localStorage not available');
    return;
  }

  try {
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

    const dcfPayload = {
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
      netIncome: data.financials?.netIncome ?? 0,
      sharesOutstanding: data.keyMetrics?.sharesOutstanding ?? data.fmp?.sharesOutstanding ?? 0,
      stockPrice: data.peRatios?.currentPrice ?? data.fmp?.price ?? 0,
      currentEps:
        data.financials?.eps ??
        (data.financials?.netIncome && data.fmp?.sharesOutstanding
          ? data.financials.netIncome / data.fmp.sharesOutstanding
          : 0),
      symbol: sym.toUpperCase(),
      timestamp: new Date().toISOString(),
      dividendHistory: data.dividendHistory ?? null,
      dividendHistoryError: data.dividendHistoryError ?? null,
    };

    localStorage.setItem('dcfData', JSON.stringify(dcfPayload));
    console.log('[dcfData] Stored snapshot for', dcfPayload.symbol);
  } catch (error) {
    console.error('storeResearchSnapshotForDcf:', error);
  }
}

/** Fetches the same core endpoints as Watchlist “refresh” / Research and stores `dcfData`. */
export async function fetchAndStoreDcfSnapshotForSymbol(symbol: string): Promise<boolean> {
  const sym = symbol?.trim().toUpperCase();
  if (!sym) return false;

  try {
    const [financialsRes, peRatiosRes, earningsGrowthRes, fmpRes, keyMetricsRes] = await Promise.allSettled([
      fetch(`/api/financials?symbol=${sym}`),
      fetch(`/api/pe-ratios?symbol=${sym}`),
      fetch(`/api/earnings-growth?symbol=${sym}`),
      fetch(`/api/fmp?symbol=${sym}`),
      fetch(`/api/key-metrics?symbol=${sym}`),
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

    storeResearchSnapshotForDcf(snapshot);
    return true;
  } catch (e) {
    console.error('fetchAndStoreDcfSnapshotForSymbol:', e);
    return false;
  }
}
