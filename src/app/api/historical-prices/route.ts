import { NextResponse } from 'next/server';
import axios from 'axios';
import {
  SMA_LOOKBACK_CALENDAR_DAYS,
  addCalendarDays,
  attachMovingAverages,
  fetchAlphaVantageHistoricalPrices,
  fetchNasdaqHistoricalPrices,
  fetchStooqHistoricalPrices,
  fetchYahooHistoricalPrices,
  type HistoricalPriceBar,
} from '../../utils/yahooHistoricalPrices';
import { readPriceHistoryCache, writePriceHistoryCache } from '../../utils/priceHistoryCache';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FRED_API_KEY = process.env.FRED_API_KEY;

function filterByDateRange(
  bars: HistoricalPriceBar[],
  from?: string | null,
  to?: string | null
): HistoricalPriceBar[] {
  if (!from && !to) return bars;
  return bars.filter((item) => {
    const itemDate = item.date;
    if (from && itemDate < from) return false;
    if (to && itemDate > to) return false;
    return true;
  });
}

function normalizeFmpBars(raw: unknown[]): HistoricalPriceBar[] {
  return raw
    .filter(
      (item: any) => item && item.date && item.close !== undefined && item.close !== null
    )
    .map((item: any) => ({
      date: String(item.date).slice(0, 10),
      open: item.open ?? item.close ?? 0,
      high: item.high ?? item.close ?? 0,
      low: item.low ?? item.close ?? 0,
      close: item.close ?? 0,
      volume: item.volume ?? 0,
      change: item.change ?? 0,
      changePercent: item.changePercent ?? 0,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

async function fetchFmpHistoricalPrices(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<HistoricalPriceBar[]> {
  if (!FMP_API_KEY) {
    throw new Error('FMP_API_KEY is not configured');
  }

  const urls = [
    `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${symbol}&apikey=${FMP_API_KEY}${
      from && to ? `&from=${from}&to=${to}` : ''
    }`,
    `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}${
      from && to ? `&from=${from}&to=${to}` : ''
    }`,
  ];

  let lastError = 'FMP API returned no data';

  for (const url of urls) {
    const response = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true,
    });

    if (response.status === 402) {
      throw new Error(
        'FMP API returned status 402 (Payment Required) — plan/quota gated'
      );
    }

    if (response.status !== 200) {
      lastError =
        response.data?.['Error Message'] || `FMP API returned status ${response.status}`;
      continue;
    }

    if (response.data && typeof response.data === 'object' && 'Error Message' in response.data) {
      lastError = response.data['Error Message'];
      continue;
    }

    let historicalArray: unknown[] | null = null;
    const data = response.data;
    if (Array.isArray(data) && data.length > 0) {
      historicalArray = data;
    } else if (Array.isArray(data?.historical) && data.historical.length > 0) {
      historicalArray = data.historical;
    } else if (Array.isArray(data?.historicalStockList) && data.historicalStockList.length > 0) {
      historicalArray = data.historicalStockList;
    }

    if (!historicalArray || historicalArray.length === 0) {
      lastError = 'FMP returned empty historical array';
      continue;
    }

    return normalizeFmpBars(historicalArray);
  }

  throw new Error(lastError);
}

async function fetchEquityHistoricalWithMas(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<{ historical: HistoricalPriceBar[]; source: string }> {
  // Pull extra history so 30/150 SMAs are defined from the start of the visible window.
  const fetchFrom = from
    ? addCalendarDays(from, -SMA_LOOKBACK_CALENDAR_DAYS)
    : from;
  const fetchTo = to;

  let bars: HistoricalPriceBar[] = [];
  let source = 'YAHOO';
  const errors: string[] = [];

  const cached = await readPriceHistoryCache(symbol, { allowStale: true });
  if (cached?.fresh) {
    const coversFrom = !fetchFrom || cached.bars[0]?.date <= fetchFrom;
    // Allow cache ending a few days earlier than `to` (weekends/holidays).
    const coversToLoose =
      !fetchTo ||
      cached.bars[cached.bars.length - 1]?.date >= addCalendarDays(fetchTo, -5);
    if (coversFrom && coversToLoose) {
      bars = cached.bars;
      source = `${cached.source}_CACHE`;
    }
  }

  if (bars.length === 0) {
    const trySource = async (
      name: string,
      fn: () => Promise<HistoricalPriceBar[]>
    ): Promise<boolean> => {
      try {
        bars = await fn();
        source = name;
        return true;
      } catch (err: unknown) {
        errors.push(`${name}: ${err instanceof Error ? err.message : 'failed'}`);
        return false;
      }
    };

    const ok =
      (await trySource('NASDAQ', () =>
        fetchNasdaqHistoricalPrices(symbol, fetchFrom, fetchTo)
      )) ||
      (await trySource('YAHOO', () => fetchYahooHistoricalPrices(symbol, fetchFrom, fetchTo))) ||
      (await trySource('STOOQ', () => fetchStooqHistoricalPrices(symbol, fetchFrom, fetchTo))) ||
      ((process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE) &&
        (await trySource('ALPHA_VANTAGE', () =>
          fetchAlphaVantageHistoricalPrices(symbol, fetchFrom, fetchTo)
        ))) ||
      (await trySource('FMP', () => fetchFmpHistoricalPrices(symbol, fetchFrom, fetchTo)));

    if (!ok) {
      // Stale cache is better than a hard failure when free providers rate-limit.
      if (cached?.bars?.length) {
        bars = cached.bars;
        source = `${cached.source}_STALE_CACHE`;
      } else {
        throw new Error(`Free historical sources failed for ${symbol}. ${errors.join(' | ')}`);
      }
    } else if (!source.includes('CACHE')) {
      await writePriceHistoryCache(symbol, source, bars);
    }
  }

  const withMas = attachMovingAverages(bars);
  const filtered = filterByDateRange(withMas, from, to);

  if (filtered.length === 0) {
    throw new Error(
      `No historical data available for ${symbol} in the selected date range`
    );
  }

  return { historical: filtered, source };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const dataSource = searchParams.get('dataSource'); // 'FMP' | 'FRED' | 'YAHOO'
  const fredSeriesId = searchParams.get('fredSeriesId');

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  try {
    // FRED path (macro series on the dashboard)
    if (dataSource === 'FRED' && fredSeriesId) {
      if (!FRED_API_KEY) {
        return NextResponse.json({ error: 'FRED_API_KEY is not configured' }, { status: 500 });
      }

      let fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${fredSeriesId}&api_key=${FRED_API_KEY}&file_type=json`;
      if (from) fredUrl += `&observation_start=${from}`;
      if (to) fredUrl += `&observation_end=${to}`;

      const response = await axios.get(fredUrl);
      const data = response.data;

      if (!data || !data.observations) {
        return NextResponse.json({ error: 'No data available from FRED' }, { status: 404 });
      }

      const historicalData = data.observations
        .filter(
          (item: { value?: string }) =>
            item && item.value && item.value !== '.' && !isNaN(parseFloat(item.value))
        )
        .map((item: { date: string; value: string }) => {
          const value = parseFloat(item.value);
          return {
            date: item.date,
            close: value,
            open: value,
            high: value,
            low: value,
            volume: 0,
            change: 0,
            changePercent: 0,
          };
        });

      const withMas = attachMovingAverages(historicalData);

      return NextResponse.json({
        symbol,
        historical: withMas,
        count: withMas.length,
        source: 'FRED',
      });
    }

    // Prefer free Yahoo for equities; FMP only if Yahoo fails (or caller forces FMP).
    if (dataSource === 'FMP') {
      const fetchFrom = from
        ? addCalendarDays(from, -SMA_LOOKBACK_CALENDAR_DAYS)
        : from;
      const bars = attachMovingAverages(
        await fetchFmpHistoricalPrices(symbol, fetchFrom, to)
      );
      const filtered = filterByDateRange(bars, from, to);
      if (filtered.length === 0) {
        return NextResponse.json(
          { error: `No historical data available for symbol "${symbol}" in the selected date range` },
          { status: 404 }
        );
      }
      return NextResponse.json({
        symbol,
        historical: filtered,
        count: filtered.length,
        source: 'FMP',
      });
    }

    const { historical, source } = await fetchEquityHistoricalWithMas(symbol, from, to);
    console.log(
      `Fetched ${historical.length} days for ${symbol} via ${source} (with SMA30/SMA150)`
    );

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      historical,
      count: historical.length,
      source,
    });
  } catch (error: unknown) {
    const err = error as { message?: string; response?: { status?: number; data?: unknown } };
    console.error('Error fetching historical prices:', error);

    const message = err.message || 'Failed to fetch historical price data';
    const status =
      message.includes('402') || message.toLowerCase().includes('payment required')
        ? 402
        : message.toLowerCase().includes('no historical')
          ? 404
          : 500;

    return NextResponse.json(
      {
        error: message,
        details: err.message,
        symbol,
        hint:
          'Equity charts use free Yahoo Finance by default. FMP 402 means that paid plan/endpoint is gated — Yahoo should still work.',
      },
      { status: status === 402 ? 500 : status }
    );
  }
}
