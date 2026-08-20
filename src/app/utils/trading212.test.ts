import {
  parseRetryAfterMs,
  parseTrading212Position,
  researchSymbolFromTrading212Ticker,
  trading212PositionsError,
} from './trading212';

describe('researchSymbolFromTrading212Ticker', () => {
  it('strips market and instrument type', () => {
    expect(researchSymbolFromTrading212Ticker('KSPI_US_EQ')).toBe('KSPI');
    expect(researchSymbolFromTrading212Ticker('vod_uk_eq')).toBe('VOD');
    expect(researchSymbolFromTrading212Ticker('IWDA_EQ')).toBe('IWDA');
  });
});

describe('parseTrading212Position', () => {
  it('maps nested instrument payloads', () => {
    expect(
      parseTrading212Position({
        quantity: 0.68725638,
        averagePricePaid: 98.95,
        currentPrice: 100.2,
        instrument: { ticker: 'KSPI_US_EQ', name: 'Kaspi.KZ', currency: 'USD' },
      })
    ).toEqual({
      ticker: 'KSPI_US_EQ',
      symbol: 'KSPI',
      name: 'Kaspi.KZ',
      quantity: 0.68725638,
      averagePricePaid: 98.95,
      currentPrice: 100.2,
      instrumentCurrency: 'USD',
    });
  });
});

describe('parseRetryAfterMs', () => {
  it('uses Retry-After seconds within bounds', () => {
    expect(parseRetryAfterMs('2', 1200)).toBe(2000);
    expect(parseRetryAfterMs('0', 1200)).toBe(250);
    expect(parseRetryAfterMs('999', 1200)).toBe(15000);
  });

  it('falls back when the header is missing', () => {
    expect(parseRetryAfterMs(null, 1200)).toBe(1200);
  });
});

describe('trading212PositionsError', () => {
  it('explains rate limits without dumping the raw payload', () => {
    expect(trading212PositionsError(429, '{"code":"BusinessException"}').message).toMatch(
      /rate limit/i
    );
  });
});
