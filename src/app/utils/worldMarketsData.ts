import axios from 'axios';
import {
  classifyMarketStatus,
  classifyPeValuation,
  WORLD_MARKET_PE_SYMBOL_BY_ID,
  type WorldMarketPeriod,
  type WorldMarketPeValuation,
  type WorldMarketRegionConfig,
  type WorldMarketRegionResult,
} from '../config/worldMarkets';
import {
  computeReturnFromPoints,
  worldHistoryFromDate,
  type PricePoint,
} from './worldMarketReturns';
import { fetchFmpEod, loadCachedBars, upsertEodBars, type EodBar } from './marketEodCache';
import { loadWorldMarketIndicesFromDb } from './worldMarketIndicesDb';
import {
  loadStaleWorldMarketsCache,
  loadWorldMarketsCache,
  saveWorldMarketsCache,
} from './worldMarketsCacheDb';

function barsToPoints(bars: EodBar[]): PricePoint[] {
  return bars.map((b) => ({ date: b.date, close: b.close }));
}

async function fetchFmpPeBySymbol(symbols: string[]): Promise<Map<string, number | null>> {
  const fmpKey = process.env.FMP_API_KEY?.trim();
  const result = new Map<string, number | null>();
  if (!fmpKey || symbols.length === 0) return result;

  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(unique.join(','))}&apikey=${fmpKey}`;

  try {
    const response = await axios.get(url, { timeout: 15000, validateStatus: () => true });
    if (response.status !== 200 || !Array.isArray(response.data)) return result;

    for (const row of response.data as { symbol?: string; pe?: number }[]) {
      const sym = row.symbol?.toUpperCase();
      if (!sym) continue;
      const pe = row.pe;
      result.set(sym, pe !== undefined && pe !== null && Number.isFinite(Number(pe)) && Number(pe) > 0 ? Number(pe) : null);
    }
  } catch (error) {
    console.warn('FMP PE batch fetch failed:', error);
  }

  return result;
}

function emptyPeFields(): {
  peRatio: number | null;
  peValuation: WorldMarketPeValuation;
  peSymbol: string | null;
} {
  return { peRatio: null, peValuation: 'unavailable', peSymbol: null };
}

async function fetchFmpQuoteChangePercent(symbol: string): Promise<number | null> {
  const fmpKey = process.env.FMP_API_KEY?.trim();
  if (!fmpKey) return null;

  const url = `https://financialmodelingprep.com/stable/quote?symbol=${encodeURIComponent(symbol)}&apikey=${fmpKey}`;
  const response = await axios.get(url, { timeout: 10000, validateStatus: () => true });
  if (response.status !== 200 || !Array.isArray(response.data) || !response.data[0]) return null;

  const quote = response.data[0] as { changesPercentage?: number; changePercentage?: number };
  const pct = quote.changesPercentage ?? quote.changePercentage;
  return pct !== undefined && pct !== null && Number.isFinite(Number(pct)) ? Number(pct) : null;
}

async function loadFmpBars(symbol: string, period: WorldMarketPeriod): Promise<EodBar[]> {
  const upper = symbol.toUpperCase();
  const from = worldHistoryFromDate(period);
  const to = new Date().toISOString().slice(0, 10);

  const cached = await loadCachedBars([upper]);
  let bars = cached.get(upper) ?? [];

  const needsFetch =
    bars.length === 0 || bars[0].date > from || bars[bars.length - 1].date < to;

  if (needsFetch) {
    try {
      const fresh = await fetchFmpEod(symbol, from, to);
      if (fresh.length > 0) {
        bars = fresh;
        try {
          await upsertEodBars(upper, fresh);
        } catch {
          // Cache optional — continue with in-memory bars
        }
      }
    } catch (error) {
      console.warn(`FMP EOD fetch failed for ${symbol}:`, error);
    }
  }

  return bars.sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchFredPoints(seriesId: string, period: WorldMarketPeriod): Promise<PricePoint[]> {
  const fredKey = process.env.FRED_API_KEY?.trim();
  if (!fredKey) return [];

  const from = worldHistoryFromDate(period);
  const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&observation_start=${from}`;

  const response = await axios.get(url, { timeout: 15000, validateStatus: () => true });
  if (response.status !== 200 || !response.data?.observations) return [];

  return response.data.observations
    .filter((item: { value?: string }) => item.value && item.value !== '.')
    .map((item: { date: string; value: string }) => ({
      date: item.date,
      close: parseFloat(item.value),
    }))
    .filter((p: PricePoint) => Number.isFinite(p.close))
    .sort((a: PricePoint, b: PricePoint) => a.date.localeCompare(b.date));
}

async function loadRegionData(
  region: WorldMarketRegionConfig,
  period: WorldMarketPeriod
): Promise<WorldMarketRegionResult> {
  const base = {
    id: region.id,
    name: region.name,
    indexName: region.indexName,
    symbol: region.symbol,
    lat: region.lat,
    lng: region.lng,
    countryCodes: region.countryCodes,
    icon: region.icon,
    note: region.note,
    price: null as number | null,
    changePercent: null as number | null,
    status: 'unavailable' as const,
    dataSource: null as string | null,
    asOfDate: null as string | null,
    ...emptyPeFields(),
  };

  try {
    if (region.dataSource === 'FMP') {
      const [bars, todayPct] = await Promise.all([
        loadFmpBars(region.symbol, period),
        period === 'today' ? fetchFmpQuoteChangePercent(region.symbol) : Promise.resolve(null),
      ]);

      const points = barsToPoints(bars);
      const { changePercent, asOfDate } = computeReturnFromPoints(points, period, todayPct);
      const latest = points.length > 0 ? points[points.length - 1] : null;

      return {
        ...base,
        price: latest?.close ?? null,
        changePercent,
        status: classifyMarketStatus(changePercent),
        dataSource: 'FMP',
        asOfDate,
      };
    }

    if (region.dataSource === 'FRED' && region.fredSeriesId) {
      const points = await fetchFredPoints(region.fredSeriesId, period);
      const { changePercent, asOfDate } = computeReturnFromPoints(points, period);
      const latest = points.length > 0 ? points[points.length - 1] : null;

      return {
        ...base,
        price: latest?.close ?? null,
        changePercent,
        status: classifyMarketStatus(changePercent),
        dataSource: 'FRED',
        asOfDate,
      };
    }
  } catch (error) {
    console.error(`Failed to load world market region ${region.id}:`, error);
  }

  return base;
}

export async function fetchWorldMarkets(period: WorldMarketPeriod): Promise<{
  period: WorldMarketPeriod;
  regions: WorldMarketRegionResult[];
  fetchedAt: string;
  cached?: boolean;
  stale?: boolean;
}> {
  const cached = await loadWorldMarketsCache(period);
  if (cached) {
    return cached;
  }

  try {
    const fresh = await fetchWorldMarketsFresh(period);
    await saveWorldMarketsCache({
      period: fresh.period,
      regions: fresh.regions,
      fetchedAt: fresh.fetchedAt,
    });
    return { ...fresh, cached: false };
  } catch (error) {
    const stale = await loadStaleWorldMarketsCache(period);
    if (stale) {
      console.warn(`[world_markets] Live fetch failed for ${period} — serving stale cache`);
      return stale;
    }
    throw error;
  }
}

async function fetchWorldMarketsFresh(period: WorldMarketPeriod): Promise<{
  period: WorldMarketPeriod;
  regions: WorldMarketRegionResult[];
  fetchedAt: string;
}> {
  const indexConfigs = await loadWorldMarketIndicesFromDb();
  const results = await Promise.all(
    indexConfigs.map((region) => loadRegionData(region, period))
  );

  const peSymbols = indexConfigs
    .map((region) => WORLD_MARKET_PE_SYMBOL_BY_ID[region.id])
    .filter(Boolean) as string[];
  const peBySymbol = await fetchFmpPeBySymbol(peSymbols);

  const regions = results.map((region) => {
    const peSymbol = WORLD_MARKET_PE_SYMBOL_BY_ID[region.id] ?? null;
    const peRatio = peSymbol ? peBySymbol.get(peSymbol.toUpperCase()) ?? null : null;
    return {
      ...region,
      peSymbol,
      peRatio,
      peValuation: classifyPeValuation(peRatio),
    };
  });

  return {
    period,
    regions,
    fetchedAt: new Date().toISOString(),
  };
}
