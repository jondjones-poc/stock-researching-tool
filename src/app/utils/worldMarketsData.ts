import axios from 'axios';
import {
  classifyMarketStatus,
  type WorldMarketPeriod,
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

function barsToPoints(bars: EodBar[]): PricePoint[] {
  return bars.map((b) => ({ date: b.date, close: b.close }));
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
}> {
  const indexConfigs = await loadWorldMarketIndicesFromDb();
  const results = await Promise.all(
    indexConfigs.map((region) => loadRegionData(region, period))
  );

  return {
    period,
    regions: results,
    fetchedAt: new Date().toISOString(),
  };
}
