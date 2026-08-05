import axios from 'axios';
import {
  finishCompanyFinderRun,
  getCompanyFinderConfidenceCache,
  getLatestCompanyFinderRun,
  startCompanyFinderRun,
  upsertCompanyFinderRows,
} from './companyFinderDb';
import {
  computeCompanyFinderMetrics,
  fetchCompanyFactsForCik,
  fetchSecCompanyMeta,
  fetchSecTickerUniverse,
  type SecTickerEntry,
} from './companyFinderSec';
import {
  findingsToJson,
  resolveCompanyFinderConfidence,
} from './companyFinderConfidenceSec';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY?.trim();
const FMP_API_KEY = process.env.FMP_API_KEY?.trim();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type QuoteMeta = {
  price: number | null;
  marketCap: number | null;
  sector: string | null;
  country: string | null;
  exchange: string | null;
};

async function fetchQuotes(tickers: string[]): Promise<Map<string, QuoteMeta>> {
  const map = new Map<string, QuoteMeta>();
  if (!tickers.length) return map;

  // Prefer Finnhub (higher free throughput) for daily batch quotes + profile.
  if (FINNHUB_API_KEY) {
    for (const ticker of tickers) {
      const entry: QuoteMeta = {
        price: null,
        marketCap: null,
        sector: null,
        country: null,
        exchange: null,
      };
      try {
        const res = await axios.get('https://finnhub.io/api/v1/quote', {
          params: { symbol: ticker, token: FINNHUB_API_KEY },
          timeout: 10000,
          validateStatus: () => true,
        });
        if (res.status === 200 && res.data && typeof res.data.c === 'number' && res.data.c > 0) {
          entry.price = Number(res.data.c);
        }
      } catch {
        // continue
      }
      await sleep(80);
      try {
        const profile = await axios.get('https://finnhub.io/api/v1/stock/profile2', {
          params: { symbol: ticker, token: FINNHUB_API_KEY },
          timeout: 10000,
          validateStatus: () => true,
        });
        if (profile.status === 200 && profile.data && typeof profile.data === 'object') {
          const p = profile.data as Record<string, unknown>;
          if (typeof p.finnhubIndustry === 'string' && p.finnhubIndustry.trim()) {
            entry.sector = p.finnhubIndustry.trim();
          }
          if (typeof p.country === 'string' && p.country.trim()) {
            entry.country = p.country.trim().toUpperCase();
          }
          if (typeof p.exchange === 'string' && p.exchange.trim()) {
            entry.exchange = p.exchange.trim();
          }
          const mcap = Number(p.marketCapitalization);
          if (Number.isFinite(mcap) && mcap > 0) {
            // Finnhub market cap is in millions.
            entry.marketCap = mcap * 1e6;
          }
        }
      } catch {
        // continue
      }
      map.set(ticker, entry);
      await sleep(80);
    }
    return map;
  }

  // Fallback: small FMP batches (preserve free daily budget).
  if (!FMP_API_KEY) return map;
  const chunkSize = 20;
  for (let i = 0; i < tickers.length; i += chunkSize) {
    const chunk = tickers.slice(i, i + chunkSize);
    try {
      const res = await axios.get('https://financialmodelingprep.com/stable/quote', {
        params: { symbol: chunk.join(','), apikey: FMP_API_KEY },
        timeout: 15000,
        validateStatus: () => true,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      for (const row of rows) {
        const symbol = String(row.symbol || '').toUpperCase();
        if (!symbol) continue;
        map.set(symbol, {
          price: Number.isFinite(Number(row.price)) ? Number(row.price) : null,
          marketCap: Number.isFinite(Number(row.marketCap)) ? Number(row.marketCap) : null,
          sector: null,
          country: null,
          exchange: null,
        });
      }
    } catch {
      // continue
    }
    await sleep(250);
  }
  return map;
}

export interface CompanyFinderUpdateOptions {
  /** How many tickers to process in this run. */
  batchSize?: number;
  /** Start offset into SEC ticker universe. If omitted, continue from last run cursor. */
  cursorOffset?: number;
  /** Reset cursor to 0 before running. */
  resetCursor?: boolean;
  mode?: string;
}

export interface CompanyFinderUpdateResult {
  runId: number;
  mode: string;
  cursorStart: number;
  cursorEnd: number;
  universeSize: number;
  processed: number;
  upserted: number;
  failed: number;
  candidates: number;
  status: 'ok' | 'partial' | 'error';
  errorMessage?: string;
}

export async function runCompanyFinderUpdate(
  options: CompanyFinderUpdateOptions = {}
): Promise<CompanyFinderUpdateResult> {
  const batchSize = Math.min(Math.max(options.batchSize ?? 75, 1), 250);
  const mode = options.mode ?? 'daily';

  let cursorStart = options.cursorOffset ?? 0;
  if (options.resetCursor) {
    cursorStart = 0;
  } else if (options.cursorOffset == null) {
    const latest = await getLatestCompanyFinderRun();
    cursorStart = latest?.cursorOffset ?? 0;
  }

  const universe = await fetchSecTickerUniverse();
  if (cursorStart >= universe.length) cursorStart = 0;
  const slice: SecTickerEntry[] = universe.slice(cursorStart, cursorStart + batchSize);

  const runId = await startCompanyFinderRun(mode, cursorStart);
  let processed = 0;
  let upserted = 0;
  let failed = 0;
  let candidates = 0;
  let errorMessage: string | undefined;

  try {
    const quotes = await fetchQuotes(slice.map((s) => s.ticker));
    const nowIso = new Date().toISOString();

    for (const company of slice) {
      processed += 1;
      try {
        const facts = await fetchCompanyFactsForCik(company.cik);
        await sleep(150);
        let secMeta = { exchange: null as string | null, sector: null as string | null, country: null as string | null };
        try {
          secMeta = await fetchSecCompanyMeta(company.cik);
          await sleep(150);
        } catch {
          // optional metadata
        }

        const quote = quotes.get(company.ticker);
        const metrics = computeCompanyFinderMetrics({
          price: quote?.price ?? null,
          sharesOutstanding: facts.sharesOutstanding,
          marketCap: quote?.marketCap ?? null,
          cash: facts.cash,
          ocfYtd: facts.ocfYtd,
          ocfAsOf: facts.ocfAsOf,
        });

        if (metrics.score != null && metrics.score < 0) candidates += 1;

        let confidenceScore: number | null = null;
        let confidenceReasons: ReturnType<typeof findingsToJson> | null = null;
        let confidenceLatestFilingDate: string | null = null;
        let confidenceLatestAccession: string | null = null;
        let confidenceLatestForm: string | null = null;
        let confidenceIsForeign: boolean | null = null;
        let confidenceFlagGoingConcern: boolean | null = null;
        let confidenceFlagReverseSplit: boolean | null = null;
        let confidenceFlagDiscontinued: boolean | null = null;
        try {
          const cached = await getCompanyFinderConfidenceCache(company.ticker);
          const confidence = await resolveCompanyFinderConfidence({
            cik: company.cik,
            cached,
          });
          confidenceScore = confidence.result.score;
          confidenceReasons = findingsToJson(confidence.result.findings);
          confidenceLatestFilingDate = confidence.latestFilingDate;
          confidenceLatestAccession = confidence.latestAccession;
          confidenceLatestForm = confidence.latestForm;
          confidenceIsForeign = confidence.flags.isForeignIssuer;
          confidenceFlagGoingConcern = confidence.flags.goingConcern;
          confidenceFlagReverseSplit = confidence.flags.reverseSplit;
          confidenceFlagDiscontinued = confidence.flags.discontinued;
          await sleep(150);
        } catch {
          // Confidence is optional; value metrics still save.
        }

        await upsertCompanyFinderRows([
          {
            ticker: company.ticker,
            cik: company.cik,
            name: company.name,
            exchange: quote?.exchange || secMeta.exchange,
            sector: quote?.sector || secMeta.sector,
            country: quote?.country || secMeta.country,
            price: quote?.price ?? null,
            sharesOutstanding: facts.sharesOutstanding,
            marketCap: metrics.marketCap,
            cash: facts.cash,
            cashAsOf: facts.cashAsOf,
            totalDebt: facts.totalDebt,
            totalDebtAsOf: facts.totalDebtAsOf,
            totalDebtSource: facts.totalDebtSource,
            netCash: facts.netCash,
            ocfYtd: facts.ocfYtd,
            ocfAsOf: facts.ocfAsOf,
            ocfPeriod: facts.ocfPeriod,
            fcfYtd: facts.fcfYtd,
            fcfAsOf: facts.fcfAsOf,
            fcfPeriod: facts.fcfPeriod,
            fcfSource: facts.fcfSource,
            score: metrics.score,
            ocfPerWeek: metrics.ocfPerWeek,
            estPerSharePerWeek: metrics.estPerSharePerWeek,
            weeklyOcfYieldPct: metrics.weeklyOcfYieldPct,
            confidenceScore,
            confidenceReasons,
            confidenceLatestFilingDate,
            confidenceLatestAccession,
            confidenceLatestForm,
            confidenceIsForeign,
            confidenceFlagGoingConcern,
            confidenceFlagReverseSplit,
            confidenceFlagDiscontinued,
            dataQuality: metrics.dataQuality,
            errorMessage: null,
            factsFetchedAt: nowIso,
            quoteFetchedAt: quote ? nowIso : null,
          },
        ]);
        upserted += 1;
      } catch (err) {
        failed += 1;
        const msg = err instanceof Error ? err.message : 'Unknown error';
        try {
          await upsertCompanyFinderRows([
            {
              ticker: company.ticker,
              cik: company.cik,
              name: company.name,
              exchange: null,
              sector: null,
              country: null,
              price: null,
              sharesOutstanding: null,
              marketCap: null,
              cash: null,
              cashAsOf: null,
              totalDebt: null,
              totalDebtAsOf: null,
              totalDebtSource: null,
              netCash: null,
              ocfYtd: null,
              ocfAsOf: null,
              ocfPeriod: null,
              fcfYtd: null,
              fcfAsOf: null,
              fcfPeriod: null,
              fcfSource: null,
              score: null,
              ocfPerWeek: null,
              estPerSharePerWeek: null,
              weeklyOcfYieldPct: null,
              dataQuality: 'missing',
              errorMessage: msg.slice(0, 500),
              factsFetchedAt: null,
              quoteFetchedAt: null,
            },
          ]);
        } catch {
          // ignore secondary failure
        }
      }
    }

    const cursorEnd = (cursorStart + slice.length) % Math.max(universe.length, 1);
    const status: 'ok' | 'partial' = failed > 0 && upserted > 0 ? 'partial' : 'ok';
    await finishCompanyFinderRun(runId, {
      status,
      processed,
      upserted,
      failed,
      candidates,
      cursorOffset: cursorEnd,
      errorMessage: failed ? `${failed} ticker(s) failed in batch` : null,
    });

    return {
      runId,
      mode,
      cursorStart,
      cursorEnd,
      universeSize: universe.length,
      processed,
      upserted,
      failed,
      candidates,
      status,
    };
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Company finder update failed';
    const cursorEnd = cursorStart;
    await finishCompanyFinderRun(runId, {
      status: 'error',
      processed,
      upserted,
      failed: failed + Math.max(slice.length - processed, 0),
      candidates,
      cursorOffset: cursorEnd,
      errorMessage,
    });
    return {
      runId,
      mode,
      cursorStart,
      cursorEnd,
      universeSize: universe.length,
      processed,
      upserted,
      failed,
      candidates,
      status: 'error',
      errorMessage,
    };
  }
}
