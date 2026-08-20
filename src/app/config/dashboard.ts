// Dashboard configuration for watchlist symbols and layout
export type WatchlistCategory =
  | 'WATCHLIST'
  | 'GROWTH'
  | 'DIVIDEND & VALUE'
  | 'UNCATEGORIZED'
  | 'MARKETS'
  | 'PRECIOUS METALS';

export type CategoryFilter = 'ALL' | string;

export const UNCATEGORIZED_CATEGORY = 'UNCATEGORIZED' as const;

export const STATIC_DASHBOARD_CATEGORIES: WatchlistCategory[] = [
  'WATCHLIST',
  'MARKETS',
  'PRECIOUS METALS',
];

export const DEFAULT_PORTFOLIO_STYLE_CATEGORIES: Array<{
  slug: string;
  label: string;
  sort_order: number;
}> = [
  { slug: 'GROWTH', label: 'Growth', sort_order: 1 },
  { slug: 'DIVIDEND & VALUE', label: 'Dividend & Value', sort_order: 2 },
];

export const DASHBOARD_CATEGORY_ORDER: WatchlistCategory[] = [
  'WATCHLIST',
  'GROWTH',
  'DIVIDEND & VALUE',
  'UNCATEGORIZED',
  'MARKETS',
  'PRECIOUS METALS',
];

export const WATCHLIST_CATEGORY_LABELS: Record<WatchlistCategory, string> = {
  WATCHLIST: 'Watchlist',
  GROWTH: 'Growth',
  'DIVIDEND & VALUE': 'Dividend & Value',
  UNCATEGORIZED: 'Untagged',
  MARKETS: 'Markets',
  'PRECIOUS METALS': 'Precious Metals',
};

export function buildDashboardCategoryOrder(styleSlugs: string[]): string[] {
  const uniqueStyles = [...new Set(styleSlugs.map((slug) => slug.trim()).filter(Boolean))];
  return ['WATCHLIST', ...uniqueStyles, UNCATEGORIZED_CATEGORY, 'MARKETS', 'PRECIOUS METALS'];
}

export function dashboardCategoryLabel(
  category: string,
  styleLabels?: Record<string, string>
): string {
  if (styleLabels?.[category]) return styleLabels[category];
  return WATCHLIST_CATEGORY_LABELS[category as WatchlistCategory] || category;
}

export interface WatchlistSymbol {
  symbol: string;
  name: string;
  category: string;
  icon?: string;
  color?: string;
  dataSource?: 'FMP' | 'FRED'; // Which API to use for this symbol
  fredSeriesId?: string; // FRED series ID if using FRED API
}

export interface DashboardConfig {
  watchlist: {
    [category: string]: WatchlistSymbol[];
  };
  defaultSymbol: string;
  timePeriods: {
    value: string;
    label: string;
    days?: number;
  }[];
}

export const dashboardConfig: DashboardConfig = {
  watchlist: {
    GROWTH: [],
    'DIVIDEND & VALUE': [],
    UNCATEGORIZED: [],
    MARKETS: [
      {
        symbol: 'SPX',
        name: 'S&P 500',
        category: 'MARKETS',
        icon: '📊',
        color: 'green',
        dataSource: 'FRED',
        fredSeriesId: 'SP500'
      },
      {
        symbol: 'VIX',
        name: 'Volatility Index',
        category: 'MARKETS',
        icon: '📈',
        color: 'green',
        dataSource: 'FRED',
        fredSeriesId: 'VIXCLS'
      },
      {
        symbol: 'US10Y',
        name: '10-Year Treasury',
        category: 'MARKETS',
        icon: '🇺🇸',
        color: 'blue',
        dataSource: 'FRED',
        fredSeriesId: 'DGS10'
      },
      {
        symbol: 'DXY',
        name: 'Dollar Index',
        category: 'MARKETS',
        icon: '💵',
        color: 'green',
        dataSource: 'FRED',
        fredSeriesId: 'DTWEXBGS'
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        category: 'MARKETS',
        icon: '₿',
        color: 'orange',
        dataSource: 'FRED',
        fredSeriesId: 'CBBTCUSD'
      },
      {
        symbol: 'MORTGAGE30Y',
        name: '30-Year Mortgage Rate',
        category: 'MARKETS',
        icon: '🏠',
        color: 'orange',
        dataSource: 'FRED',
        fredSeriesId: 'MORTGAGE30US'
      },
      {
        symbol: 'SCHD',
        name: 'Schwab US Dividend Equity ETF',
        category: 'MARKETS',
        icon: '💰',
        color: 'blue',
        dataSource: 'FMP'
      },
      {
        symbol: 'WTI',
        name: 'West Texas Intermediate Crude Oil',
        category: 'MARKETS',
        icon: '🛢️',
        color: 'black',
        dataSource: 'FRED',
        fredSeriesId: 'DCOILWTICO'
      },
      {
        symbol: 'GREED',
        name: 'Fear & Greed Index',
        category: 'MARKETS',
        icon: '🎭',
        color: 'orange'
      },
      {
        symbol: 'AII',
        name: 'AAII Sentiment Survey',
        category: 'MARKETS',
        icon: '📊',
        color: 'blue'
      },
      {
        symbol: 'UMCSENT',
        name: 'University of Michigan Consumer Sentiment',
        category: 'MARKETS',
        icon: '🎓',
        color: 'blue',
        dataSource: 'FRED',
        fredSeriesId: 'UMCSENT'
      }
    ],
    'PRECIOUS METALS': [
      {
        symbol: 'GLD',
        name: 'Gold (GLD — spot bullion ETF)',
        category: 'PRECIOUS METALS',
        icon: '🥇',
        color: 'yellow',
        dataSource: 'FMP'
      },
      {
        symbol: 'GCUSD',
        name: 'Gold (COMEX futures, $/oz)',
        category: 'PRECIOUS METALS',
        icon: '🥇',
        color: 'yellow',
        dataSource: 'FMP'
      },
      {
        symbol: 'SIUSD',
        name: 'Silver (COMEX futures, $/oz)',
        category: 'PRECIOUS METALS',
        icon: '🥈',
        color: 'gray',
        dataSource: 'FMP'
      }
    ],
    WATCHLIST: [
      {
        symbol: 'VICI',
        name: 'VICI - VICI Properties Inc.',
        category: 'WATCHLIST',
        icon: '🏢',
        color: 'blue'
      },
      {
        symbol: 'TSLA',
        name: 'TSLA - Tesla Inc.',
        category: 'WATCHLIST',
        icon: '⚡',
        color: 'red'
      },
      {
        symbol: 'KO',
        name: 'Coca-Cola (KO)',
        category: 'WATCHLIST',
        icon: '🥤',
        color: 'red'
      }
    ]
  },
  defaultSymbol: 'VICI',
  timePeriods: [
    { value: 'ALL', label: 'ALL', days: undefined },
    { value: 'YTD', label: 'YTD', days: undefined },
    { value: '1Y', label: '1Y', days: 365 },
    { value: '9M', label: '9M', days: 270 },
    { value: '6M', label: '6M', days: 180 },
    { value: '3M', label: '3M', days: 90 },
    { value: '1M', label: '1M', days: 30 },
    { value: '5D', label: '5D', days: 5 }
  ]
};

// Static dashboard symbols only (Watchlist / Markets / Precious Metals).
export function getAllWatchlistSymbols(): WatchlistSymbol[] {
  return STATIC_DASHBOARD_CATEGORIES.flatMap(
    (category) => dashboardConfig.watchlist[category] || []
  );
}

// Helper function to get symbol by symbol string
export function getSymbolBySymbol(symbol: string): WatchlistSymbol | undefined {
  return getAllWatchlistSymbols().find(s => s.symbol === symbol);
}

/** Merge config symbols into DB-backed watchlist; config wins on category placement. */
export function mergeConfigSymbolsIntoWatchlistData(
  data: { [category: string]: WatchlistSymbol[] },
  dbSymbols: WatchlistSymbol[]
): { data: { [category: string]: WatchlistSymbol[] }; symbols: WatchlistSymbol[] } {
  const merged = { ...data };
  const configSymbols = getAllWatchlistSymbols();
  const configSymbolSet = new Set(configSymbols.map(s => s.symbol));

  for (const cfg of configSymbols) {
    for (const [category, symbols] of Object.entries(merged)) {
      if (category !== cfg.category) {
        merged[category] = symbols.filter(s => s.symbol !== cfg.symbol);
      }
    }
    if (!merged[cfg.category]) {
      merged[cfg.category] = [];
    }
    const existingIdx = merged[cfg.category].findIndex(s => s.symbol === cfg.symbol);
    if (existingIdx >= 0) {
      merged[cfg.category][existingIdx] = { ...merged[cfg.category][existingIdx], ...cfg };
    } else {
      merged[cfg.category] = [...merged[cfg.category], cfg];
    }
  }

  const missingFromDb = configSymbols.filter(
    cfg => !dbSymbols.some(s => s.symbol === cfg.symbol)
  );
  const symbols = [
    ...dbSymbols.filter(s => !configSymbolSet.has(s.symbol)),
    ...configSymbols,
  ];

  return { data: merged, symbols };
}

export function mergeMonthlyStocksIntoWatchlistData(
  data: { [category: string]: WatchlistSymbol[] },
  monthlySymbols: string[]
): { [category: string]: WatchlistSymbol[] } {
  const merged: { [category: string]: WatchlistSymbol[] } = {
    ...data,
    WATCHLIST: [...(data.WATCHLIST || [])],
  };
  const existing = new Set(
    merged.WATCHLIST.map((item) => item.symbol.trim().toUpperCase()).filter(Boolean)
  );

  for (const raw of monthlySymbols) {
    const symbol = String(raw || '').trim().toUpperCase();
    if (!symbol || existing.has(symbol)) continue;
    existing.add(symbol);
    merged.WATCHLIST.push({
      symbol,
      name: symbol,
      category: 'WATCHLIST',
      icon: '📌',
    });
  }

  return merged;
}

export function stripPortfolioDrivenCategories(
  data: { [category: string]: WatchlistSymbol[] },
  styleSlugs: string[] = DEFAULT_PORTFOLIO_STYLE_CATEGORIES.map((item) => item.slug)
): { [category: string]: WatchlistSymbol[] } {
  const stripped = { ...data };
  for (const slug of [...styleSlugs, UNCATEGORIZED_CATEGORY, 'GROWTH', 'DIVIDEND & VALUE']) {
    delete stripped[slug];
  }
  return stripped;
}

export function mergeEtoroHoldingsIntoWatchlistData(
  data: { [category: string]: WatchlistSymbol[] },
  holdings: Array<{ symbol: string; name?: string | null }>,
  tagsBySymbol: Record<string, string>,
  styleSlugs: string[] = DEFAULT_PORTFOLIO_STYLE_CATEGORIES.map((item) => item.slug)
): { [category: string]: WatchlistSymbol[] } {
  const reserved = new Set<string>();
  for (const category of ['MARKETS', 'PRECIOUS METALS'] as const) {
    for (const item of data[category] || []) {
      const symbol = String(item.symbol || '').trim().toUpperCase();
      if (symbol) reserved.add(symbol);
    }
  }

  const merged: { [category: string]: WatchlistSymbol[] } = { ...data };
  for (const slug of styleSlugs) {
    merged[slug] = [];
  }
  merged[UNCATEGORIZED_CATEGORY] = [];

  const seen = new Set<string>();
  for (const holding of holdings) {
    const symbol = String(holding.symbol || '').trim().toUpperCase();
    if (!symbol || seen.has(symbol) || reserved.has(symbol)) continue;
    if (symbol.startsWith('INSTRUMENT_') || symbol === 'UNKNOWN' || symbol === '—') continue;
    seen.add(symbol);

    const tag = String(tagsBySymbol[symbol] || '').trim();
    const category = tag && styleSlugs.includes(tag) ? tag : UNCATEGORIZED_CATEGORY;
    merged[category].push({
      symbol,
      name: String(holding.name || symbol),
      category,
      icon: category === UNCATEGORIZED_CATEGORY ? '🏷️' : '📌',
    });
  }

  return merged;
}
