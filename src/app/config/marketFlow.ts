/**
 * Global Market Flow Tracker — fund universe.
 * Edit symbols here (or via DB after seed) to change which ETFs are tracked.
 * Price momentum / leadership only — not confirmed investor cash flow.
 */

export type MarketFlowCapType = 'large' | 'small';

export type MarketFlowPeriod = '1w' | '1m' | '3m' | '6m' | '1y' | '3y' | '5y' | '10y';

export const MARKET_FLOW_PERIODS: MarketFlowPeriod[] = [
  '1w',
  '1m',
  '3m',
  '6m',
  '1y',
  '3y',
  '5y',
  '10y',
];

export const MARKET_FLOW_PERIOD_LABELS: Record<MarketFlowPeriod, string> = {
  '1w': '1 Week',
  '1m': '1 Month',
  '3m': '3 Months',
  '6m': '6 Months',
  '1y': '1 Year',
  '3y': '3 Years',
  '5y': '5 Years',
  '10y': '10 Years',
};

/** Approximate calendar days for return lookback (trading-day gaps handled at query time). */
export const MARKET_FLOW_PERIOD_DAYS: Record<MarketFlowPeriod, number> = {
  '1w': 7,
  '1m': 31,
  '3m': 93,
  '6m': 186,
  '1y': 372,
  '3y': 1096,
  '5y': 1827,
  '10y': 3653,
};

export interface MarketFlowFundSeed {
  capType: MarketFlowCapType;
  symbol: string;
  name: string;
  description: string;
}

export interface MarketFlowMarketSeed {
  slug: string;
  name: string;
  region: string;
  sortOrder: number;
  funds: [MarketFlowFundSeed, MarketFlowFundSeed];
}

/**
 * Ten major markets with liquid US-listed ETFs (reliable FMP history).
 * Swap any symbol without schema changes — update this seed + re-run apply, or PATCH via SQL.
 */
export const MARKET_FLOW_SEED: MarketFlowMarketSeed[] = [
  {
    slug: 'united-states',
    name: 'United States',
    region: 'Americas',
    sortOrder: 1,
    funds: [
      {
        capType: 'large',
        symbol: 'SPY',
        name: 'SPDR S&P 500 ETF',
        description: 'Large-cap US equities (S&P 500)',
      },
      {
        capType: 'small',
        symbol: 'IWM',
        name: 'iShares Russell 2000 ETF',
        description: 'Small-cap US equities (Russell 2000)',
      },
    ],
  },
  {
    slug: 'united-kingdom',
    name: 'United Kingdom',
    region: 'Europe',
    sortOrder: 2,
    funds: [
      {
        capType: 'large',
        symbol: 'EWU',
        name: 'iShares MSCI United Kingdom ETF',
        description: 'Large/mid-cap UK equities',
      },
      {
        capType: 'small',
        symbol: 'EWUS',
        name: 'iShares MSCI United Kingdom Small-Cap ETF',
        description: 'Small-cap UK equities',
      },
    ],
  },
  {
    slug: 'japan',
    name: 'Japan',
    region: 'Asia',
    sortOrder: 3,
    funds: [
      {
        capType: 'large',
        symbol: 'EWJ',
        name: 'iShares MSCI Japan ETF',
        description: 'Large/mid-cap Japanese equities',
      },
      {
        capType: 'small',
        symbol: 'SCJ',
        name: 'iShares MSCI Japan Small-Cap ETF',
        description: 'Small-cap Japanese equities',
      },
    ],
  },
  {
    slug: 'germany',
    name: 'Germany',
    region: 'Europe',
    sortOrder: 4,
    funds: [
      {
        capType: 'large',
        symbol: 'EWG',
        name: 'iShares MSCI Germany ETF',
        description: 'Large/mid-cap German equities',
      },
      {
        capType: 'small',
        symbol: 'FGM',
        name: 'First Trust Germany AlphaDEX ETF',
        description: 'German equities with smaller-cap tilt',
      },
    ],
  },
  {
    slug: 'france',
    name: 'France',
    region: 'Europe',
    sortOrder: 5,
    funds: [
      {
        capType: 'large',
        symbol: 'EWQ',
        name: 'iShares MSCI France ETF',
        description: 'Large/mid-cap French equities',
      },
      {
        capType: 'small',
        symbol: 'FLFR',
        name: 'Franklin FTSE France ETF',
        description: 'Broad French equity exposure (smaller AUM)',
      },
    ],
  },
  {
    slug: 'canada',
    name: 'Canada',
    region: 'Americas',
    sortOrder: 6,
    funds: [
      {
        capType: 'large',
        symbol: 'EWC',
        name: 'iShares MSCI Canada ETF',
        description: 'Large/mid-cap Canadian equities',
      },
      {
        capType: 'small',
        symbol: 'CNDA',
        name: 'IQ Canada Small Cap ETF',
        description: 'Small-cap Canadian equities',
      },
    ],
  },
  {
    slug: 'australia',
    name: 'Australia',
    region: 'Asia Pacific',
    sortOrder: 7,
    funds: [
      {
        capType: 'large',
        symbol: 'EWA',
        name: 'iShares MSCI Australia ETF',
        description: 'Large/mid-cap Australian equities',
      },
      {
        capType: 'small',
        symbol: 'KROO',
        name: 'IQ Australia Small Cap ETF',
        description: 'Small-cap Australian equities',
      },
    ],
  },
  {
    slug: 'china',
    name: 'China',
    region: 'Asia',
    sortOrder: 8,
    funds: [
      {
        capType: 'large',
        symbol: 'MCHI',
        name: 'iShares MSCI China ETF',
        description: 'Large/mid-cap Chinese equities',
      },
      {
        capType: 'small',
        symbol: 'ECNS',
        name: 'iShares MSCI China Small-Cap ETF',
        description: 'Small-cap Chinese equities',
      },
    ],
  },
  {
    slug: 'india',
    name: 'India',
    region: 'Asia',
    sortOrder: 9,
    funds: [
      {
        capType: 'large',
        symbol: 'INDA',
        name: 'iShares MSCI India ETF',
        description: 'Large/mid-cap Indian equities',
      },
      {
        capType: 'small',
        symbol: 'SMIN',
        name: 'iShares MSCI India Small-Cap ETF',
        description: 'Small-cap Indian equities',
      },
    ],
  },
  {
    slug: 'emerging-markets',
    name: 'Emerging Markets',
    region: 'Global',
    sortOrder: 10,
    funds: [
      {
        capType: 'large',
        symbol: 'EEM',
        name: 'iShares MSCI Emerging Markets ETF',
        description: 'Large/mid-cap emerging market equities',
      },
      {
        capType: 'small',
        symbol: 'EEMS',
        name: 'iShares MSCI Emerging Markets Small-Cap ETF',
        description: 'Small-cap emerging market equities',
      },
    ],
  },
];

export function isMarketFlowMockMode(): boolean {
  const v = process.env.MARKET_FLOW_MOCK?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Days after which cached prices are considered stale for UI warnings. */
export const MARKET_FLOW_STALE_DAYS = 3;
