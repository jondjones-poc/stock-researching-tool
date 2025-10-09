// Dashboard configuration for watchlist symbols and layout
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
    GROWTH: [
      {
        symbol: 'CRM',
        name: 'Salesforce',
        category: 'GROWTH',
        icon: '☁️',
        color: 'blue'
      }
    ],
    'DIVIDEND & VALUE': [
      {
        symbol: 'EL',
        name: 'Estee Lauder',
        category: 'DIVIDEND & VALUE',
        icon: '✏️',
        color: 'purple'
      },
      {
        symbol: 'JPM',
        name: 'JPMorgan Chase',
        category: 'DIVIDEND & VALUE',
        icon: '✏️',
        color: 'purple'
      },
      {
        symbol: 'MA',
        name: 'Mastercard',
        category: 'DIVIDEND & VALUE',
        icon: '🔴',
        color: 'red'
      },
      {
        symbol: 'NKE',
        name: 'Nike',
        category: 'DIVIDEND & VALUE',
        icon: '✅',
        color: 'green'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft',
        category: 'DIVIDEND & VALUE',
        icon: '⬜',
        color: 'blue'
      },
      {
        symbol: 'TGT',
        name: 'Target',
        category: 'DIVIDEND & VALUE',
        icon: '🎯',
        color: 'red'
      },
      {
        symbol: 'CAKE',
        name: 'Cheesecake Factory',
        category: 'DIVIDEND & VALUE',
        icon: '🍰',
        color: 'orange'
      }
    ],
    MARKETS: [
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
        name: 'US 10-Year Treasury',
        category: 'MARKETS',
        icon: '🇺🇸',
        color: 'blue',
        dataSource: 'FRED',
        fredSeriesId: 'DGS10'
      },
      {
        symbol: 'SCHD',
        name: 'Schwab Dividend ETF',
        category: 'MARKETS',
        icon: 'C',
        color: 'blue',
        dataSource: 'FMP'
      }
    ],
    WATCHLIST: [
      {
        symbol: 'VICI',
        name: 'VICI Properties',
        category: 'WATCHLIST',
        icon: 'V',
        color: 'white'
      },
      {
        symbol: 'TSLA',
        name: 'Tesla',
        category: 'WATCHLIST',
        icon: 'T',
        color: 'red'
      }
    ]
  },
  defaultSymbol: 'CRM',
  timePeriods: [
    { value: 'ALL', label: 'ALL', days: undefined },
    { value: 'YTD', label: 'YTD', days: undefined },
    { value: '1Y', label: '1Y', days: 365 },
    { value: '1M', label: '1M', days: 30 },
    { value: '5D', label: '5D', days: 5 }
  ]
};

// Helper function to get all watchlist symbols
export function getAllWatchlistSymbols(): WatchlistSymbol[] {
  return Object.values(dashboardConfig.watchlist).flat();
}

// Helper function to get symbol by symbol string
export function getSymbolBySymbol(symbol: string): WatchlistSymbol | undefined {
  return getAllWatchlistSymbols().find(s => s.symbol === symbol);
}
