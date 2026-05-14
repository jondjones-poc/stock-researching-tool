import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;

type QuarterPoint = { label: string; value: number | null };

function safeNum(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const x = typeof n === 'string' ? parseFloat(n) : Number(n);
  return Number.isFinite(x) ? x : null;
}

/** Oldest → newest for charts */
function sortChrono<T extends { date?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime());
}

/**
 * FMP "stable" quarterly URLs often return [] on free tier; v3 path-style URLs usually work.
 * Try each URL until one returns a non-empty array.
 */
async function fmpFirstNonEmptyArray(urls: string[]): Promise<any[]> {
  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        timeout: 20000,
        validateStatus: (s) => s < 500,
      });
      if (res.status !== 200) continue;
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) return data;
    } catch {
      /* next */
    }
  }
  return [];
}

async function fmpFirstKeyMetricsRow(symbol: string, apiKey: string): Promise<Record<string, unknown> | null> {
  const urls = [
    `https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?limit=1&apikey=${apiKey}`,
    `https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=1&apikey=${apiKey}`,
    `https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?period=quarter&limit=1&apikey=${apiKey}`,
  ];
  for (const url of urls) {
    try {
      const res = await axios.get(url, { timeout: 15000, validateStatus: (s) => s < 500 });
      if (res.status !== 200) continue;
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) return data[0] as Record<string, unknown>;
    } catch {
      /* next */
    }
  }
  return null;
}

function looksQuarterly(rows: any[]): boolean {
  return rows.some((r) => {
    const p = String((r as Record<string, unknown>).period ?? '');
    return /^Q[1-4]/i.test(p) || p.toLowerCase().includes('quarter');
  });
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      meta: { error: 'FMP_API_KEY is not configured. Add it to use fundamentals data.' },
    });
  }

  const sym = symbol.toUpperCase();
  const k = FMP_API_KEY;

  const incomeUrls = [
    `https://financialmodelingprep.com/api/v3/income-statement/${sym}?period=quarter&limit=12&apikey=${k}`,
    `https://financialmodelingprep.com/stable/income-statement?symbol=${sym}&period=quarter&limit=12&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/income-statement/${sym}?limit=12&apikey=${k}`,
    `https://financialmodelingprep.com/stable/income-statement?symbol=${sym}&limit=12&apikey=${k}`,
  ];
  const balanceUrls = [
    `https://financialmodelingprep.com/api/v3/balance-sheet-statement/${sym}?period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${sym}&period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/balance-sheet-statement/${sym}?limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${sym}&limit=10&apikey=${k}`,
  ];
  const cashUrls = [
    `https://financialmodelingprep.com/api/v3/cash-flow-statement/${sym}?period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${sym}&period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/cash-flow-statement/${sym}?limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${sym}&limit=10&apikey=${k}`,
  ];
  const ratiosUrls = [
    `https://financialmodelingprep.com/api/v3/ratios/${sym}?period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/ratios?symbol=${sym}&period=quarter&limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/api/v3/ratios/${sym}?limit=10&apikey=${k}`,
    `https://financialmodelingprep.com/stable/ratios?symbol=${sym}&limit=10&apikey=${k}`,
  ];

  const [incomeRaw, balanceRaw, cashRaw, ratiosRaw, kmRow] = await Promise.all([
    fmpFirstNonEmptyArray(incomeUrls),
    fmpFirstNonEmptyArray(balanceUrls),
    fmpFirstNonEmptyArray(cashUrls),
    fmpFirstNonEmptyArray(ratiosUrls),
    fmpFirstKeyMetricsRow(sym, k),
  ]);

  const income = sortChrono(incomeRaw as { date?: string }[]);
  const balanceByDate = new Map<string, (typeof balanceRaw)[0]>();
  for (const b of balanceRaw as { date?: string }[]) {
    if (b.date) balanceByDate.set(b.date, b);
  }
  const cashByDate = new Map<string, (typeof cashRaw)[0]>();
  for (const c of cashRaw as { date?: string }[]) {
    if (c.date) cashByDate.set(c.date, c);
  }
  const ratiosChrono = sortChrono(ratiosRaw as { date?: string }[]);

  const quarterLabel = (row: { date?: string; period?: string; calendarYear?: string }) => {
    if (!row.date) return '?';
    const d = row.date.slice(0, 7);
    return row.period && row.calendarYear ? `${row.period} ${row.calendarYear}` : d;
  };

  const quarterly = looksQuarterly(income);

  // --- Quality: margins from income ---
  const grossMarginSeries: QuarterPoint[] = [];
  const operatingMarginSeries: QuarterPoint[] = [];
  let marginNote: string | undefined;
  if (income.length === 0) {
    marginNote =
      'No income statement data from FMP (check API key, quota, or ticker coverage). Try another symbol or verify FMP_API_KEY.';
  } else {
    for (const row of income) {
      const r = row as Record<string, unknown>;
      const revenue = safeNum(r.revenue);
      const gp = safeNum(r.grossProfit);
      const opInc = safeNum(r.operatingIncome);
      const label = quarterLabel(row as { date?: string; period?: string; calendarYear?: string });
      let gm: number | null = null;
      let om: number | null = null;
      if (revenue && revenue !== 0 && gp != null) gm = (gp / revenue) * 100;
      if (revenue && revenue !== 0 && opInc != null) om = (opInc / revenue) * 100;
      grossMarginSeries.push({ label, value: gm });
      operatingMarginSeries.push({ label, value: om });
    }
    if (!quarterly && income.length > 0) {
      marginNote = 'Showing annual periods (quarterly data unavailable for this symbol/plan). YoY growth uses year-over-year, not quarter-vs-quarter.';
    }
  }

  // ROIC
  let roicPct: number | null = null;
  let roicNote: string | undefined;
  if (kmRow) {
    const raw = safeNum(kmRow.roic);
    if (raw != null) roicPct = raw <= 1.5 ? raw * 100 : raw;
  } else {
    roicNote = 'ROIC could not be loaded from key metrics.';
  }
  if (roicPct == null && ratiosChrono.length > 0) {
    const last = ratiosChrono[ratiosChrono.length - 1] as Record<string, unknown>;
    const r = safeNum(last.returnOnCapitalEmployed ?? last.returnOnEquity);
    if (r != null) roicPct = r <= 1.5 ? r * 100 : r;
    if (roicPct != null) roicNote = undefined;
  }

  const findYoYSeriesQuarterly = (
    rows: typeof income,
    field: 'revenue' | 'eps',
  ): { label: string; yoyPct: number | null }[] => {
    const out: { label: string; yoyPct: number | null }[] = [];
    for (let i = 4; i < rows.length; i++) {
      const cur = safeNum((rows[i] as Record<string, unknown>)[field]);
      const prev = safeNum((rows[i - 4] as Record<string, unknown>)[field]);
      let yoy: number | null = null;
      if (cur != null && prev != null && prev !== 0) yoy = ((cur - prev) / Math.abs(prev)) * 100;
      out.push({
        label: quarterLabel(rows[i] as { date?: string; period?: string; calendarYear?: string }),
        yoyPct: yoy,
      });
    }
    return out.slice(-6);
  };

  const findYoYAnnual = (
    rows: typeof income,
    field: 'revenue' | 'eps',
  ): { label: string; yoyPct: number | null }[] => {
    const out: { label: string; yoyPct: number | null }[] = [];
    for (let i = 1; i < rows.length; i++) {
      const cur = safeNum((rows[i] as Record<string, unknown>)[field]);
      const prev = safeNum((rows[i - 1] as Record<string, unknown>)[field]);
      let yoy: number | null = null;
      if (cur != null && prev != null && prev !== 0) yoy = ((cur - prev) / Math.abs(prev)) * 100;
      out.push({
        label: quarterLabel(rows[i] as { date?: string; period?: string; calendarYear?: string }),
        yoyPct: yoy,
      });
    }
    return out.slice(-6);
  };

  let revenueYoY: { label: string; yoyPct: number | null }[] = [];
  let epsYoY: { label: string; yoyPct: number | null }[] = [];
  if (income.length > 4 && quarterly) {
    revenueYoY = findYoYSeriesQuarterly(income, 'revenue');
    epsYoY = findYoYSeriesQuarterly(income, 'eps');
  } else if (income.length >= 2 && !quarterly) {
    revenueYoY = findYoYAnnual(income, 'revenue');
    epsYoY = findYoYAnnual(income, 'eps');
  }

  const lastEpsYoY = epsYoY.length ? epsYoY[epsYoY.length - 1].yoyPct : null;
  let epsGrowthComment: string | undefined;
  if (lastEpsYoY != null) {
    if (lastEpsYoY < 10) epsGrowthComment = 'Below ~10% YoY: steady but not exciting.';
    else epsGrowthComment = 'Above ~10% YoY: generally attractive EPS growth.';
  }

  const epsConsistency = income.slice(-8).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      label: quarterLabel(row as { date?: string; period?: string; calendarYear?: string }),
      eps: safeNum(r.eps ?? r.epsdiluted),
    };
  });

  const conversionSeries: QuarterPoint[] = [];
  const fcfMarginSeries: QuarterPoint[] = [];
  for (const row of income) {
    const inc = row as Record<string, unknown>;
    const d = inc.date as string | undefined;
    if (!d) continue;
    const ni = safeNum(inc.netIncome);
    const cf = cashByDate.get(d) as Record<string, unknown> | undefined;
    const ocf = cf ? safeNum(cf.netCashProvidedByOperatingActivities ?? cf.operatingCashFlow) : null;
    const fcf = cf ? safeNum(cf.freeCashFlow) : null;
    const rev = safeNum(inc.revenue);
    const label = quarterLabel(row as { date?: string; period?: string; calendarYear?: string });
    let conv: number | null = null;
    if (ni != null && ni !== 0 && ocf != null) conv = ocf / ni;
    let fcfM: number | null = null;
    if (rev && rev !== 0 && fcf != null) fcfM = (fcf / rev) * 100;
    conversionSeries.push({ label, value: conv });
    fcfMarginSeries.push({ label, value: fcfM });
  }

  const debtEquitySeries: QuarterPoint[] = [];
  const interestCoverSeries: QuarterPoint[] = [];
  const last8bal = sortChrono(balanceRaw as { date?: string }[]).slice(-8);
  for (const b of last8bal) {
    const row = b as Record<string, unknown>;
    const td =
      safeNum(row.totalDebt) ??
      (() => {
        const s = safeNum(row.shortTermDebt);
        const l = safeNum(row.longTermDebt);
        if (s != null || l != null) return (s ?? 0) + (l ?? 0);
        return null;
      })();
    const eq = safeNum(row.totalStockholdersEquity ?? row.totalEquity);
    const label = quarterLabel(row as { date?: string; period?: string; calendarYear?: string });
    let de: number | null = null;
    if (td != null && eq != null && eq !== 0) de = td / eq;
    debtEquitySeries.push({ label, value: de });
  }

  for (const row of income.slice(-8)) {
    const inc = row as Record<string, unknown>;
    const ebit = safeNum(inc.ebit ?? inc.operatingIncome);
    const intExp = safeNum(inc.interestExpense);
    const label = quarterLabel(inc as { date?: string; period?: string; calendarYear?: string });
    let ic: number | null = null;
    if (ebit != null && intExp != null && intExp !== 0) ic = ebit / Math.abs(intExp);
    interestCoverSeries.push({ label, value: ic });
  }

  if (interestCoverSeries.every((x) => x.value == null) && ratiosChrono.length > 0) {
    interestCoverSeries.length = 0;
    for (const r of ratiosChrono.slice(-8)) {
      const row = r as Record<string, unknown>;
      const ic = safeNum(row.interestCoverage ?? row.interestCoverageRatio);
      interestCoverSeries.push({
        label: quarterLabel(row as { date?: string; period?: string; calendarYear?: string }),
        value: ic,
      });
    }
  }

  const peSeries: QuarterPoint[] = [];
  for (const r of ratiosChrono.slice(-8)) {
    const row = r as Record<string, unknown>;
    const pe = safeNum(row.priceToEarningsRatio ?? row.peRatio ?? row.priceEarningsRatio);
    peSeries.push({
      label: quarterLabel(row as { date?: string; period?: string; calendarYear?: string }),
      value: pe,
    });
  }

  return NextResponse.json({
    symbol: sym,
    quality: {
      grossMargin: { series: grossMarginSeries, error: marginNote },
      operatingMargin: { series: operatingMarginSeries },
      roic: {
        pct: roicPct,
        error: roicNote,
      },
    },
    growth: {
      revenueYoY: { bars: revenueYoY },
      epsYoY: { bars: epsYoY, comment: epsGrowthComment },
      epsConsistency: { quarters: epsConsistency },
    },
    cashflow: {
      conversion: { series: conversionSeries },
      fcfMargin: { series: fcfMarginSeries },
    },
    stability: {
      debtEquity: { series: debtEquitySeries },
      interestCover: { series: interestCoverSeries },
    },
    valuation: {
      pe: { series: peSeries },
    },
  });
}
