import {
  aggregateEtoroPositions,
  displaySymbolFromEtoroTicker,
  isHoldingsCacheFresh,
} from './etoroLiveHoldings';

describe('displaySymbolFromEtoroTicker', () => {
  it('prefers research symbol and strips exchange suffixes', () => {
    expect(displaySymbolFromEtoroTicker('FB.US', 'META')).toBe('META');
    expect(displaySymbolFromEtoroTicker('AAPL.US')).toBe('AAPL');
    expect(displaySymbolFromEtoroTicker('KSPI')).toBe('KSPI');
  });
});

describe('aggregateEtoroPositions', () => {
  it('merges lots of the same instrument into one holding', () => {
    const holdings = aggregateEtoroPositions([
      {
        instrumentId: 1,
        ticker: 'AAPL.US',
        symbol: 'AAPL',
        shares: 2,
        avgBuyCost: 100,
        currentPrice: 180,
      },
      {
        instrumentId: 1,
        ticker: 'AAPL.US',
        symbol: 'AAPL',
        shares: 2,
        avgBuyCost: 140,
        currentPrice: 181,
      },
    ]);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].shares).toBe(4);
    expect(holdings[0].avgBuyCost).toBe(120);
    expect(holdings[0].symbol).toBe('AAPL');
  });
});

describe('isHoldingsCacheFresh', () => {
  it('treats cache within max age as fresh', () => {
    const now = 1_000_000;
    expect(isHoldingsCacheFresh(now - 1000, 5000, now)).toBe(true);
    expect(isHoldingsCacheFresh(now - 6000, 5000, now)).toBe(false);
  });
});
