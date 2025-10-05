import { GET } from '../src/app/api/pe-ratios/route';
import { NextRequest } from 'next/server';
import axios from 'axios';

// Mock axios to control API responses
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment variables
process.env.FINNHUB_API_KEY = 'test_finnhub_api_key';

describe('Industry Average P/E Ratio Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockedAxios.get.mockReset();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });


  it('should return industry average PE for CAKE (Restaurants)', async () => {
    // Mock Finnhub API responses for CAKE
    const mockQuoteResponse = {
      data: { c: 55.5 }
    };

    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 17.13,
          epsTTM: 3.24,
          epsGrowth3Y: 15.0,
          dividendPerShareTTM: 1.06,
          currentDividendYieldTTM: 1.92,
          dividendGrowthRate5Y: 7.5
        }
      }
    };

    const mockProfileResponse = {
      data: {
        finnhubIndustry: 'Restaurants'
      }
    };

    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('quote')) return Promise.resolve(mockQuoteResponse);
      if (url.includes('metric')) return Promise.resolve(mockMetricsResponse);
      if (url.includes('profile2')) return Promise.resolve(mockProfileResponse);
      return Promise.reject(new Error('not found'));
    });



    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    console.log('CAKE Industry Average PE Test:');
    console.log(`  Current PE: ${data.currentPE}`);
    console.log(`  Industry: ${data.sector}`);
    console.log(`  Industry Average PE: ${data.industryAveragePE}`);

    expect(response.status).toBe(200);
    expect(data.currentPE).toBeCloseTo(17.13, 2);
    expect(data.sector).toBe('Restaurants');
    expect(data.industryAveragePE).toBeCloseTo(20.72, 1); // Restaurant industry average
  });



  it('should handle missing industry data gracefully', async () => {
    const mockQuoteResponse = {
      data: { c: 100.0 }
    };

    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 25.0
        }
      }
    };

    const mockProfileResponse = {
      data: {
        // No finnhubIndustry field
      }
    };

    mockedAxios.get.mockImplementation((url) => {
      if (url.includes('quote')) return Promise.resolve(mockQuoteResponse);
      if (url.includes('metric')) return Promise.resolve(mockMetricsResponse);
      if (url.includes('profile2')) return Promise.resolve(mockProfileResponse);
      return Promise.reject(new Error('not found'));
    });



    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    console.log('Missing Industry Data Test:');
    console.log(`  Current PE: ${data.currentPE}`);
    console.log(`  Industry: ${data.sector}`);
    console.log(`  Industry Average PE: ${data.industryAveragePE}`);

    expect(response.status).toBe(200);
    expect(data.currentPE).toBeCloseTo(25.0, 1);
    expect(data.sector).toBeNull();
    expect(data.industryAveragePE).toBeNull();
  });



  it('should calculate percentage difference correctly', () => {
    // Test the percentage calculation logic
    const currentPE = 17.13;
    const industryAveragePE = 20.72;
    
    const percentageBelow = ((industryAveragePE - currentPE) / industryAveragePE * 100).toFixed(1);
    const percentageAbove = ((currentPE - industryAveragePE) / industryAveragePE * 100).toFixed(1);
    
    console.log('Percentage Calculation Test:');
    console.log(`  Current PE: ${currentPE}`);
    console.log(`  Industry Average: ${industryAveragePE}`);
    console.log(`  Percentage Below: ${percentageBelow}%`);
    console.log(`  Percentage Above: ${percentageAbove}%`);
    
    expect(parseFloat(percentageBelow)).toBeCloseTo(17.3, 1); // CAKE is 17.3% below industry average
    expect(parseFloat(percentageAbove)).toBeCloseTo(-17.3, 1); // Negative means below average
  });


});
