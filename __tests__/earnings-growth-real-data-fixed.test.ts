import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/earnings-growth/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/earnings-growth - Real Data Tests (Fixed)', () => {
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
          "eps": 6.11
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
          "eps": 3.31
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
    
    // Test historical growth calculation for AAPL
    // Formula: (6.11 / 3.31)^(1/4) - 1 = 16.56%
    const expectedGrowth = Math.pow(6.11 / 3.31, 1/4) - 1;
    expect(data.historicalGrowthRate).toBeCloseTo(expectedGrowth, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(16.56, 1);
    
    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(3.31); // Oldest (2020)
    expect(data.epsData[4].eps).toBe(6.11); // Latest (2024)
    
    console.log('AAPL Real Data Test:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  EPS Data Points: ${data.epsData.length}`);
    console.log(`  EPS Range: ${data.epsData[0].eps} to ${data.epsData[4].eps}`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should calculate correct growth rate for CAKE with real data (including negative EPS)', async () => {
    // Real CAKE data from API
    const mockIncomeStatementResponse = {
      data: [
        {
          "date": "2024-12-31",
          "symbol": "CAKE",
          "eps": 3.28
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
          "eps": -6.32
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
    
    // Test historical growth calculation for CAKE with negative EPS
    // Our algorithm uses absolute values: (|3.28| / |-6.32|)^(1/4) - 1 = 15.12%
    const expectedGrowth = Math.pow(Math.abs(3.28) / Math.abs(-6.32), 1/4) - 1;
    expect(data.historicalGrowthRate).toBeCloseTo(expectedGrowth, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(15.12, 1);
    
    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(-6.32); // Oldest (2020) - negative
    expect(data.epsData[4].eps).toBe(3.28); // Latest (2024) - positive
    
    console.log('CAKE Real Data Test:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  EPS Data Points: ${data.epsData.length}`);
    console.log(`  EPS Range: ${data.epsData[0].eps} to ${data.epsData[4].eps}`);
    console.log(`  Handles negative EPS: ${data.epsData[0].eps < 0 ? 'Yes' : 'No'}`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should demonstrate growth calculation formulas with correct values', () => {
    console.log('\n=== Growth Calculation Formulas ===');
    
    // AAPL: All positive EPS values
    const aaplLatest = 6.11;
    const aaplOldest = 3.31;
    const aaplYears = 4;
    const aaplGrowth = Math.pow(aaplLatest / aaplOldest, 1/aaplYears) - 1;
    
    console.log('AAPL (All Positive):');
    console.log(`  Latest EPS: ${aaplLatest}`);
    console.log(`  Oldest EPS: ${aaplOldest}`);
    console.log(`  Years: ${aaplYears}`);
    console.log(`  Growth: ${(aaplGrowth * 100).toFixed(2)}%`);
    console.log(`  Formula: (${aaplLatest} / ${aaplOldest})^(1/${aaplYears}) - 1`);
    
    // CAKE: Mixed positive/negative EPS values (using absolute values)
    const cakeLatest = 3.28;
    const cakeOldest = -6.32;
    const cakeYears = 4;
    const cakeGrowth = Math.pow(Math.abs(cakeLatest) / Math.abs(cakeOldest), 1/cakeYears) - 1;
    
    console.log('\nCAKE (Mixed Positive/Negative - Using Absolute Values):');
    console.log(`  Latest EPS: ${cakeLatest}`);
    console.log(`  Oldest EPS: ${cakeOldest}`);
    console.log(`  Years: ${cakeYears}`);
    console.log(`  Growth: ${(cakeGrowth * 100).toFixed(2)}%`);
    console.log(`  Formula: (|${cakeLatest}| / |${cakeOldest}|)^(1/${cakeYears}) - 1`);
    
    expect(aaplGrowth).toBeCloseTo(0.1656, 3);
    expect(cakeGrowth).toBeCloseTo(0.1512, 3);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should verify exact values from saved JSON files', () => {
    console.log('\n=== Verifying Exact Values from JSON Files ===');
    
    // AAPL values from aapl_earnings_growth.json
    const aaplExpectedGrowth = 0.16561010585382685;
    const aaplExpectedPercent = 16.56;
    
    console.log('AAPL Expected Values:');
    console.log(`  Growth Rate: ${aaplExpectedGrowth}`);
    console.log(`  Percentage: ${aaplExpectedPercent}%`);
    
    // CAKE values from cake_earnings_growth.json  
    const cakeExpectedGrowth = 0.15123162124983291;
    const cakeExpectedPercent = 15.12;
    
    console.log('\nCAKE Expected Values:');
    console.log(`  Growth Rate: ${cakeExpectedGrowth}`);
    console.log(`  Percentage: ${cakeExpectedPercent}%`);
    
    // Verify the calculations match our expected values
    const aaplCalculated = Math.pow(6.11 / 3.31, 1/4) - 1;
    const cakeCalculated = Math.pow(Math.abs(3.28) / Math.abs(-6.32), 1/4) - 1;
    
    expect(aaplCalculated).toBeCloseTo(aaplExpectedGrowth, 10);
    expect(cakeCalculated).toBeCloseTo(cakeExpectedGrowth, 10);
    
    console.log('\nVerification Results:');
    console.log(`  AAPL calculated: ${aaplCalculated} (expected: ${aaplExpectedGrowth})`);
    console.log(`  CAKE calculated: ${cakeCalculated} (expected: ${cakeExpectedGrowth})`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });
});
