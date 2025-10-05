import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/earnings-growth/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/earnings-growth - Long-Term Earnings Growth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the FMP API key environment variable
    process.env.FMP_API_KEY = "test-fmp-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should calculate historical EPS growth for AAPL using real data format', async () => {
    // Mock the income statement response using the format you provided
    const mockIncomeStatementResponse = {
      data: [
        {"date":"2024-09-30","eps":6.13},
        {"date":"2023-09-30","eps":5.90},
        {"date":"2022-09-30","eps":6.11},
        {"date":"2021-09-30","eps":5.61},
        {"date":"2020-09-30","eps":3.28}
      ]
    };

    // Mock the analyst estimates response
    const mockAnalystResponse = {
      data: {
        growthRate: 0.12, // 12% analyst growth rate
        longTermGrowth: 0.15
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockIncomeStatementResponse)
      .mockResolvedValueOnce(mockAnalystResponse);

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test historical growth calculation
    // Formula: (6.13 / 3.28)^(1/4) - 1
    const expectedGrowth = Math.pow(6.13 / 3.28, 1/4) - 1;
    expect(data.historicalGrowthRate).toBeCloseTo(expectedGrowth, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(16.92, 1); // 16.92%
    
    // Test analyst growth rate
    expect(data.analystGrowthRate).toBe(0.12);
    
    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(3.28); // Oldest
    expect(data.epsData[4].eps).toBe(6.13); // Latest
    
    console.log('AAPL Earnings Growth Data:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  Analyst Growth: ${(data.analystGrowthRate * 100).toFixed(2)}%`);
    console.log(`  EPS Data Points: ${data.epsData.length}`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should handle missing analyst data gracefully', async () => {
    const mockIncomeStatementResponse = {
      data: [
        {"date":"2024-09-30","eps":6.13},
        {"date":"2023-09-30","eps":5.90}
      ]
    };

    const mockAnalystResponse = { data: {} }; // Empty analyst data

    mockedAxios.get
      .mockResolvedValueOnce(mockIncomeStatementResponse)
      .mockResolvedValueOnce(mockAnalystResponse);

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.historicalGrowthRate).toBeCloseTo(0.039, 3); // (6.13/5.90)^(1/1) - 1
    expect(data.analystGrowthRate).toBeNull();
    expect(data.epsData).toHaveLength(2);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch earnings growth data');
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should demonstrate EPS growth calculation with different scenarios', () => {
    // Test case 1: 5-year growth
    const eps2024 = 6.13;
    const eps2020 = 3.28;
    const years1 = 4;
    const growth1 = Math.pow(eps2024 / eps2020, 1/years1) - 1;
    
    console.log('5-Year Growth Calculation:');
    console.log(`  EPS 2024: ${eps2024}`);
    console.log(`  EPS 2020: ${eps2020}`);
    console.log(`  Years: ${years1}`);
    console.log(`  Growth Rate: ${(growth1 * 100).toFixed(2)}%`);
    
    expect(growth1).toBeCloseTo(0.1692, 3);
    
    // Test case 2: 2-year growth
    const eps2024_2 = 5.50;
    const eps2022_2 = 4.00;
    const years2 = 2;
    const growth2 = Math.pow(eps2024_2 / eps2022_2, 1/years2) - 1;
    
    console.log('\n2-Year Growth Calculation:');
    console.log(`  EPS 2024: ${eps2024_2}`);
    console.log(`  EPS 2022: ${eps2022_2}`);
    console.log(`  Years: ${years2}`);
    console.log(`  Growth Rate: ${(growth2 * 100).toFixed(2)}%`);
    
    expect(growth2).toBeCloseTo(0.1725, 3);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });

  it('should require symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/earnings-growth');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FMP_API_KEY;
  });
});
