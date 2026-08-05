/**
 * SEC EDGAR helpers for Confidence Score (free data only).
 * Submissions metadata + primary filing document text.
 */
import axios from 'axios';
import {
  computeConfidenceFromFlags,
  computeConfidenceScore,
  type ConfidenceFlags,
  type ConfidenceFinding,
  type ConfidenceResult,
} from './companyFinderConfidence';

const SEC_UA =
  process.env.SEC_USER_AGENT?.trim() ||
  'ShareResearchApp company-finder (research@example.com)';

const PERIODIC_FORMS = new Set([
  '10-K',
  '10-K/A',
  '10-Q',
  '10-Q/A',
  '20-F',
  '20-F/A',
  '40-F',
  '40-F/A',
  '6-K',
  '6-K/A',
]);

export interface SecFilingRef {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
}

export interface SecConfidenceSnapshot {
  latest: SecFilingRef | null;
  isForeignIssuer: boolean;
  recentTwoYear: SecFilingRef[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function secGetJson<T>(url: string): Promise<T> {
  const response = await axios.get(url, {
    timeout: 25000,
    headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
    validateStatus: () => true,
  });
  if (response.status === 429) {
    await sleep(1500);
    const retry = await axios.get(url, {
      timeout: 25000,
      headers: { 'User-Agent': SEC_UA, Accept: 'application/json' },
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

async function secGetText(url: string, maxChars = 1_500_000): Promise<string> {
  const response = await axios.get(url, {
    timeout: 45000,
    responseType: 'text',
    headers: { 'User-Agent': SEC_UA, Accept: 'text/html,application/xhtml+xml,text/plain,*/*' },
    validateStatus: () => true,
    maxContentLength: 8 * 1024 * 1024,
    maxBodyLength: 8 * 1024 * 1024,
  });
  if (response.status === 429) {
    await sleep(2000);
    return secGetText(url, maxChars);
  }
  if (response.status < 200 || response.status >= 300) {
    return '';
  }
  const raw = typeof response.data === 'string' ? response.data : String(response.data ?? '');
  // Strip tags lightly for HTML filings; keep enough for phrase search.
  const text = raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ');
  return text.slice(0, maxChars).toLowerCase();
}

function filingDocUrl(cik: string, filing: SecFilingRef): string {
  const cikNum = String(Number(cik));
  const acc = filing.accessionNumber.replace(/-/g, '');
  const doc = filing.primaryDocument.replace(/^\//, '');
  return `https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${doc}`;
}

/** Load filing list from SEC submissions JSON (free). */
export async function fetchSecConfidenceSnapshot(cik: string): Promise<SecConfidenceSnapshot> {
  const padded = cik.padStart(10, '0');
  const data = await secGetJson<{
    filings?: {
      recent?: {
        form?: string[];
        filingDate?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
      };
    };
  }>(`https://data.sec.gov/submissions/CIK${padded}.json`);

  const recent = data.filings?.recent;
  const forms = recent?.form ?? [];
  const dates = recent?.filingDate ?? [];
  const accessions = recent?.accessionNumber ?? [];
  const docs = recent?.primaryDocument ?? [];
  const n = Math.min(forms.length, dates.length, accessions.length, docs.length);

  const all: SecFilingRef[] = [];
  let isForeignIssuer = false;
  for (let i = 0; i < n; i += 1) {
    const form = String(forms[i] || '').toUpperCase();
    if (form.includes('20-F') || form.includes('40-F')) isForeignIssuer = true;
    const filingDate = String(dates[i] || '').slice(0, 10);
    const accessionNumber = String(accessions[i] || '');
    const primaryDocument = String(docs[i] || '');
    if (!filingDate || !accessionNumber || !primaryDocument) continue;
    all.push({ form, filingDate, accessionNumber, primaryDocument });
  }

  const periodic = all.filter((f) => {
    const base = f.form.split(' ')[0];
    return PERIODIC_FORMS.has(base) || PERIODIC_FORMS.has(f.form);
  });
  const pool = periodic.length ? periodic : all;
  const latest = pool[0] ?? null;

  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 2);
  const cutoffIso = cutoff.toISOString().slice(0, 10);
  const recentTwoYear = all
    .filter((f) => f.filingDate >= cutoffIso)
    .slice(0, 12);

  return { latest, isForeignIssuer, recentTwoYear };
}

export interface CompanyFinderConfidenceCache {
  latestAccession: string | null;
  latestFilingDate: string | null;
  latestForm: string | null;
  flags: ConfidenceFlags;
}

export interface ResolvedConfidence {
  result: ConfidenceResult;
  latestFilingDate: string | null;
  latestAccession: string | null;
  latestForm: string | null;
  flags: ConfidenceFlags;
  refreshedFromSec: boolean;
}

/**
 * Build confidence for a CIK. Reuses cached text flags when the latest accession is unchanged;
 * only re-downloads filing text when a newer SEC filing appears.
 */
export async function resolveCompanyFinderConfidence(input: {
  cik: string;
  cached?: CompanyFinderConfidenceCache | null;
}): Promise<ResolvedConfidence> {
  const snapshot = await fetchSecConfidenceSnapshot(input.cik);
  const latest = snapshot.latest;
  const latestAccession = latest?.accessionNumber ?? null;
  const latestFilingDate = latest?.filingDate ?? null;
  const latestForm = latest?.form ?? null;

  const cacheMatches =
    input.cached?.latestAccession &&
    latestAccession &&
    input.cached.latestAccession === latestAccession &&
    input.cached.flags != null;

  if (cacheMatches && input.cached) {
    const result = computeConfidenceFromFlags({
      latestFilingDate,
      latestForm,
      latestAccession,
      flags: {
        ...input.cached.flags,
        isForeignIssuer: snapshot.isForeignIssuer,
      },
    });
    return {
      result,
      latestFilingDate,
      latestAccession,
      latestForm,
      flags: {
        ...input.cached.flags,
        isForeignIssuer: snapshot.isForeignIssuer,
      },
      refreshedFromSec: false,
    };
  }

  let latestFilingText = '';
  if (latest) {
    try {
      latestFilingText = await secGetText(filingDocUrl(input.cik, latest));
      await sleep(200);
    } catch {
      latestFilingText = '';
    }
  }

  const recentChunks: string[] = [];
  for (const filing of snapshot.recentTwoYear.slice(0, 6)) {
    try {
      const chunk = await secGetText(filingDocUrl(input.cik, filing), 800_000);
      if (chunk) recentChunks.push(chunk);
      await sleep(200);
    } catch {
      // continue
    }
  }
  const recentTwoYearText = recentChunks.join('\n');

  const result = computeConfidenceScore({
    latestFilingDate,
    latestForm,
    latestAccession,
    isForeignIssuer: snapshot.isForeignIssuer,
    latestFilingText,
    recentTwoYearText,
  });

  const flags: ConfidenceFlags = {
    isForeignIssuer: snapshot.isForeignIssuer,
    goingConcern: result.findings.some((f) => f.code === 'going_concern'),
    reverseSplit: result.findings.some((f) => f.code === 'reverse_split'),
    discontinued: result.findings.some((f) => f.code === 'discontinued_ops'),
  };

  return {
    result,
    latestFilingDate,
    latestAccession,
    latestForm,
    flags,
    refreshedFromSec: true,
  };
}

export function findingsToJson(findings: ConfidenceFinding[]): ConfidenceFinding[] {
  return findings.map((f) => ({
    code: f.code,
    message: f.message,
    points: f.points,
  }));
}
