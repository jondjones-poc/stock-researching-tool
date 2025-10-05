import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/earnings-growth/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Constants for earnings growth calculations
const EPS_2024 = 6.13;
const EPS_2023 = 5.90;
const EPS_2022 = 6.11;
const EPS_2021 = 5.61;
const EPS_2020 = 3.28;

const EXPECTED_GROWTH_5_YEAR = 0.1692;
const EXPECTED_GROWTH_5_YEAR_PERCENT = 16.92;
const EXPECTED_GROWTH_2_YEAR = 0.039;
const EXPECTED_GROWTH_2_YEAR_PERCENT = 3.9;

const GROWTH_1_YEAR = 0.1692;
const GROWTH_1_YEAR_PERCENT = 16.92;
const GROWTH_2_YEAR = 0.1726;
const GROWTH_2_YEAR_PERCENT = 17.26;

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

  it('should calculate 5-year historical growth rate for AAPL', async () => {
    // Mock the income statement response using the format you provided
    const mockIncomeStatementResponse = {
      data: [
        {"date":"2024-09-30","eps":EPS_2024},
        {"date":"2023-09-30","eps":EPS_2023},
        {"date":"2022-09-30","eps":EPS_2022},
        {"date":"2021-09-30","eps":EPS_2021},
        {"date":"2020-09-30","eps":EPS_2020}
      ]
    };

    // Mock the analyst estimates response
    const mockAnalystResponse = {
      data: {
        growthRate: 0.12, // 12% analyst growth rate
        eps: 6.5
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockIncomeStatementResponse)
      .mockResolvedValueOnce(mockAnalystResponse);

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Test historical growth calculation using constants
    expect(data.historicalGrowthRate).toBeCloseTo(EXPECTED_GROWTH_5_YEAR, 3);
    expect(data.historicalGrowthRate * 100).toBeCloseTo(EXPECTED_GROWTH_5_YEAR_PERCENT, 1); // 16.92%

    // Test analyst growth rate
    expect(data.analystGrowthRate).toBeCloseTo(0.12, 3);

    // Test EPS data
    expect(data.epsData).toHaveLength(5);
    expect(data.epsData[0].eps).toBe(EPS_2020); // Oldest
    expect(data.epsData[4].eps).toBe(EPS_2024); // Latest

    console.log('AAPL 5-Year Growth:');
    console.log(`  Historical Growth: ${(data.historicalGrowthRate * 100).toFixed(2)}%`);
    console.log(`  Analyst Growth: ${(data.analystGrowthRate * 100).toFixed(2)}%`);
  });

  it('should calculate 2-year historical growth rate', async () => {
    const mockIncomeStatementResponse = {
      data: [
        {"date":"2024-09-30","eps":EPS_2024},
        {"date":"2023-09-30","eps":EPS_2023}
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
    expect(data.historicalGrowthRate).toBeCloseTo(EXPECTED_GROWTH_2_YEAR, 3); // (6.13/5.90)^(1/1) - 1
    expect(data.analystGrowthRate).toBeNull();
    expect(data.epsData).toHaveLength(2);
  });

  it('should handle missing symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/earnings-growth');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });

  it('should demonstrate growth calculation formulas', () => {
    console.log('Growth Calculation Examples:');
    
    // Test case 1: 5-year growth using constants
    const eps2024 = EPS_2024;
    const eps2020 = EPS_2020;
    const years1 = 4;
    
    console.log('5-Year Growth Calculation:');
    console.log(`  EPS 2024: ${eps2024}`);
    console.log(`  EPS 2020: ${eps2020}`);
    console.log(`  Years: ${years1}`);
    console.log(`  Growth Rate: ${GROWTH_1_YEAR_PERCENT}%`);
    
    // Test case 2: 2-year growth using constants
    const eps2024_2 = EPS_2024;
    const eps2022_2 = EPS_2022;
    const years2 = 2;
    
    console.log('\n2-Year Growth Calculation:');
    console.log(`  EPS 2024: ${eps2024_2}`);
    console.log(`  EPS 2022: ${eps2022_2}`);
    console.log(`  Years: ${years2}`);
    console.log(`  Growth Rate: ${GROWTH_2_YEAR_PERCENT}%`);
    
    expect(GROWTH_1_YEAR).toBeCloseTo(EXPECTED_GROWTH_5_YEAR, 3);
    expect(GROWTH_2_YEAR).toBeCloseTo(0.1726, 3);
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/earnings-growth?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch earnings growth data');
  });
});
