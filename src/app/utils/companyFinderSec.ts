import axios from 'axios';

const SEC_UA =
  process.env.SEC_USER_AGENT?.trim() ||
  'ShareResearchApp company-finder (research@example.com)';

export interface SecTickerEntry {
  ticker: string;
  cik: string;
  name: string;
}

export interface SecFactPoint {
  end: string;
  val: number;
  form?: string;
  fy?: number;
  fp?: string;
  frame?: string;
  filed?: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function secGet<T>(url: string): Promise<T> {
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': SEC_UA,
      Accept: 'application/json',
    },
    validateStatus: () => true,
  });
  if (response.status === 429) {
    await sleep(1500);
    const retry = await axios.get(url, {
      timeout: 20000,
      headers: {
        'User-Agent': SEC_UA,
        Accept: 'application/json',
      },
      validateStatus: () => true,
    });
    if (retry.status < 200 || retry.status >= 300) {
      throw new Error(`SEC request failed (${retry.status}) for ${url}`);
    }
    return retry.data as T;
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`SEC request failed (${response.status}) for ${url}`);
  }
  return response.data as T;
}

/** US SEC ticker map (mostly US-listed / SEC-reporting issuers). */
export async function fetchSecTickerUniverse(): Promise<SecTickerEntry[]> {
  const data = await secGet<Record<string, { ticker?: string; cik_str?: string | number; title?: string }>>(
    'https://www.sec.gov/files/company_tickers.json'
  );
  const out: SecTickerEntry[] = [];
  for (const key of Object.keys(data)) {
    const entry = data[key];
    const ticker = String(entry?.ticker || '')
      .trim()
      .toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)) continue;
    const cik = String(entry?.cik_str ?? '').padStart(10, '0');
    if (!cik || cik === '0000000000') continue;
    out.push({
      ticker,
      cik,
      name: String(entry?.title || ticker),
    });
  }
  out.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return out;
}

function collectUnits(
  facts: Record<string, unknown> | undefined,
  concept: string
): SecFactPoint[] {
  if (!facts) return [];
  const node = facts[concept] as
    | { units?: Record<string, SecFactPoint[] | unknown> }
    | undefined;
  if (!node?.units) return [];
  const preferred = ['USD', 'shares', 'pure'];
  const keys = [
    ...preferred.filter((k) => Array.isArray(node.units?.[k])),
    ...Object.keys(node.units).filter((k) => !preferred.includes(k)),
  ];
  const points: SecFactPoint[] = [];
  for (const key of keys) {
    const arr = node.units?.[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const p = item as SecFactPoint;
      if (p.end && typeof p.val === 'number' && Number.isFinite(p.val)) {
        points.push(p);
      }
    }
    if (points.length) break;
  }
  return points;
}

function latestByEnd(points: SecFactPoint[]): SecFactPoint | null {
  if (!points.length) return null;
  return [...points].sort((a, b) => b.end.localeCompare(a.end))[0] ?? null;
}

function latestBalanceSheetCash(points: SecFactPoint[]): SecFactPoint | null {
  const preferred = points.filter((p) => {
    const form = (p.form || '').toUpperCase();
    return form.includes('10-K') || form.includes('10-Q') || form.includes('20-F') || form.includes('6-K');
  });
  return latestByEnd(preferred.length ? preferred : points);
}

/**
 * Prefer current-year quarterly YTD frame (e.g. CY2026Q3) then annual.
 * Falls back to latest reported operating cash flow.
 */
function pickOcfYtd(points: SecFactPoint[]): { point: SecFactPoint; period: string } | null {
  if (!points.length) return null;
  const year = new Date().getUTCFullYear();
  const frames = points
    .filter((p) => typeof p.frame === 'string' && p.frame.startsWith(`CY${year}`))
    .sort((a, b) => String(b.frame).localeCompare(String(a.frame)));
  if (frames[0]) {
    return { point: frames[0], period: String(frames[0].frame) };
  }
  const priorFrames = points
    .filter((p) => typeof p.frame === 'string' && /^CY\d{4}/.test(p.frame))
    .sort((a, b) => String(b.frame).localeCompare(String(a.frame)));
  if (priorFrames[0]) {
    return { point: priorFrames[0], period: String(priorFrames[0].frame) };
  }
  const annual = points.filter((p) => (p.fp || '').toUpperCase() === 'FY' || (p.form || '').includes('10-K'));
  const latest = latestByEnd(annual.length ? annual : points);
  if (!latest) return null;
  return {
    point: latest,
    period: latest.frame || latest.fp || latest.form || 'latest',
  };
}

export interface CompanyFinderFacts {
  cash: number | null;
  cashAsOf: string | null;
  ocfYtd: number | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  sharesOutstanding: number | null;
}

export async function fetchCompanyFactsForCik(cik: string): Promise<CompanyFinderFacts> {
  const padded = cik.padStart(10, '0');
  const data = await secGet<{
    facts?: {
      'us-gaap'?: Record<string, unknown>;
      'ifrs-full'?: Record<string, unknown>;
      dei?: Record<string, unknown>;
    };
  }>(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`);

  const gaap = data.facts?.['us-gaap'];
  const ifrs = data.facts?.['ifrs-full'];
  const dei = data.facts?.dei;

  const cashConcepts = [
    'CashAndCashEquivalentsAtCarryingValue',
    'CashCashEquivalentsAndShortTermInvestments',
    'CashAndCashEquivalents',
    'Cash',
  ];
  let cashPoint: SecFactPoint | null = null;
  for (const concept of cashConcepts) {
    cashPoint = latestBalanceSheetCash(collectUnits(gaap, concept));
    if (cashPoint) break;
    cashPoint = latestBalanceSheetCash(collectUnits(ifrs, concept));
    if (cashPoint) break;
  }

  const ocfConcepts = [
    'NetCashProvidedByUsedInOperatingActivities',
    'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
  ];
  let ocfPick: { point: SecFactPoint; period: string } | null = null;
  for (const concept of ocfConcepts) {
    ocfPick = pickOcfYtd(collectUnits(gaap, concept));
    if (ocfPick) break;
    ocfPick = pickOcfYtd(collectUnits(ifrs, concept));
    if (ocfPick) break;
  }

  const shareConcepts = [
    'EntityCommonStockSharesOutstanding',
    'CommonStockSharesOutstanding',
    'WeightedAverageNumberOfDilutedSharesOutstanding',
    'WeightedAverageNumberOfSharesOutstandingBasic',
  ];
  let sharesPoint: SecFactPoint | null = null;
  for (const concept of shareConcepts) {
    sharesPoint = latestByEnd(collectUnits(dei, concept));
    if (sharesPoint) break;
    sharesPoint = latestByEnd(collectUnits(gaap, concept));
    if (sharesPoint) break;
    sharesPoint = latestByEnd(collectUnits(ifrs, concept));
    if (sharesPoint) break;
  }

  return {
    cash: cashPoint?.val ?? null,
    cashAsOf: cashPoint?.end ?? null,
    ocfYtd: ocfPick?.point.val ?? null,
    ocfAsOf: ocfPick?.point.end ?? null,
    ocfPeriod: ocfPick?.period ?? null,
    sharesOutstanding: sharesPoint?.val ?? null,
  };
}

export function computeCompanyFinderMetrics(input: {
  price: number | null;
  sharesOutstanding: number | null;
  marketCap: number | null;
  cash: number | null;
  ocfYtd: number | null;
  ocfAsOf: string | null;
}): {
  marketCap: number | null;
  score: number | null;
  ocfPerWeek: number | null;
  estPerSharePerWeek: number | null;
  weeklyOcfYieldPct: number | null;
  dataQuality: 'ok' | 'partial' | 'missing';
} {
  let marketCap = input.marketCap;
  if (
    (marketCap == null || !Number.isFinite(marketCap)) &&
    input.price != null &&
    input.sharesOutstanding != null &&
    input.price > 0 &&
    input.sharesOutstanding > 0
  ) {
    marketCap = input.price * input.sharesOutstanding;
  }

  const hasCore =
    marketCap != null &&
    input.cash != null &&
    input.ocfYtd != null &&
    Number.isFinite(marketCap) &&
    Number.isFinite(input.cash) &&
    Number.isFinite(input.ocfYtd);

  const score = hasCore ? marketCap! - input.cash! - input.ocfYtd! : null;

  let weeks = 52;
  if (input.ocfAsOf) {
    const d = new Date(`${input.ocfAsOf}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      weeks = Math.max(1, Math.min(52, Math.ceil((d.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000))));
    }
  }

  const ocfPerWeek =
    input.ocfYtd != null && Number.isFinite(input.ocfYtd) ? input.ocfYtd / weeks : null;
  const estPerSharePerWeek =
    ocfPerWeek != null &&
    input.sharesOutstanding != null &&
    input.sharesOutstanding > 0
      ? ocfPerWeek / input.sharesOutstanding
      : null;
  const weeklyOcfYieldPct =
    ocfPerWeek != null && marketCap != null && marketCap > 0
      ? (ocfPerWeek / marketCap) * 100
      : null;

  let dataQuality: 'ok' | 'partial' | 'missing' = 'missing';
  if (hasCore) dataQuality = 'ok';
  else if (input.cash != null || input.ocfYtd != null || marketCap != null) dataQuality = 'partial';

  return {
    marketCap: marketCap ?? null,
    score,
    ocfPerWeek,
    estPerSharePerWeek,
    weeklyOcfYieldPct,
    dataQuality,
  };
}
