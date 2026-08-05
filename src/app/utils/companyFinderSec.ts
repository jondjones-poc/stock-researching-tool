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
  const raw: SecTickerEntry[] = [];
  for (const key of Object.keys(data)) {
    const entry = data[key];
    const ticker = String(entry?.ticker || '')
      .trim()
      .toUpperCase();
    if (!ticker || !/^[A-Z]{1,5}(\.[A-Z])?$/.test(ticker)) continue;
    const cik = String(entry?.cik_str ?? '').padStart(10, '0');
    if (!cik || cik === '0000000000') continue;
    raw.push({
      ticker,
      cik,
      name: String(entry?.title || ticker),
    });
  }
  // Drop warrants / units / rights when the common share for the same CIK is present
  // (e.g. ABLVW when ABLV exists). Keeps standalone names like GWW / TWOU.
  const byCik = new Map<string, SecTickerEntry[]>();
  for (const entry of raw) {
    const list = byCik.get(entry.cik) ?? [];
    list.push(entry);
    byCik.set(entry.cik, list);
  }
  const out: SecTickerEntry[] = [];
  for (const group of byCik.values()) {
    const tickers = new Set(group.map((g) => g.ticker));
    for (const entry of group) {
      if (isDerivativeShareTicker(entry.ticker, tickers)) continue;
      out.push(entry);
    }
  }
  out.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return out;
}

/** Warrant / unit / right suffixes when the parent common ticker is also in the set. */
const DERIVATIVE_SUFFIXES = ['WS', 'WT', 'WW', 'W', 'U', 'R', 'Z'] as const;

export function isDerivativeShareTicker(ticker: string, siblingTickers: Set<string>): boolean {
  const t = ticker.toUpperCase();
  for (const suffix of DERIVATIVE_SUFFIXES) {
    if (!t.endsWith(suffix) || t.length <= suffix.length) continue;
    const base = t.slice(0, -suffix.length);
    if (siblingTickers.has(base)) return true;
  }
  return false;
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
  /** Single SEC Total Debt fact only — never summed from multiple debt tags. */
  totalDebt: number | null;
  totalDebtAsOf: string | null;
  totalDebtSource: string | null;
  /** cash − totalDebt when both present; null if Total Debt is missing. */
  netCash: number | null;
  ocfYtd: number | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  fcfYtd: number | null;
  fcfAsOf: string | null;
  fcfPeriod: string | null;
  fcfSource: string | null;
  sharesOutstanding: number | null;
}

export interface CompanyFinderSecMeta {
  exchange: string | null;
  sector: string | null;
  country: string | null;
}

const US_STATE_OR_TERRITORY = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA',
  'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT',
  'VA', 'WA', 'WV', 'WI', 'WY', 'DC', 'PR', 'VI', 'GU', 'AS', 'MP', 'X1',
]);

function countryFromSecAddress(addr: {
  country?: string | null;
  countryCode?: string | null;
  stateOrCountry?: string | null;
  stateOrCountryDescription?: string | null;
  isForeignLocation?: number | boolean | null;
} | null | undefined): string | null {
  if (!addr) return null;
  const code = String(addr.countryCode || '').trim().toUpperCase();
  if (code && /^[A-Z]{2}$/.test(code)) return code;
  const countryName = String(addr.country || '').trim();
  if (countryName) {
    if (/^united states/i.test(countryName) || /^u\.?s\.?a?\.?$/i.test(countryName)) return 'US';
    return countryName.length <= 3 ? countryName.toUpperCase() : countryName;
  }
  const stateOrCountry = String(addr.stateOrCountry || '').trim().toUpperCase();
  if (!stateOrCountry) return null;
  if (US_STATE_OR_TERRITORY.has(stateOrCountry) || stateOrCountry === 'USA') return 'US';
  if (/^[A-Z]{2}$/.test(stateOrCountry)) return stateOrCountry;
  return String(addr.stateOrCountryDescription || stateOrCountry).trim() || null;
}

/** Exchange, SIC industry, and country from SEC submissions metadata. */
export async function fetchSecCompanyMeta(cik: string): Promise<CompanyFinderSecMeta> {
  const padded = cik.padStart(10, '0');
  const data = await secGet<{
    sicDescription?: string;
    exchanges?: string[];
    addresses?: {
      business?: {
        country?: string | null;
        countryCode?: string | null;
        stateOrCountry?: string | null;
        stateOrCountryDescription?: string | null;
        isForeignLocation?: number | boolean | null;
      };
      mailing?: {
        country?: string | null;
        countryCode?: string | null;
        stateOrCountry?: string | null;
        stateOrCountryDescription?: string | null;
        isForeignLocation?: number | boolean | null;
      };
    };
  }>(`https://data.sec.gov/submissions/CIK${padded}.json`);

  const exchange = Array.isArray(data.exchanges) && data.exchanges[0]
    ? String(data.exchanges[0])
    : null;
  const sector = data.sicDescription ? String(data.sicDescription).trim() : null;
  const country =
    countryFromSecAddress(data.addresses?.business) ||
    countryFromSecAddress(data.addresses?.mailing);

  return { exchange, sector, country };
}

/**
 * Prefer a single SEC fact labeled "Total Debt", else DebtInstrumentCarryingAmount
 * (carrying amount of debt instruments — one XBRL concept, not a sum of current + LT).
 * Returns null when no such single fact exists.
 */
function pickTotalDebtFact(
  gaap: Record<string, unknown> | undefined,
  ifrs: Record<string, unknown> | undefined,
  cashEnd: string | null
): { point: SecFactPoint; source: string } | null {
  const tryConcept = (
    facts: Record<string, unknown> | undefined,
    concept: string,
    source: string
  ): { point: SecFactPoint; source: string } | null => {
    const points = collectUnits(facts, concept);
    if (!points.length) return null;
    if (cashEnd) {
      const matched = points
        .filter((p) => p.end === cashEnd)
        .sort((a, b) => String(b.filed || '').localeCompare(String(a.filed || '')));
      if (matched[0]) return { point: matched[0], source };
    }
    const latest = latestBalanceSheetCash(points);
    return latest ? { point: latest, source } : null;
  };

  // Prefer concepts whose SEC label is exactly "Total Debt" (rare but authoritative).
  for (const facts of [gaap, ifrs]) {
    if (!facts) continue;
    for (const [concept, raw] of Object.entries(facts)) {
      const label =
        raw && typeof raw === 'object' && 'label' in raw
          ? String((raw as { label?: unknown }).label || '')
          : '';
      if (!/^total debt\b/i.test(label.trim())) continue;
      const hit = tryConcept(facts, concept, `sec-label:${concept}`);
      if (hit) return hit;
    }
  }

  // Standard single-concept Total Debt proxy in us-gaap companyfacts.
  return (
    tryConcept(gaap, 'DebtInstrumentCarryingAmount', 'sec:DebtInstrumentCarryingAmount') ||
    tryConcept(ifrs, 'DebtInstrumentCarryingAmount', 'sec:DebtInstrumentCarryingAmount')
  );
}

function pickMatchingPeriod(
  points: SecFactPoint[],
  target: { end?: string | null; frame?: string | null; period?: string | null }
): SecFactPoint | null {
  if (!points.length) return null;
  if (target.frame) {
    const byFrame = points.find((p) => p.frame === target.frame);
    if (byFrame) return byFrame;
  }
  if (target.period) {
    const byPeriod = points.find((p) => p.frame === target.period || p.fp === target.period);
    if (byPeriod) return byPeriod;
  }
  if (target.end) {
    const byEnd = points
      .filter((p) => p.end === target.end)
      .sort((a, b) => String(b.frame || '').localeCompare(String(a.frame || '')));
    if (byEnd[0]) return byEnd[0];
  }
  return pickOcfYtd(points)?.point ?? latestByEnd(points);
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
    'CashCashEquivalentsAndShortTermInvestments',
    'CashAndCashEquivalentsAtCarryingValue',
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

  // Prefer reported free cash flow; else OCF - CapEx for the same period.
  const fcfConcepts = ['FreeCashFlow', 'FreeCashFlowFromOperations'];
  let fcfYtd: number | null = null;
  let fcfAsOf: string | null = null;
  let fcfPeriod: string | null = null;
  let fcfSource: string | null = null;

  for (const concept of fcfConcepts) {
    const direct =
      pickMatchingPeriod(collectUnits(gaap, concept), {
        end: ocfPick?.point.end,
        frame: ocfPick?.point.frame,
        period: ocfPick?.period,
      }) || pickOcfYtd(collectUnits(gaap, concept))?.point;
    if (direct) {
      fcfYtd = direct.val;
      fcfAsOf = direct.end;
      fcfPeriod = direct.frame || ocfPick?.period || direct.fp || 'latest';
      fcfSource = `sec:${concept}`;
      break;
    }
    const directIfrs =
      pickMatchingPeriod(collectUnits(ifrs, concept), {
        end: ocfPick?.point.end,
        frame: ocfPick?.point.frame,
        period: ocfPick?.period,
      }) || pickOcfYtd(collectUnits(ifrs, concept))?.point;
    if (directIfrs) {
      fcfYtd = directIfrs.val;
      fcfAsOf = directIfrs.end;
      fcfPeriod = directIfrs.frame || ocfPick?.period || directIfrs.fp || 'latest';
      fcfSource = `sec:${concept}`;
      break;
    }
  }

  if (fcfYtd == null && ocfPick) {
    const capexConcepts = [
      'PaymentsToAcquirePropertyPlantAndEquipment',
      'PurchaseOfPropertyPlantAndEquipment',
      'PaymentsForPropertyPlantAndEquipment',
      'PaymentsToAcquireProductiveAssets',
    ];
    let capexPoint: SecFactPoint | null = null;
    for (const concept of capexConcepts) {
      capexPoint = pickMatchingPeriod(collectUnits(gaap, concept), {
        end: ocfPick.point.end,
        frame: ocfPick.point.frame,
        period: ocfPick.period,
      });
      if (capexPoint) {
        fcfSource = `ocf-capex:${concept}`;
        break;
      }
      capexPoint = pickMatchingPeriod(collectUnits(ifrs, concept), {
        end: ocfPick.point.end,
        frame: ocfPick.point.frame,
        period: ocfPick.period,
      });
      if (capexPoint) {
        fcfSource = `ocf-capex:${concept}`;
        break;
      }
    }
    if (capexPoint) {
      // CapEx is usually reported as positive outflow in SEC cash flow tags.
      const capexAbs = Math.abs(capexPoint.val);
      fcfYtd = ocfPick.point.val - capexAbs;
      fcfAsOf = ocfPick.point.end;
      fcfPeriod = ocfPick.period;
    }
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

  const cash = cashPoint?.val ?? null;
  const cashAsOf = cashPoint?.end ?? null;
  const debtPick = pickTotalDebtFact(gaap, ifrs, cashAsOf);
  const totalDebt = debtPick?.point.val ?? null;
  const totalDebtAsOf = debtPick?.point.end ?? null;
  const totalDebtSource = debtPick?.source ?? null;
  const netCash =
    cash != null && totalDebt != null && Number.isFinite(cash) && Number.isFinite(totalDebt)
      ? cash - totalDebt
      : null;

  return {
    cash,
    cashAsOf,
    totalDebt,
    totalDebtAsOf,
    totalDebtSource,
    netCash,
    ocfYtd: ocfPick?.point.val ?? null,
    ocfAsOf: ocfPick?.point.end ?? null,
    ocfPeriod: ocfPick?.period ?? null,
    fcfYtd,
    fcfAsOf,
    fcfPeriod,
    fcfSource,
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
