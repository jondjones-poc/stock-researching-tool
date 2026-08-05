import axios from 'axios';
import {
  finishCompanyFinderRun,
  getLatestCompanyFinderRun,
  startCompanyFinderRun,
  upsertCompanyFinderRows,
} from './companyFinderDb';
import {
  computeCompanyFinderMetrics,
  fetchCompanyFactsForCik,
  fetchSecTickerUniverse,
  type SecTickerEntry,
} from './companyFinderSec';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY?.trim();
const FMP_API_KEY = process.env.FMP_API_KEY?.trim();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchQuotes(
  tickers: string[]
): Promise<Map<string, { price: number | null; marketCap: number | null }>> {
  const map = new Map<string, { price: number | null; marketCap: number | null }>();
  if (!tickers.length) return map;

  // Prefer Finnhub (higher free throughput) for daily batch quotes.
  if (FINNHUB_API_KEY) {
    for (const ticker of tickers) {
      try {
        const res = await axios.get('https://finnhub.io/api/v1/quote', {
          params: { symbol: ticker, token: FINNHUB_API_KEY },
          timeout: 10000,
          validateStatus: () => true,
        });
        if (res.status === 200 && res.data && typeof res.data.c === 'number' && res.data.c > 0) {
          map.set(ticker, { price: Number(res.data.c), marketCap: null });
        }
      } catch {
        // continue
      }
      await sleep(120);
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
        await sleep(200);

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

        await upsertCompanyFinderRows([
          {
            ticker: company.ticker,
            cik: company.cik,
            name: company.name,
            exchange: null,
            price: quote?.price ?? null,
            sharesOutstanding: facts.sharesOutstanding,
            marketCap: metrics.marketCap,
            cash: facts.cash,
            cashAsOf: facts.cashAsOf,
            ocfYtd: facts.ocfYtd,
            ocfAsOf: facts.ocfAsOf,
            ocfPeriod: facts.ocfPeriod,
            score: metrics.score,
            ocfPerWeek: metrics.ocfPerWeek,
            estPerSharePerWeek: metrics.estPerSharePerWeek,
            weeklyOcfYieldPct: metrics.weeklyOcfYieldPct,
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
              price: null,
              sharesOutstanding: null,
              marketCap: null,
              cash: null,
              cashAsOf: null,
              ocfYtd: null,
              ocfAsOf: null,
              ocfPeriod: null,
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
