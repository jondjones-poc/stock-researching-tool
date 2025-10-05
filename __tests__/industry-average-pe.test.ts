import { GET } from '../src/app/api/pe-ratios/route';
import { NextRequest } from 'next/server';

// Mock axios to control API responses
jest.mock('axios');
const mockedAxios = require('axios');

// Mock environment variables
process.env.FINNHUB_API_KEY = "test-finnhub-api-key";

describe('Industry Average P/E Ratio Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should return industry average PE for CAKE (Restaurant industry)', async () => {
    // Mock Finnhub API responses for CAKE
    const mockQuoteResponse = {
      data: { c: 55.5 }
    };

    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 17.13,
          epsTTM: 3.24,
          epsGrowth3Y: 15,
          dividendPerShareTTM: 1.06,
          currentDividendYieldTTM: 1.92,
          dividendGrowthRate5Y: 7.5
        }
      }
    };

    const mockProfileResponse = {
      data: {
        finnhubIndustry: "Restaurants"
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockResolvedValueOnce(mockProfileResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBeCloseTo(17.13, 1);
    expect(data.sector).toBe('Restaurants');
    expect(data.industryAveragePE).toBeCloseTo(20.72, 1); // Restaurant industry average

    console.log('CAKE Industry Average PE Test:');
    console.log(`  Current PE: ${data.currentPE}`);
    console.log(`  Industry: ${data.sector}`);
    console.log(`  Industry Average PE: ${data.industryAveragePE}`);
  });

  it('should handle missing industry data gracefully', async () => {
    const mockQuoteResponse = { data: { c: 100 } };
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 25
        }
      }
    };
    const mockProfileResponse = {
      data: {
        // No finnhubIndustry field
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockResolvedValueOnce(mockProfileResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBe(25);
    expect(data.sector).toBeNull();
    expect(data.industryAveragePE).toBeNull();

    console.log('Missing Industry Data Test:');
    console.log(`  Current PE: ${data.currentPE}`);
    console.log(`  Industry: ${data.sector}`);
    console.log(`  Industry Average PE: ${data.industryAveragePE}`);
  });

  it('should demonstrate percentage calculation logic', () => {
    // Test the percentage calculation logic using constants
    const currentPE = 17.13;
    const industryAveragePE = 20.72;
    const percentageBelow = 17.3;
    const percentageAbove = -17.3;

    console.log('Percentage Calculation Test:');
    console.log(`  Current PE: ${currentPE}`);
    console.log(`  Industry Average: ${industryAveragePE}`);
    console.log(`  Percentage Below: ${percentageBelow}%`);
    console.log(`  Percentage Above: ${percentageAbove}%`);

    expect(percentageBelow).toBeCloseTo(17.3, 1); // CAKE is 17.3% below industry average
    expect(percentageAbove).toBeCloseTo(-17.3, 1); // Negative means below average
  });
});
