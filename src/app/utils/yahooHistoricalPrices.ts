import axios from 'axios';

export interface HistoricalPriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  sma30?: number | null;
  sma90?: number | null;
  /** @deprecated kept for older cached payloads */
  sma150?: number | null;
}

/** Extra calendar days before `from` so SMA90 can warm up. */
export const SMA_LOOKBACK_CALENDAR_DAYS = 180;

export function addCalendarDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeSma(
  closes: Array<number | null | undefined>,
  window: number
): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  let sum = 0;
  let count = 0;
  const ring: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (c === null || c === undefined || !Number.isFinite(c)) {
      out[i] = null;
      continue;
    }
    ring.push(c);
    sum += c;
    count += 1;
    if (ring.length > window) {
      sum -= ring.shift()!;
      count -= 1;
    }
    out[i] = count === window ? sum / window : null;
  }
  return out;
}

export function attachMovingAverages(bars: HistoricalPriceBar[]): HistoricalPriceBar[] {
  const closes = bars.map((b) => b.close);
  const sma30 = computeSma(closes, 30);
  const sma90 = computeSma(closes, 90);
  return bars.map((bar, i) => ({
    ...bar,
    sma30: sma30[i],
    sma90: sma90[i],
    sma150: null,
  }));
}

function toIsoDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}

function parseMoney(value: string | number | null | undefined): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (!value) return null;
  const n = Number(String(value).replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

function parseUsDateToIso(value: string): string | null {
  // Nasdaq: MM/DD/YYYY
  const m = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const mm = m[1].padStart(2, '0');
  const dd = m[2].padStart(2, '0');
  return `${m[3]}-${mm}-${dd}`;
}

function yahooRangeForSpan(from?: string | null, to?: string | null): string {
  const end = to ? Date.parse(`${to}T12:00:00Z`) : Date.now();
  const start = from ? Date.parse(`${from}T12:00:00Z`) : end - 365 * 24 * 3600 * 1000;
  const days = Math.max(1, Math.ceil((end - start) / (24 * 3600 * 1000)));
  if (days <= 7) return '5d';
  if (days <= 35) return '1mo';
  if (days <= 100) return '3mo';
  if (days <= 200) return '6mo';
  if (days <= 400) return '1y';
  if (days <= 800) return '2y';
  if (days <= 2000) return '5y';
  return '10y';
}

function barsFromYahooChartResult(result: {
  timestamp?: number[];
  indicators?: { quote?: Array<Record<string, Array<number | null>>> };
}): HistoricalPriceBar[] {
  if (!result?.timestamp?.length || !result?.indicators?.quote?.[0]) return [];

  const timestamps = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const bars: HistoricalPriceBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = closes[i];
    if (close === null || close === undefined || !Number.isFinite(close)) continue;
    const open = opens[i] ?? close;
    const high = highs[i] ?? close;
    const low = lows[i] ?? close;
    const volume = volumes[i] ?? 0;
    const prevClose = i > 0 && closes[i - 1] != null ? Number(closes[i - 1]) : close;
    const change = close - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    bars.push({
      date: toIsoDate(timestamps[i]),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume) || 0,
      change,
      changePercent,
    });
  }

  bars.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return bars;
}

/**
 * Free Nasdaq.com historical quote API — no API key.
 * Good primary source when Yahoo is rate-limited.
 */
export async function fetchNasdaqHistoricalPrices(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<HistoricalPriceBar[]> {
  const symbolUpper = symbol.toUpperCase();
  const toDate = to || new Date().toISOString().slice(0, 10);
  const fromDate = from || addCalendarDays(toDate, -365 * 5);

  const url =
    `https://api.nasdaq.com/api/quote/${encodeURIComponent(symbolUpper)}/historical` +
    `?assetclass=stocks&fromdate=${fromDate}&todate=${toDate}&limit=9999`;

  const response = await axios.get(url, {
    timeout: 20000,
    validateStatus: () => true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json, text/plain, */*',
      Origin: 'https://www.nasdaq.com',
      Referer: `https://www.nasdaq.com/market-activity/stocks/${symbolUpper.toLowerCase()}/historical`,
    },
  });

  if (response.status !== 200) {
    throw new Error(`Nasdaq returned status ${response.status}`);
  }

  const rows = response.data?.data?.tradesTable?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No Nasdaq historical rows for ${symbol}`);
  }

  const bars: HistoricalPriceBar[] = [];
  for (const row of rows) {
    const date = parseUsDateToIso(row.date);
    const close = parseMoney(row.close);
    if (!date || close === null) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const open = parseMoney(row.open) ?? close;
    const high = parseMoney(row.high) ?? close;
    const low = parseMoney(row.low) ?? close;
    const volume = parseMoney(row.volume) ?? 0;

    bars.push({
      date,
      open,
      high,
      low,
      close,
      volume,
      change: 0,
      changePercent: 0,
    });
  }

  bars.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = 0; i < bars.length; i++) {
    const prev = i > 0 ? bars[i - 1].close : bars[i].close;
    bars[i].change = bars[i].close - prev;
    bars[i].changePercent = prev !== 0 ? (bars[i].change / prev) * 100 : 0;
  }

  if (bars.length === 0) {
    throw new Error(`No Nasdaq bars for ${symbol} in range`);
  }
  return bars;
}

/**
 * Free Yahoo Finance chart API — no API key.
 * Prefers lightweight `range=` chart calls (avoids crumb/page hits that trigger 429s).
 */
export async function fetchYahooHistoricalPrices(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<HistoricalPriceBar[]> {
  const now = Math.floor(Date.now() / 1000);
  let period1: number;
  let period2: number = now;

  if (from) {
    const fromMs = Date.parse(`${from}T00:00:00Z`);
    period1 = Number.isFinite(fromMs) ? Math.floor(fromMs / 1000) : now - 365 * 24 * 3600;
  } else {
    period1 = now - 10 * 365 * 24 * 3600;
  }

  if (to) {
    const toMs = Date.parse(`${to}T23:59:59Z`);
    if (Number.isFinite(toMs)) period2 = Math.floor(toMs / 1000);
  }

  if (period2 <= period1) {
    period1 = period2 - 5 * 24 * 3600;
  }

  const symbolUpper = symbol.toUpperCase().replace(/\./g, '-');
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  const range = yahooRangeForSpan(from, to);
  let lastError = 'Yahoo Finance returned no data';

  const urls: string[] = [];
  for (const host of hosts) {
    urls.push(
      `https://${host}/v8/finance/chart/${encodeURIComponent(symbolUpper)}?interval=1d&range=${range}`
    );
  }
  for (const host of hosts) {
    urls.push(
      `https://${host}/v8/finance/chart/${encodeURIComponent(symbolUpper)}` +
        `?interval=1d&period1=${period1}&period2=${period2}&includePrePost=false&events=div%7Csplit`
    );
  }

  for (const url of urls) {
    const response = await axios.get(url, {
      timeout: 20000,
      validateStatus: () => true,
      headers: {
        'User-Agent': ua,
        Accept: 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (response.status === 429) {
      lastError = 'Yahoo Finance rate limited (429)';
      continue;
    }
    if (response.status !== 200) {
      lastError =
        `Yahoo Finance returned status ${response.status}` +
        (response.data?.chart?.error?.description
          ? `: ${response.data.chart.error.description}`
          : '');
      continue;
    }

    const result = response.data?.chart?.result?.[0];
    const error = response.data?.chart?.error;
    if (error) {
      lastError = error.description || 'Yahoo Finance chart error';
      continue;
    }

    let bars = barsFromYahooChartResult(result);
    if (bars.length === 0) {
      lastError = `No Yahoo historical bars for ${symbol}`;
      continue;
    }

    // Range endpoints can overshoot; trim if caller asked for a window.
    if (from || to) {
      bars = bars.filter((b) => {
        if (from && b.date < from) return false;
        if (to && b.date > to) return false;
        return true;
      });
    }

    if (bars.length === 0) {
      lastError = `No Yahoo bars for ${symbol} after date filter`;
      continue;
    }
    return bars;
  }

  throw new Error(lastError);
}

/**
 * Free Stooq daily CSV — no API key. Symbol form: CRM → crm.us
 */
export async function fetchStooqHistoricalPrices(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<HistoricalPriceBar[]> {
  const stooqSymbol = `${symbol.toLowerCase()}.us`;
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`;

  const response = await axios.get(url, {
    timeout: 20000,
    validateStatus: () => true,
    responseType: 'text',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (response.status !== 200 || typeof response.data !== 'string') {
    throw new Error(`Stooq returned status ${response.status}`);
  }

  const text = response.data.trim();
  if (!text || text.toLowerCase().startsWith('<!') || !text.includes('Date')) {
    throw new Error(`Stooq returned no CSV for ${symbol}`);
  }

  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) {
    throw new Error(`Stooq returned empty history for ${symbol}`);
  }

  const bars: HistoricalPriceBar[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, open, high, low, close, volume] = lines[i].split(',');
    const closeNum = Number(close);
    if (!date || !Number.isFinite(closeNum)) continue;
    if (from && date < from) continue;
    if (to && date > to) continue;

    const openNum = Number(open);
    const highNum = Number(high);
    const lowNum = Number(low);
    const volumeNum = Number(volume);
    const prevClose = bars.length > 0 ? bars[bars.length - 1].close : closeNum;
    const change = closeNum - prevClose;
    const changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;

    bars.push({
      date,
      open: Number.isFinite(openNum) ? openNum : closeNum,
      high: Number.isFinite(highNum) ? highNum : closeNum,
      low: Number.isFinite(lowNum) ? lowNum : closeNum,
      close: closeNum,
      volume: Number.isFinite(volumeNum) ? volumeNum : 0,
      change,
      changePercent,
    });
  }

  bars.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (bars.length === 0) {
    throw new Error(`No Stooq historical data for ${symbol}`);
  }
  return bars;
}

/**
 * Alpha Vantage daily series (free tier). Uses ALPHA_VANTAGE_API_KEY.
 */
export async function fetchAlphaVantageHistoricalPrices(
  symbol: string,
  from?: string | null,
  to?: string | null
): Promise<HistoricalPriceBar[]> {
  const apiKey =
    process.env.ALPHA_VANTAGE_API_KEY?.trim() || process.env.ALPHA_VANTAGE?.trim();
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY is not configured');
  }

  const url =
    `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY` +
    `&symbol=${encodeURIComponent(symbol.toUpperCase())}` +
    `&outputsize=full&apikey=${apiKey}`;

  const response = await axios.get(url, {
    timeout: 30000,
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(`Alpha Vantage returned status ${response.status}`);
  }

  const data = response.data;
  if (data?.Note || data?.Information) {
    throw new Error(data.Note || data.Information);
  }
  if (data?.['Error Message']) {
    throw new Error(data['Error Message']);
  }

  const series = data?.['Time Series (Daily)'];
  if (!series || typeof series !== 'object') {
    throw new Error(`No Alpha Vantage daily series for ${symbol}`);
  }

  const bars: HistoricalPriceBar[] = [];
  for (const [date, row] of Object.entries(series) as [string, Record<string, string>][]) {
    if (from && date < from) continue;
    if (to && date > to) continue;
    const close = Number(row['4. close']);
    if (!Number.isFinite(close)) continue;
    const open = Number(row['1. open']);
    const high = Number(row['2. high']);
    const low = Number(row['3. low']);
    const volume = Number(row['5. volume']);
    bars.push({
      date,
      open: Number.isFinite(open) ? open : close,
      high: Number.isFinite(high) ? high : close,
      low: Number.isFinite(low) ? low : close,
      close,
      volume: Number.isFinite(volume) ? volume : 0,
      change: 0,
      changePercent: 0,
    });
  }

  bars.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = 0; i < bars.length; i++) {
    const prev = i > 0 ? bars[i - 1].close : bars[i].close;
    bars[i].change = bars[i].close - prev;
    bars[i].changePercent = prev !== 0 ? (bars[i].change / prev) * 100 : 0;
  }

  if (bars.length === 0) {
    throw new Error(`No Alpha Vantage bars for ${symbol} in range`);
  }
  return bars;
}
