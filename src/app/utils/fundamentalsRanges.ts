import {
  fetchFinnhubCurrentPe,
  fetchFinnhubFcfHistory,
  fetchFinnhubPeHistory,
} from './finnhubFundamentalsFetch';
import {
  extractFcfValues,
  extractLatestShares,
  extractPeValues,
  extractSharesValues,
  fetchFmpCashFlowHistory,
  fetchFmpIncomeStatementHistory,
  fetchFmpRatiosHistory,
  minMax,
} from './fmpFundamentalsFetch';

export interface FundamentalsRanges {
  peRangeLow: number | null;
  peRangeHigh: number | null;
  fcfRangeLow: number | null;
  fcfRangeHigh: number | null;
  sharesOutstanding: number | null;
  sharesRangeLow: number | null;
  sharesRangeHigh: number | null;
  currentPe: number | null;
  latestFcf: number | null;
  pePeriod: 'quarter' | 'annual' | null;
  peSource: 'fmp' | 'finnhub' | null;
  fcfSource: 'fmp' | 'finnhub' | null;
  pePoints: number;
  fcfYears: number;
  sharesYears: number;
  fetchedAt: string;
  warning: string | null;
}

export async function fetchFundamentalsRanges(symbol: string): Promise<FundamentalsRanges> {
  const [ratioResult, cashFlowRows, incomeRows] = await Promise.all([
    fetchFmpRatiosHistory(symbol, 5),
    fetchFmpCashFlowHistory(symbol, 5),
    fetchFmpIncomeStatementHistory(symbol, 5),
  ]);

  let peValues = extractPeValues(ratioResult.rows);
  let peSource: 'fmp' | 'finnhub' | null = peValues.length > 0 ? 'fmp' : null;
  let pePeriod: 'quarter' | 'annual' | null =
    peValues.length > 0 ? ratioResult.period : null;

  if (peValues.length === 0) {
    peValues = await fetchFinnhubPeHistory(symbol, 5);
    if (peValues.length > 0) {
      peSource = 'finnhub';
      pePeriod = 'annual';
    }
  }

  let fcfValues = extractFcfValues(cashFlowRows);
  let fcfSource: 'fmp' | 'finnhub' | null = fcfValues.length > 0 ? 'fmp' : null;

  if (fcfValues.length === 0) {
    fcfValues = await fetchFinnhubFcfHistory(symbol, 5);
    if (fcfValues.length > 0) fcfSource = 'finnhub';
  }

  const sharesValues = extractSharesValues(incomeRows);
  const pe = minMax(peValues);
  const fcf = minMax(fcfValues);
  const shares = minMax(sharesValues);
  const latestShares = extractLatestShares(incomeRows);
  const currentPe = await fetchFinnhubCurrentPe(symbol);
  const latestFcf = fcfValues.length > 0 ? fcfValues[0]! : null;

  const warnings: string[] = [];
  if (peValues.length === 0) warnings.push('No PE history from FMP or Finnhub');
  if (fcfValues.length === 0) warnings.push('No FCF history from FMP or Finnhub');
  if (sharesValues.length === 0 && process.env.FMP_API_KEY?.trim()) {
    warnings.push('No annual shares outstanding history from FMP');
  }

  const roundShares = (n: number | null) => (n != null ? Math.round(n) : null);

  return {
    peRangeLow: pe.low != null ? Math.round(pe.low * 100) / 100 : null,
    peRangeHigh: pe.high != null ? Math.round(pe.high * 100) / 100 : null,
    fcfRangeLow: fcf.low != null ? Math.round(fcf.low * 100) / 100 : null,
    fcfRangeHigh: fcf.high != null ? Math.round(fcf.high * 100) / 100 : null,
    sharesOutstanding: roundShares(latestShares),
    sharesRangeLow: roundShares(shares.low),
    sharesRangeHigh: roundShares(shares.high),
    currentPe: currentPe != null ? Math.round(currentPe * 100) / 100 : null,
    latestFcf: latestFcf != null ? Math.round(latestFcf * 100) / 100 : null,
    pePeriod,
    peSource,
    fcfSource,
    pePoints: peValues.length,
    fcfYears: fcfValues.length,
    sharesYears: sharesValues.length,
    fetchedAt: new Date().toISOString(),
    warning: warnings.length > 0 ? warnings.join('; ') : null,
  };
}
