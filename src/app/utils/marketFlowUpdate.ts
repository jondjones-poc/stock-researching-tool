import { isMarketFlowMockMode } from '../config/marketFlow';
import {
  finishMarketFlowRun,
  getLatestPriceDate,
  listActiveMarketFlowFunds,
  seedMarketFlowUniverse,
  startMarketFlowRun,
  updateFundMeta,
  upsertMarketFlowPrices,
} from './marketFlowDb';
import { defaultHistoryFromDate, fetchMarketFlowEod, todayUtcDate } from './marketFlowFetch';
import { addCalendarDays, recomputeFundReturns } from './marketFlowReturns';

export interface MarketFlowUpdateResult {
  runId: number;
  mode: 'live' | 'mock';
  status: 'ok' | 'partial' | 'error';
  fundsOk: number;
  fundsFailed: number;
  details: Array<{
    symbol: string;
    ok: boolean;
    inserted: number;
    source?: string;
    error?: string;
  }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Daily (or admin) update:
 * - Seeds universe if empty
 * - Incremental: after first import, only fetch from last_price_date - 5 days
 * - Continues if one fund fails
 * - Recomputes returns from DB prices
 */
export async function runMarketFlowUpdate(options?: {
  forceFullHistory?: boolean;
}): Promise<MarketFlowUpdateResult> {
  await seedMarketFlowUniverse();

  const mock = isMarketFlowMockMode() || !process.env.FMP_API_KEY?.trim();
  const mode: 'live' | 'mock' = mock ? 'mock' : 'live';
  const runId = await startMarketFlowRun(mode);
  const funds = await listActiveMarketFlowFunds();
  const to = todayUtcDate();
  const details: MarketFlowUpdateResult['details'] = [];
  let fundsOk = 0;
  let fundsFailed = 0;

  for (const fund of funds) {
    try {
      const latest = options?.forceFullHistory ? null : await getLatestPriceDate(fund.id);
      const from = latest
        ? addCalendarDays(latest, -5)
        : defaultHistoryFromDate();

      const { bars, source } = await fetchMarketFlowEod(fund.symbol, from, to);
      const inserted = await upsertMarketFlowPrices(fund.id, bars);
      await recomputeFundReturns(fund.id);
      const newLatest = await getLatestPriceDate(fund.id);

      await updateFundMeta(fund.id, {
        lastFetchedAt: new Date(),
        lastPriceDate: newLatest,
        lastError: null,
        status: newLatest ? 'ok' : 'error',
      });

      details.push({ symbol: fund.symbol, ok: true, inserted, source });
      fundsOk += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await updateFundMeta(fund.id, {
        lastFetchedAt: new Date(),
        lastError: message,
        status: 'error',
      });
      // Still try to recompute from whatever history we already have
      try {
        await recomputeFundReturns(fund.id);
      } catch {
        // ignore
      }
      details.push({ symbol: fund.symbol, ok: false, inserted: 0, error: message });
      fundsFailed += 1;
    }

    // Stay within free API limits
    if (!mock) await sleep(350);
  }

  const status: MarketFlowUpdateResult['status'] =
    fundsFailed === 0 ? 'ok' : fundsOk === 0 ? 'error' : 'partial';

  await finishMarketFlowRun(runId, status, fundsOk, fundsFailed, { details });

  return { runId, mode, status, fundsOk, fundsFailed, details };
}
