import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY?.trim();

function safeNum(n: unknown): number | null {
  if (n === null || n === undefined) return null;
  const x = typeof n === 'string' ? parseFloat(n) : Number(n);
  return Number.isFinite(x) ? x : null;
}

type ReportLine = { concept?: string; label?: string; value?: number; v?: number };

function lineValue(line: ReportLine): number | null {
  return safeNum(line.value ?? line.v);
}

function findLine(lines: ReportLine[], concepts: string[]): number | null {
  for (const concept of concepts) {
    const hit = lines.find((l) => l.concept === concept);
    const v = hit ? lineValue(hit) : null;
    if (v != null) return v;
  }
  return null;
}

/** Last N annual PE values from Finnhub metrics series (free tier). */
export async function fetchFinnhubPeHistory(symbol: string, limit = 5): Promise<number[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`,
      { timeout: 15000, validateStatus: (s) => s < 500 }
    );
    if (res.status !== 200) return [];
    const peSeries: { period?: string; v?: number }[] =
      res.data?.series?.annual?.pe ?? [];
    const values: number[] = [];
    for (const point of peSeries.slice(0, limit)) {
      const pe = safeNum(point.v);
      if (pe != null && pe > 0 && pe < 2000) values.push(pe);
    }
    return values;
  } catch {
    return [];
  }
}

/** Last N annual FCF values from Finnhub financials-reported (OCF − CapEx). */
export async function fetchFinnhubFcfHistory(symbol: string, limit = 5): Promise<number[]> {
  if (!FINNHUB_API_KEY) return [];
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`,
      { timeout: 20000, validateStatus: (s) => s < 500 }
    );
    if (res.status !== 200 || !Array.isArray(res.data?.data)) return [];

    const values: number[] = [];
    for (const filing of res.data.data.slice(0, limit)) {
      const cf = filing?.report?.cf;
      if (!Array.isArray(cf)) continue;

      const ocf = findLine(cf, [
        'us-gaap_NetCashProvidedByUsedInOperatingActivities',
        'us-gaap_NetCashProvidedByUsedInOperatingActivitiesContinuingOperations',
      ]);
      const capex = findLine(cf, [
        'us-gaap_PaymentsToAcquirePropertyPlantAndEquipment',
        'us-gaap_PaymentsToAcquireProductiveAssets',
        'us-gaap_CapitalExpenditures',
      ]);

      if (ocf == null) continue;
      const fcf = ocf - Math.abs(capex ?? 0);
      if (fcf !== 0) values.push(fcf);
    }
    return values;
  } catch {
    return [];
  }
}

/** Current TTM PE from Finnhub metrics. */
export async function fetchFinnhubCurrentPe(symbol: string): Promise<number | null> {
  if (!FINNHUB_API_KEY) return null;
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`,
      { timeout: 15000, validateStatus: (s) => s < 500 }
    );
    if (res.status !== 200) return null;
    const pe = safeNum(res.data?.metric?.peTTM);
    return pe != null && pe > 0 && pe < 2000 ? pe : null;
  } catch {
    return null;
  }
}
