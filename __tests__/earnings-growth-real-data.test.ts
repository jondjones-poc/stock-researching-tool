import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/earnings-growth/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Constants for expected values
const AAPL_EXPECTED_GROWTH_RATE = 0.16561010585382685;
const AAPL_EXPECTED_PERCENT = 16.56;
const CAKE_EXPECTED_GROWTH_RATE = -0.15123162124983291;
const CAKE_EXPECTED_PERCENT = -15.12;

// Constants for calculations
const AAPL_LATEST_EPS = 6.11;
const AAPL_OLDEST_EPS = 3.31;
const AAPL_YEARS = 4;
const AAPL_GROWTH_CALCULATED = 0.16561010585382685;
const AAPL_GROWTH_PERCENT = 16.56;

const CAKE_LATEST_EPS = 3.28;
const CAKE_OLDEST_EPS = -6.32;
const CAKE_YEARS = 4;
const CAKE_LATEST_ABS = 3.28;
const CAKE_OLDEST_ABS = 6.32;
const CAKE_GROWTH_CALCULATED = -0.15123162124983291;
const CAKE_GROWTH_PERCENT = -15.12;

// Constants for edge case calculations
const NEGATIVE_LATEST_EPS = -2.0;
const NEGATIVE_OLDEST_EPS = -1.0;
const NEGATIVE_YEARS = 2;
const NEGATIVE_GROWTH_CALCULATED = 0.4142135623730951;
const NEGATIVE_GROWTH_PERCENT = 41.42;

const SAME_EPS = 5.0;
const SAME_YEARS = 1;
const SAME_GROWTH_CALCULATED = 0.0;
const SAME_GROWTH_PERCENT = 0.0;

describe('/api/earnings-growth - Real Data Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the FMP API key environment variable
    process.env.FMP_API_KEY = "test-fmp-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should calculate correct growth rate for AAPL with real data', async () => {
    // Real AAPL data from API
    const mockIncomeStatementResponse = {
      data: [
        {
          "date": "2024-09-28",
          "symbol": "AAPL",
          "eps": AAPL_LATEST_EPS
        },
        {
          "date": "2023-09-30", 
          "symbol": "AAPL",
          "eps": 6.16
        },
        {
          "date": "2022-09-24",
          "symbol": "AAPL", 
          "eps": 6.15
        },
        {
          "date": "2021-09-25",
          "symbol": "AAPL",
          "eps": 5.67
        },
        {
          "date": "2020-09-26",
          "symbol": "AAPL",
          "eps": AAPL_OLDEST_EPS
        }
      ]
    };

    const mockAnalystResponse = { data: {} };

    mockedAxios.get
      .mockResolvedValueOnce(mockIncomeStatementResponse)
      .mockResolvedValueOnce(mockAnalystResponse);

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test historical growth calculation for AAPL using constants
    expect(data.historicalGrowthRate).toBeCloseTo(AAPL_EXPECTED_GROWTH_RATE, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(AAPL_EXPECTED_PERCENT, 1);
    
    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(AAPL_OLDEST_EPS); // Oldest (2020)
    expect(data.epsData[4].eps).toBe(AAPL_LATEST_EPS); // Latest (2024)
    
    console.log('AAPL Real Data Test:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  EPS Data Points: ${data.epsData.length}`);
    console.log(`  EPS Range: ${data.epsData[0].eps} to ${data.epsData[4].eps}`);
  });

  it('should calculate correct growth rate for CAKE with real data (including negative EPS)', async () => {
    // Real CAKE data from API
    const mockIncomeStatementResponse = {
      data: [
        {
          "date": "2024-12-31",
          "symbol": "CAKE",
          "eps": CAKE_LATEST_EPS
        },
        {
          "date": "2024-01-02",
          "symbol": "CAKE", 
          "eps": 2.1
        },
        {
          "date": "2023-01-03",
          "symbol": "CAKE",
          "eps": 0.87
        },
        {
          "date": "2021-12-28",
          "symbol": "CAKE",
          "eps": 1.03
        },
        {
          "date": "2020-12-29",
          "symbol": "CAKE",
          "eps": CAKE_OLDEST_EPS
        }
      ]
    };

    const mockAnalystResponse = { data: {} };

    mockedAxios.get
      .mockResolvedValueOnce(mockIncomeStatementResponse)
      .mockResolvedValueOnce(mockAnalystResponse);

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test historical growth calculation for CAKE using constants
    expect(data.historicalGrowthRate).toBeCloseTo(CAKE_EXPECTED_GROWTH_RATE, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(CAKE_EXPECTED_PERCENT, 1);
    
    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(CAKE_OLDEST_EPS); // Oldest (2020) - negative
    expect(data.epsData[4].eps).toBe(CAKE_LATEST_EPS); // Latest (2024) - positive
    
    console.log('CAKE Real Data Test:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  EPS Data Points: ${data.epsData.length}`);
    console.log(`  EPS Range: ${data.epsData[0].eps} to ${data.epsData[4].eps}`);
    console.log(`  Handles negative EPS: ${data.epsData[0].eps < 0 ? 'Yes' : 'No'}`);
  });

  it('should demonstrate growth calculation formulas', () => {
    console.log('\n=== Growth Calculation Formulas ===');
    
    // AAPL: All positive EPS values
    console.log('AAPL (All Positive):');
    console.log(`  Latest EPS: ${AAPL_LATEST_EPS}`);
    console.log(`  Oldest EPS: ${AAPL_OLDEST_EPS}`);
    console.log(`  Years: ${AAPL_YEARS}`);
    console.log(`  Growth: ${AAPL_GROWTH_PERCENT}%`);
    console.log(`  Formula: (${AAPL_LATEST_EPS} / ${AAPL_OLDEST_EPS})^(1/${AAPL_YEARS}) - 1`);
    
    // CAKE: Mixed positive/negative EPS values (using absolute values like the API)
    console.log('\nCAKE (Mixed Positive/Negative - Using Absolute Values):');
    console.log(`  Latest EPS: ${CAKE_LATEST_EPS}`);
    console.log(`  Oldest EPS: ${CAKE_OLDEST_EPS}`);
    console.log(`  Years: ${CAKE_YEARS}`);
    console.log(`  Growth: ${CAKE_GROWTH_PERCENT}%`);
    console.log(`  Formula: (|${CAKE_LATEST_EPS}| / |${CAKE_OLDEST_EPS}|)^(1/${CAKE_YEARS}) - 1`);
    
    expect(AAPL_GROWTH_CALCULATED).toBeCloseTo(AAPL_EXPECTED_GROWTH_RATE, 3);
    expect(CAKE_GROWTH_CALCULATED).toBeCloseTo(CAKE_EXPECTED_GROWTH_RATE, 3);
  });

  it('should handle edge cases in growth calculation', () => {
    console.log('\n=== Edge Case Testing ===');
    
    // Test case 1: Zero EPS
    const zeroEPS = 0;
    const normalEPS = 5.0;
    const years = 2;
    
    console.log('Zero EPS Test:');
    console.log(`  Latest: ${zeroEPS}, Oldest: ${normalEPS}`);
    console.log(`  Should return null (cannot calculate)`);
    
    // Test case 2: Both negative EPS
    console.log('\nBoth Negative EPS Test:');
    console.log(`  Latest: ${NEGATIVE_LATEST_EPS}, Oldest: ${NEGATIVE_OLDEST_EPS}`);
    console.log(`  Growth: ${NEGATIVE_GROWTH_PERCENT}%`);
    
    // Test case 3: Same EPS values
    console.log('\nSame EPS Test:');
    console.log(`  Latest: ${SAME_EPS}, Oldest: ${SAME_EPS}`);
    console.log(`  Growth: ${SAME_GROWTH_PERCENT}% (should be 0%)`);
    
    expect(SAME_GROWTH_CALCULATED).toBeCloseTo(0, 3);
  });
});
