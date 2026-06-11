import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY?.trim();

async function fmpFirstNonEmptyArray(urls: string[]): Promise<Record<string, unknown>[]> {
  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 20000,
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200) continue;
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        return data as Record<string, unknown>[];
      }
    } catch {
      /* try next URL */
    }
  }
  return [];
}

function safeNum(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const x = typeof n === 'string' ? parseFloat(n) : Number(n);
  return Number.isFinite(x) ? x : null;
}

/** Free FMP tier: limit ≤ 5; quarterly ratios need premium — annual works. */
export async function fetchFmpRatiosHistory(
  symbol: string,
  limit = 5
): Promise<{ rows: Record<string, unknown>[]; period: 'quarter' | 'annual' }> {
  if (!FMP_API_KEY) return { rows: [], period: 'annual' };
  const sym = symbol.toUpperCase();
  const k = FMP_API_KEY;
  const capped = Math.min(Math.max(limit, 1), 5);

  const quarterlyUrls = [
    `https://financialmodelingprep.com/stable/ratios?symbol=${sym}&period=quarter&limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/ratios/${sym}?period=quarter&limit=${capped}&apikey=${k}`,
  ];
  const annualUrls = [
    `https://financialmodelingprep.com/stable/ratios?symbol=${sym}&limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/ratios/${sym}?limit=${capped}&apikey=${k}`,
  ];

  const quarterly = await fmpFirstNonEmptyArray(quarterlyUrls);
  if (quarterly.length > 0) return { rows: quarterly, period: 'quarter' };

  const annual = await fmpFirstNonEmptyArray(annualUrls);
  return { rows: annual, period: 'annual' };
}

export async function fetchFmpCashFlowHistory(symbol: string, limit = 5): Promise<Record<string, unknown>[]> {
  if (!FMP_API_KEY) return [];
  const sym = symbol.toUpperCase();
  const k = FMP_API_KEY;
  const capped = Math.min(Math.max(limit, 1), 5);
  const urls = [
    `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${sym}&limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/cash-flow-statement/${sym}?limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${sym}&period=quarter&limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/cash-flow-statement/${sym}?period=quarter&limit=${capped}&apikey=${k}`,
  ];
  const rows = await fmpFirstNonEmptyArray(urls);
  // Prefer annual rows for FCF range; quarterly would mix TTM inconsistently
  const annual = rows.filter((r) => {
    const period = String(r.period ?? '');
    return !/^Q[1-4]/i.test(period);
  });
  return annual.length > 0 ? annual : rows;
}

export function extractPeValues(ratioRows: Record<string, unknown>[]): number[] {
  const values: number[] = [];
  for (const row of ratioRows) {
    const pe = safeNum(
      row.priceToEarningsRatio ?? row.peRatio ?? row.priceEarningsRatio
    );
    if (pe != null && pe > 0 && pe < 2000) values.push(pe);
  }
  return values;
}

export function extractFcfValues(cashFlowRows: Record<string, unknown>[]): number[] {
  const values: number[] = [];
  for (const row of cashFlowRows) {
    let fcf = safeNum(row.freeCashFlow);
    if (fcf == null) {
      const ocf = safeNum(row.netCashProvidedByOperatingActivities);
      const capex = safeNum(row.capitalExpenditure);
      if (ocf != null) {
        fcf = ocf - Math.abs(capex ?? 0);
      }
    }
    if (fcf != null && fcf !== 0) values.push(fcf);
  }
  return values;
}

export async function fetchFmpIncomeStatementHistory(
  symbol: string,
  limit = 5
): Promise<Record<string, unknown>[]> {
  if (!FMP_API_KEY) return [];
  const sym = symbol.toUpperCase();
  const k = FMP_API_KEY;
  const capped = Math.min(Math.max(limit, 1), 5);
  const urls = [
    `https://financialmodelingprep.com/stable/income-statement?symbol=${sym}&limit=${capped}&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/income-statement/${sym}?limit=${capped}&apikey=${k}`,
  ];
  const rows = await fmpFirstNonEmptyArray(urls);
  const annual = rows.filter((r) => {
    const period = String(r.period ?? '');
    return !/^Q[1-4]/i.test(period);
  });
  return annual.length > 0 ? annual : rows;
}

export function extractSharesValues(incomeRows: Record<string, unknown>[]): number[] {
  const values: number[] = [];
  for (const row of incomeRows) {
    const sh = safeNum(
      row.weightedAverageShsOutDil ??
        row.weightedAverageShsOut ??
        row.commonStockSharesOutstanding
    );
    if (sh != null && sh > 0) values.push(sh);
  }
  return values;
}

/** Latest fiscal year shares outstanding from income statement rows. */
export function extractLatestShares(incomeRows: Record<string, unknown>[]): number | null {
  if (incomeRows.length === 0) return null;
  const sorted = [...incomeRows].sort((a, b) =>
    String(b.date ?? '').localeCompare(String(a.date ?? ''))
  );
  const values = extractSharesValues([sorted[0]!]);
  return values[0] ?? null;
}

export function minMax(values: number[]): { low: number | null; high: number | null } {
  if (values.length === 0) return { low: null, high: null };
  return {
    low: Math.min(...values),
    high: Math.max(...values),
  };
}
