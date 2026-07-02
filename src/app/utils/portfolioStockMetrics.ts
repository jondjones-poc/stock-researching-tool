import { fetchLiveStockQuotes } from './marketQuotes';
import {
  computePeriodReturnPct,
  fetchFmpEod,
  loadCachedBars,
  refreshStaleEodCache,
  type EodBar,
} from './marketEodCache';
import { periodStartDate } from './marketPeriods';

function closeOnOrBefore(bars: EodBar[], targetDate: string): number | null {
  let best: number | null = null;
  for (const bar of bars) {
    if (bar.date <= targetDate) best = bar.close;
    else break;
  }
  return best;
}

function computeOneMonthReturn(bars: EodBar[]): number | null {
  return computePeriodReturnPct(bars, '1m');
}

async function fetchOneMonthBars(symbol: string): Promise<EodBar[]> {
  const startDate = periodStartDate('1m');
  if (!startDate) return [];

  const from = new Date(startDate);
  from.setDate(from.getDate() - 7);
  const to = new Date().toISOString().slice(0, 10);

  try {
    return await fetchFmpEod(symbol, from.toISOString().slice(0, 10), to);
  } catch {
    return [];
  }
}

export async function enrichPortfolioStockMetrics(symbols: string[]): Promise<{
  dayChangeBySymbol: Map<string, number | null>;
  monthChangeBySymbol: Map<string, number | null>;
  livePriceBySymbol: Map<string, number | null>;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const dayChangeBySymbol = new Map<string, number | null>();
  const monthChangeBySymbol = new Map<string, number | null>();
  const livePriceBySymbol = new Map<string, number | null>();

  if (unique.length === 0) {
    return { dayChangeBySymbol, monthChangeBySymbol, livePriceBySymbol };
  }

  const [{ quotes: liveQuotes }, cachedBars] = await Promise.all([
    fetchLiveStockQuotes(unique),
    loadCachedBars(unique),
  ]);

  for (const symbol of unique) {
    const live = liveQuotes.get(symbol);
    const livePrice = live?.price != null && Number.isFinite(live.price) && live.price > 0 ? live.price : null;
    livePriceBySymbol.set(symbol, livePrice);
    dayChangeBySymbol.set(
      symbol,
      live?.changePercent != null && Number.isFinite(live.changePercent) ? live.changePercent : null
    );

    const bars = cachedBars.get(symbol) ?? [];
    const startDate = periodStartDate('1m');
    const hasMonthHistory =
      bars.length >= 2 &&
      startDate != null &&
      closeOnOrBefore(bars, startDate) !== null;

    monthChangeBySymbol.set(
      symbol,
      hasMonthHistory ? computeOneMonthReturn(bars) : null
    );
  }

  const missingMonth = unique.filter((s) => monthChangeBySymbol.get(s) == null);
  if (missingMonth.length > 0) {
    await refreshStaleEodCache(missingMonth);
    const refreshedBars = await loadCachedBars(missingMonth);

    for (const symbol of missingMonth) {
      const bars = refreshedBars.get(symbol) ?? [];
      const startDate = periodStartDate('1m');
      const hasMonthHistory =
        bars.length >= 2 &&
        startDate != null &&
        closeOnOrBefore(bars, startDate) !== null;

      if (hasMonthHistory) {
        monthChangeBySymbol.set(symbol, computeOneMonthReturn(bars));
        continue;
      }

      const fetched = await fetchOneMonthBars(symbol);
      if (fetched.length >= 2) {
        monthChangeBySymbol.set(symbol, computeOneMonthReturn(fetched));
      }
    }
  }

  return { dayChangeBySymbol, monthChangeBySymbol, livePriceBySymbol };
}
