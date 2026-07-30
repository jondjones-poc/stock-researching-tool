import {
  MARKET_FLOW_PERIOD_DAYS,
  MARKET_FLOW_SEED,
  MARKET_FLOW_PERIODS,
} from '../src/app/config/marketFlow';
import { computeReturnPct, normalizeSeriesTo100, buildNormalizedComparison } from '../src/app/utils/marketFlowReturns';
import { generateMockEod } from '../src/app/utils/marketFlowFetch';
import { capRelativeSpread, formatPct, heatClass, lcScSpreadTooltip } from '../src/app/utils/marketFlowFormat';

describe('market flow config', () => {
  test('seeds ten markets with large and small funds', () => {
    expect(MARKET_FLOW_SEED).toHaveLength(10);
    for (const m of MARKET_FLOW_SEED) {
      expect(m.funds).toHaveLength(2);
      expect(m.funds.map((f) => f.capType).sort()).toEqual(['large', 'small']);
      expect(m.slug).toBeTruthy();
      expect(m.funds[0].symbol).toMatch(/^[A-Z.]+$/i);
    }
  });

  test('has eight return periods including multi-year', () => {
    expect(MARKET_FLOW_PERIODS).toEqual(['1w', '1m', '3m', '6m', '1y', '3y', '5y', '10y']);
    expect(Object.keys(MARKET_FLOW_PERIOD_DAYS)).toHaveLength(8);
  });
});

describe('market flow returns math', () => {
  test('computeReturnPct', () => {
    expect(computeReturnPct(100, 110)).toBeCloseTo(10);
    expect(computeReturnPct(100, 90)).toBeCloseTo(-10);
    expect(Number.isNaN(computeReturnPct(0, 10))).toBe(true);
  });

  test('normalizeSeriesTo100', () => {
    const out = normalizeSeriesTo100([
      { date: '2024-01-01', close: 50 },
      { date: '2024-01-02', close: 55 },
    ]);
    expect(out[0].value).toBeCloseTo(100);
    expect(out[1].value).toBeCloseTo(110);
  });

  test('buildNormalizedComparison aligns shared dates', () => {
    const large = [
      { date: '2024-01-01', close: 100 },
      { date: '2024-01-02', close: 110 },
      { date: '2024-01-03', close: 120 },
    ];
    const small = [
      { date: '2024-01-02', close: 200 },
      { date: '2024-01-03', close: 180 },
    ];
    const cmp = buildNormalizedComparison(large, small);
    expect(cmp[0].date).toBe('2024-01-02');
    expect(cmp[0].large).toBeCloseTo(100);
    expect(cmp[0].small).toBeCloseTo(100);
    expect(cmp[1].large).toBeCloseTo((120 / 110) * 100);
    expect(cmp[1].small).toBeCloseTo(90);
  });
});

describe('mock EOD', () => {
  test('generates weekday bars only', () => {
    const bars = generateMockEod('SPY', '2024-01-01', '2024-01-14');
    expect(bars.length).toBeGreaterThan(5);
    for (const b of bars) {
      const dow = new Date(`${b.date}T12:00:00Z`).getUTCDay();
      expect(dow).not.toBe(0);
      expect(dow).not.toBe(6);
      expect(b.close).toBeGreaterThan(0);
    }
  });

  test('is deterministic per symbol', () => {
    const a = generateMockEod('SPY', '2024-06-01', '2024-06-30');
    const b = generateMockEod('SPY', '2024-06-01', '2024-06-30');
    expect(a).toEqual(b);
    const c = generateMockEod('IWM', '2024-06-01', '2024-06-30');
    expect(c[c.length - 1].close).not.toEqual(a[a.length - 1].close);
  });
});

describe('format helpers', () => {
  test('formatPct', () => {
    expect(formatPct(1.234)).toBe('+1.23%');
    expect(formatPct(-2)).toBe('-2.00%');
    expect(formatPct(null)).toBe('—');
  });

  test('heatClass uses green/red', () => {
    expect(heatClass(5)).toContain('green');
    expect(heatClass(-5)).toContain('red');
    expect(heatClass(null)).toContain('gray');
  });

  test('cap-relative spread flips by card type', () => {
    expect(capRelativeSpread('large', 31.46).label).toBe('vs Small-cap +31.46%');
    expect(capRelativeSpread('small', 31.46).label).toBe('vs Large-cap -31.46%');
    expect(lcScSpreadTooltip(3, 'large').title).toContain('Ahead of small-cap');
    expect(lcScSpreadTooltip(3, 'small').title).toContain('Behind large-cap');
    expect(lcScSpreadTooltip(0.2, 'large').title).toContain('Almost even');
  });
});

describe('market flow ask-ai prompt', () => {
  test('includes market, ETF, and investability sections', () => {
    const { buildMarketFlowAskAiPrompt } = require('../src/app/utils/buildMarketFlowAskAiPrompt');
    const prompt = buildMarketFlowAskAiPrompt({
      slug: 'france',
      market: 'France',
      region: 'Europe',
      capType: 'large',
      symbol: 'EWQ',
      fundName: 'iShares MSCI France ETF',
      returnPct: 12.5,
      relativeToSpy: 8.5,
      spyReturn: 4.0,
      spread: 4.3,
      price: 42.1,
      leader: true,
      holdings: [
        { symbol: 'MC', name: 'LVMH', weightPct: 12, rank: 1 },
        { symbol: 'TTE', name: 'TotalEnergies', weightPct: 8.5, rank: 2 },
      ],
      peer: {
        symbol: 'FLFR',
        fundName: 'Franklin FTSE France ETF',
        returnPct: 8.2,
        relativeToSpy: 4.2,
        leader: false,
      },
      context: {
        period: '1m',
        lastUpdated: '2026-07-29T12:00:00Z',
        strongestLarge: 'France (+12.50%)',
        strongestSmall: 'China (+9.00%)',
        bestMarket: 'France (+10.00%)',
        worstMarket: 'United Kingdom (+1.00%)',
      },
    });
    expect(prompt).toContain('France');
    expect(prompt).toContain('EWQ');
    expect(prompt).toContain('Stocks pushing it');
    expect(prompt).toContain('Invest or pass?');
    expect(prompt).toContain('FLFR');
    expect(prompt).toContain('vs SPY');
    expect(prompt).toContain('LVMH');
    expect(prompt).toContain('CACHED TOP HOLDINGS');
  });
});
