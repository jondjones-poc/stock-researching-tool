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
        name: 'Salesforce (CRM)',
        category: 'GROWTH',
        icon: '☁️',
        color: 'blue'
      },
      {
        symbol: 'AMD',
        name: 'Advanced Micro Devices (AMD)',
        category: 'GROWTH',
        icon: '💻',
        color: 'red'
      },
      {
        symbol: 'AMZN',
        name: 'Amazon (AMZN)',
        category: 'GROWTH',
        icon: '📦',
        color: 'orange'
      },
      {
        symbol: 'AAPL',
        name: 'Apple (AAPL)',
        category: 'GROWTH',
        icon: '🍎',
        color: 'gray'
      },
      {
        symbol: 'CELH',
        name: 'Celsius Holdings (CELH)',
        category: 'GROWTH',
        icon: '🥤',
        color: 'orange'
      },
      {
        symbol: 'ELF',
        name: 'e.l.f. Beauty (ELF)',
        category: 'GROWTH',
        icon: '💄',
        color: 'pink'
      },
      {
        symbol: 'SHOP',
        name: 'Shopify (SHOP)',
        category: 'GROWTH',
        icon: '🛍️',
        color: 'green'
      },
      {
        symbol: 'GOOGL',
        name: 'Alphabet (GOOGL)',
        category: 'GROWTH',
        icon: '🔍',
        color: 'blue'
      },
      {
        symbol: 'NVDA',
        name: 'NVIDIA (NVDA)',
        category: 'GROWTH',
        icon: '🎮',
        color: 'green'
      },
      {
        symbol: 'PYPL',
        name: 'PayPal (PYPL)',
        category: 'GROWTH',
        icon: '💳',
        color: 'blue'
      },
      {
        symbol: 'SOFI',
        name: 'SoFi Technologies (SOFI)',
        category: 'GROWTH',
        icon: '🏦',
        color: 'purple'
      },
      {
        symbol: 'PLTR',
        name: 'Palantir (PLTR)',
        category: 'GROWTH',
        icon: '🔮',
        color: 'purple'
      }
    ],
    'DIVIDEND & VALUE': [
      {
        symbol: 'EL',
        name: 'Estée Lauder (EL)',
        category: 'DIVIDEND & VALUE',
        icon: '✏️',
        color: 'purple'
      },
      {
        symbol: 'JPM',
        name: 'JPMorgan Chase (JPM)',
        category: 'DIVIDEND & VALUE',
        icon: '🏦',
        color: 'blue'
      },
      {
        symbol: 'MA',
        name: 'Mastercard (MA)',
        category: 'DIVIDEND & VALUE',
        icon: '💳',
        color: 'orange'
      },
      {
        symbol: 'NKE',
        name: 'Nike (NKE)',
        category: 'DIVIDEND & VALUE',
        icon: '✅',
        color: 'black'
      },
      {
        symbol: 'MSFT',
        name: 'Microsoft (MSFT)',
        category: 'DIVIDEND & VALUE',
        icon: '🪟',
        color: 'blue'
      },
      {
        symbol: 'TGT',
        name: 'Target (TGT)',
        category: 'DIVIDEND & VALUE',
        icon: '🎯',
        color: 'red'
      },
      {
        symbol: 'CAKE',
        name: 'Cheesecake Factory (CAKE)',
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
        name: '10-Year Treasury',
        category: 'MARKETS',
        icon: '🇺🇸',
        color: 'blue',
        dataSource: 'FRED',
        fredSeriesId: 'DGS10'
      },
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
        symbol: 'DXY',
        name: 'Dollar Index',
        category: 'MARKETS',
        icon: '💵',
        color: 'green',
        dataSource: 'FRED',
        fredSeriesId: 'DTWEXBGS'
      },
      {
        symbol: 'GLD',
        name: 'Gold Price (GLD)',
        category: 'MARKETS',
        icon: '🥇',
        color: 'yellow',
        dataSource: 'FMP'
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
