import { query } from './db';
import {
  computeCacheStatus,
  symbolsNeedingRefresh,
  type CacheStatus,
} from './marketCachePolicy';
import {
  computePeriodReturnPct,
  loadCachedBars,
  loadEodCacheMeta,
  refreshStaleEodCache,
  type EodBar,
} from './marketEodCache';
import {
  loadCachedStockQuotes,
  loadQuoteCacheMeta,
  refreshStaleStockQuotes,
  type StockQuote,
} from './marketQuotes';
import {
  periodStartDate,
  type MarketHeatmapPeriod,
} from './marketPeriods';

export interface PeriodCachedQuote {
  symbol: string;
  name: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  dataSource: string | null;
  fetchedAt: string;
}

const EOD_PERIODS: MarketHeatmapPeriod[] = ['1m', 'ytd', '1y', '2y'];

function closeOnOrBefore(bars: EodBar[], targetDate: string): number | null {
  let best: number | null = null;
  for (const bar of bars) {
    if (bar.date <= targetDate) best = bar.close;
    else break;
  }
  return best;
}

function buildEodPeriodQuote(
  symbol: string,
  period: MarketHeatmapPeriod,
  bars: EodBar[],
  dataSource: string
): PeriodCachedQuote | null {
  const changePercent = computePeriodReturnPct(bars, period);
  const latest = bars.length > 0 ? bars[bars.length - 1] : null;
  const startDate = periodStartDate(period);
  const startClose = startDate ? closeOnOrBefore(bars, startDate) : null;

  if (!latest) return null;

  return {
    symbol,
    name: symbol,
    price: latest.close,
    change: startClose !== null ? latest.close - startClose : null,
    changePercent,
    dataSource,
    fetchedAt: new Date().toISOString(),
  };
}

export async function upsertPeriodCacheEntry(
  symbol: string,
  period: MarketHeatmapPeriod,
  quote: Omit<PeriodCachedQuote, 'symbol' | 'fetchedAt'> & { fetchedAt?: string }
): Promise<void> {
  const fetchedAt = quote.fetchedAt ?? new Date().toISOString();
  await query(
    `INSERT INTO market_stock_period_cache
       (symbol, period, name, price, change_abs, change_pct, data_source, fetched_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (symbol, period) DO UPDATE SET
       name = EXCLUDED.name,
       price = EXCLUDED.price,
       change_abs = EXCLUDED.change_abs,
       change_pct = EXCLUDED.change_pct,
       data_source = EXCLUDED.data_source,
       fetched_at = EXCLUDED.fetched_at`,
    [
      symbol.toUpperCase(),
      period,
      quote.name,
      quote.price,
      quote.change,
      quote.changePercent,
      quote.dataSource,
      fetchedAt,
    ]
  );
}

export async function upsertTodayPeriodCacheFromQuote(quote: StockQuote): Promise<void> {
  await upsertPeriodCacheEntry(quote.symbol, 'today', {
    name: quote.name,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    dataSource: quote.dataSource,
    fetchedAt: quote.fetchedAt,
  });
}

export async function upsertEodPeriodCachesFromBars(
  symbol: string,
  bars: EodBar[],
  dataSource = 'EOD_CACHE'
): Promise<void> {
  const upper = symbol.toUpperCase();
  const fetchedAt = new Date().toISOString();

  for (const period of EOD_PERIODS) {
    const quote = buildEodPeriodQuote(upper, period, bars, dataSource);
    if (!quote) continue;
    await upsertPeriodCacheEntry(upper, period, { ...quote, fetchedAt });
  }
}

export async function loadPeriodCache(
  symbols: string[],
  period: MarketHeatmapPeriod
): Promise<Map<string, PeriodCachedQuote>> {
  const result = new Map<string, PeriodCachedQuote>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return result;

  try {
    const rows = await query(
      `SELECT symbol, name, price, change_abs, change_pct, data_source, fetched_at
       FROM market_stock_period_cache
       WHERE symbol = ANY($1::text[]) AND period = $2`,
      [unique, period]
    );
    for (const row of rows.rows) {
      result.set(String(row.symbol).toUpperCase(), {
        symbol: String(row.symbol).toUpperCase(),
        name: row.name || row.symbol,
        price: row.price !== null ? Number(row.price) : null,
        change: row.change_abs !== null ? Number(row.change_abs) : null,
        changePercent: row.change_pct !== null ? Number(row.change_pct) : null,
        dataSource: row.data_source,
        fetchedAt:
          row.fetched_at instanceof Date
            ? row.fetched_at.toISOString()
            : String(row.fetched_at),
      });
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  return result;
}

export async function loadPeriodCacheMeta(
  symbols: string[],
  period: MarketHeatmapPeriod
): Promise<Map<string, Date>> {
  const meta = new Map<string, Date>();
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return meta;

  try {
    const rows = await query(
      `SELECT symbol, fetched_at
       FROM market_stock_period_cache
       WHERE symbol = ANY($1::text[]) AND period = $2`,
      [unique, period]
    );
    for (const row of rows.rows) {
      meta.set(String(row.symbol).toUpperCase(), new Date(row.fetched_at));
    }
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code !== '42P01') throw error;
  }

  return meta;
}

function periodCoverageOk(bars: EodBar[], period: MarketHeatmapPeriod): boolean {
  if (bars.length === 0) return false;
  const startDate = periodStartDate(period);
  if (!startDate) return true;
  return closeOnOrBefore(bars, startDate) !== null;
}

async function backfillPeriodCacheFromSources(
  symbols: string[],
  period: MarketHeatmapPeriod
): Promise<void> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) return;

  if (period === 'today') {
    const quotes = await loadCachedStockQuotes(unique);
    for (const quote of quotes.values()) {
      await upsertTodayPeriodCacheFromQuote(quote);
    }
    return;
  }

  const barsBySymbol = await loadCachedBars(unique);
  for (const symbol of unique) {
    const bars = barsBySymbol.get(symbol) ?? [];
    if (bars.length > 0) {
      await upsertEodPeriodCachesFromBars(symbol, bars);
    }
  }
}

function mergePeriodStatus(
  symbols: string[],
  period: MarketHeatmapPeriod,
  meta: Map<string, Date>,
  barsBySymbol: Map<string, EodBar[]>
): CacheStatus {
  const base = computeCacheStatus(symbols, meta);
  if (period === 'today') return base;

  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  for (const symbol of unique) {
    const bars = barsBySymbol.get(symbol) ?? [];
    if (!periodCoverageOk(bars, period)) {
      return { ...base, cacheStale: true };
    }
  }

  return base;
}

/** Read heatmap quotes for a specific period from period cache (no API calls). */
export async function resolveHeatmapQuotesFromCache(
  symbols: string[],
  period: MarketHeatmapPeriod
): Promise<{
  quotes: Map<string, PeriodCachedQuote>;
  cacheStatus: CacheStatus;
  warning?: string;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  let quotes = await loadPeriodCache(unique, period);

  const missing = unique.filter((s) => !quotes.has(s));
  if (missing.length > 0) {
    await backfillPeriodCacheFromSources(missing, period);
    quotes = await loadPeriodCache(unique, period);
  }

  const meta = await loadPeriodCacheMeta(unique, period);
  const barsBySymbol = period === 'today' ? new Map<string, EodBar[]>() : await loadCachedBars(unique);
  const warnings: string[] = [];

  const stillMissing = unique.filter((s) => !quotes.has(s));
  if (stillMissing.length > 0) {
    warnings.push(
      `No cached data for ${stillMissing.slice(0, 5).join(', ')}${stillMissing.length > 5 ? '…' : ''} (${period})`
    );
  }

  const uncovered =
    period === 'today'
      ? []
      : unique.filter((s) => !periodCoverageOk(barsBySymbol.get(s) ?? [], period));
  if (uncovered.length > 0) {
    warnings.push(
      `Insufficient history for ${period}: ${uncovered.slice(0, 5).join(', ')}${uncovered.length > 5 ? '…' : ''}`
    );
  }

  return {
    quotes,
    cacheStatus: mergePeriodStatus(unique, period, meta, barsBySymbol),
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
  };
}

/** Refresh stale source data for this period, then return period cache. */
export async function refreshStaleHeatmapQuotes(
  symbols: string[],
  period: MarketHeatmapPeriod
): Promise<{
  quotes: Map<string, PeriodCachedQuote>;
  cacheStatus: CacheStatus;
  refreshedCount: number;
  warning?: string;
}> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const warnings: string[] = [];
  let refreshedCount = 0;

  if (period === 'today') {
    const periodMeta = await loadPeriodCacheMeta(unique, 'today');
    const quoteMeta = await loadQuoteCacheMeta(unique);
    const toRefresh = [
      ...new Set([
        ...symbolsNeedingRefresh(unique, periodMeta),
        ...symbolsNeedingRefresh(unique, quoteMeta),
      ]),
    ];

    if (toRefresh.length > 0) {
      const result = await refreshStaleStockQuotes(toRefresh);
      if (result.warning) warnings.push(result.warning);
      refreshedCount = result.refreshedCount;
      for (const quote of result.quotes.values()) {
        await upsertTodayPeriodCacheFromQuote(quote);
      }
    }
  } else {
    const eodMeta = await loadEodCacheMeta(unique);
    const periodMeta = await loadPeriodCacheMeta(unique, period);
    const toRefresh = [
      ...new Set([
        ...symbolsNeedingRefresh(unique, eodMeta),
        ...symbolsNeedingRefresh(unique, periodMeta),
      ]),
    ];

    if (toRefresh.length > 0) {
      const { refreshed, warning } = await refreshStaleEodCache(toRefresh);
      if (warning) warnings.push(warning);
      refreshedCount = refreshed;

      const barsBySymbol = await loadCachedBars(toRefresh);
      for (const symbol of toRefresh) {
        const bars = barsBySymbol.get(symbol) ?? [];
        if (bars.length > 0) {
          await upsertEodPeriodCachesFromBars(symbol, bars);
        }
      }
    }
  }

  const { quotes, cacheStatus, warning: cacheWarning } = await resolveHeatmapQuotesFromCache(
    symbols,
    period
  );
  if (cacheWarning) warnings.push(cacheWarning);

  return {
    quotes,
    cacheStatus,
    refreshedCount,
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
  };
}
