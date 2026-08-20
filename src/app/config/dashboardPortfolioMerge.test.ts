import {
  mergeEtoroHoldingsIntoWatchlistData,
  stripPortfolioDrivenCategories,
  buildDashboardCategoryOrder,
  UNCATEGORIZED_CATEGORY,
} from './dashboard';

describe('dashboard portfolio style merge', () => {
  it('builds category order with style buckets before untagged', () => {
    expect(
      buildDashboardCategoryOrder(['GROWTH', 'DIVIDEND & VALUE'])
    ).toEqual([
      'WATCHLIST',
      'GROWTH',
      'DIVIDEND & VALUE',
      'UNCATEGORIZED',
      'MARKETS',
      'PRECIOUS METALS',
    ]);
  });

  it('places tagged holdings and leaves untagged in Uncategorized', () => {
    const merged = mergeEtoroHoldingsIntoWatchlistData(
      {
        WATCHLIST: [{ symbol: 'KO', name: 'Coca-Cola', category: 'WATCHLIST' }],
        MARKETS: [{ symbol: 'SPX', name: 'S&P 500', category: 'MARKETS' }],
        'PRECIOUS METALS': [{ symbol: 'GLD', name: 'Gold', category: 'PRECIOUS METALS' }],
      },
      [
        { symbol: 'NVDA', name: 'NVIDIA' },
        { symbol: 'MSFT', name: 'Microsoft' },
        { symbol: 'GLD', name: 'Gold ETF' },
        { symbol: 'INSTRUMENT_1003', name: 'Unknown' },
        { symbol: 'KO', name: 'Coca-Cola' },
      ],
      {
        NVDA: 'GROWTH',
        MSFT: 'DIVIDEND & VALUE',
      }
    );

    expect(merged.GROWTH.map((item) => item.symbol)).toEqual(['NVDA']);
    expect(merged['DIVIDEND & VALUE'].map((item) => item.symbol)).toEqual(['MSFT']);
    expect(merged[UNCATEGORIZED_CATEGORY].map((item) => item.symbol)).toEqual(['KO']);
    expect(merged.GROWTH.find((item) => item.symbol === 'GLD')).toBeUndefined();
    expect(merged[UNCATEGORIZED_CATEGORY].find((item) => item.symbol === 'GLD')).toBeUndefined();
  });

  it('strips old dashboard growth/dividend rows before merge', () => {
    const stripped = stripPortfolioDrivenCategories({
      GROWTH: [{ symbol: 'CRM', name: 'Salesforce', category: 'GROWTH' }],
      'DIVIDEND & VALUE': [{ symbol: 'JPM', name: 'JPMorgan', category: 'DIVIDEND & VALUE' }],
      MARKETS: [{ symbol: 'SPX', name: 'S&P 500', category: 'MARKETS' }],
    });
    expect(stripped.GROWTH).toBeUndefined();
    expect(stripped['DIVIDEND & VALUE']).toBeUndefined();
    expect(stripped.MARKETS).toHaveLength(1);
  });
});
