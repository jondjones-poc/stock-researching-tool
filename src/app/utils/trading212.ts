export function researchSymbolFromTrading212Ticker(ticker: string): string {
  const trimmed = ticker.trim().toUpperCase();
  if (!trimmed) return '';

  const withMarket = trimmed.match(/^(.*)_[A-Z]{2}_(EQ|ETF|FUND|BOND)$/);
  if (withMarket) return withMarket[1];

  const withType = trimmed.match(/^(.*)_(EQ|ETF|FUND|BOND)$/);
  if (withType) return withType[1];

  return trimmed;
}

export type Trading212OpenPosition = {
  ticker: string;
  symbol: string;
  name: string | null;
  quantity: number;
  averagePricePaid: number;
  currentPrice: number | null;
  instrumentCurrency: string | null;
};

type Trading212PositionPayload = {
  ticker?: string;
  quantity?: number;
  averagePricePaid?: number;
  averagePrice?: number;
  currentPrice?: number;
  instrument?: {
    ticker?: string;
    name?: string;
    currency?: string;
    currencyCode?: string;
  };
};

export function parseTrading212Position(raw: Trading212PositionPayload): Trading212OpenPosition | null {
  const ticker = String(raw.instrument?.ticker || raw.ticker || '').trim();
  const quantity = Number(raw.quantity);
  const averagePricePaid = Number(raw.averagePricePaid ?? raw.averagePrice);
  if (!ticker || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(averagePricePaid) || averagePricePaid < 0) return null;

  const currentPrice = Number(raw.currentPrice);
  return {
    ticker,
    symbol: researchSymbolFromTrading212Ticker(ticker),
    name: raw.instrument?.name?.trim() || null,
    quantity,
    averagePricePaid,
    currentPrice: Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : null,
    instrumentCurrency: raw.instrument?.currency || raw.instrument?.currencyCode || null,
  };
}

function trading212Credentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.TRADE_ID?.trim() || '';
  const apiSecret = process.env.TRADE_KEY?.trim() || '';
  if (!apiKey || !apiSecret) {
    throw new Error('TRADE_ID and TRADE_KEY must be set to load Trading 212 holdings');
  }
  return { apiKey, apiSecret };
}

export function trading212BaseUrl(): string {
  const configured = process.env.TRADE_212_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const env = process.env.TRADE_212_ENV?.trim().toLowerCase();
  if (env === 'demo') return 'https://demo.trading212.com';
  return 'https://live.trading212.com';
}

const POSITIONS_CACHE_TTL_MS = 45_000;
const POSITIONS_RETRY_DELAYS_MS = [1_200, 2_000, 3_500];

let positionsCache: { fetchedAt: number; positions: Trading212OpenPosition[] } | null = null;
let positionsInFlight: Promise<Trading212OpenPosition[]> | null = null;

export function parseRetryAfterMs(header: string | null, fallbackMs: number): number {
  if (!header) return fallbackMs;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.max(seconds * 1000, 250), 15_000);
  }
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    return Math.min(Math.max(dateMs - Date.now(), 250), 15_000);
  }
  return fallbackMs;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function trading212Fetch(path: string): Promise<Response> {
  const { apiKey, apiSecret } = trading212Credentials();
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  return fetch(`${trading212BaseUrl()}${path}`, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export function trading212PositionsError(status: number, details: string): Error {
  if (status === 401) {
    return new Error('Trading 212 rejected TRADE_ID / TRADE_KEY');
  }
  if (status === 403) {
    return new Error(
      'Trading 212 API key is missing the Portfolio permission. Enable Portfolio under Settings → API (Beta), then restart the app.'
    );
  }
  if (status === 429) {
    return new Error(
      'Trading 212 rate limit reached (1 request per second). Wait a moment and reload.'
    );
  }
  return new Error(
    `Trading 212 positions failed (${status})${details ? `: ${details.slice(0, 180)}` : ''}`
  );
}

async function fetchTrading212OpenPositionsUncached(): Promise<Trading212OpenPosition[]> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= POSITIONS_RETRY_DELAYS_MS.length; attempt += 1) {
    const response = await trading212Fetch('/api/v0/equity/positions');

    if (response.ok) {
      const payload = (await response.json()) as unknown;
      const rows = Array.isArray(payload) ? payload : [];
      return rows
        .map((row) => parseTrading212Position(row as Trading212PositionPayload))
        .filter((row): row is Trading212OpenPosition => row != null)
        .sort((a, b) => a.symbol.localeCompare(b.symbol));
    }

    const details = await response.text().catch(() => '');
    lastError = trading212PositionsError(response.status, details);

    if (response.status !== 429 || attempt === POSITIONS_RETRY_DELAYS_MS.length) {
      throw lastError;
    }

    const waitMs = parseRetryAfterMs(
      response.headers.get('retry-after'),
      POSITIONS_RETRY_DELAYS_MS[attempt]
    );
    await sleep(waitMs);
  }

  throw lastError ?? new Error('Trading 212 positions failed');
}

export async function fetchTrading212OpenPositions(
  options?: { force?: boolean }
): Promise<Trading212OpenPosition[]> {
  const now = Date.now();
  if (
    !options?.force &&
    positionsCache &&
    now - positionsCache.fetchedAt < POSITIONS_CACHE_TTL_MS
  ) {
    return positionsCache.positions;
  }

  if (positionsInFlight) {
    return positionsInFlight;
  }

  positionsInFlight = fetchTrading212OpenPositionsUncached()
    .then((positions) => {
      positionsCache = { fetchedAt: Date.now(), positions };
      return positions;
    })
    .finally(() => {
      positionsInFlight = null;
    });

  return positionsInFlight;
}
