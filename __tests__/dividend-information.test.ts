import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pe-ratios/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/pe-ratios - Dividend Information', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should show "Does Not Pay Dividend" for ADBE (no dividend data)', async () => {
    // Mock the quote response
    const mockQuoteResponse = {
      data: {
        c: 346.74 // Current price
      }
    };

    // Mock the metrics response with no dividend data (like ADBE)
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 20.86,
          epsTTM: 16.0461,
          epsGrowth3Y: 7.22,
          // No dividend fields - all null
          dividendPerShareTTM: null,
          currentDividendYieldTTM: null,
          dividendGrowthRate5Y: null
        }
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test dividend fields are null
    expect(data.dividendPerShare).toBeNull();
    expect(data.dividendYield).toBeNull();
    expect(data.dividendGrowthRate).toBeNull();
    
    console.log('ADBE dividend data:', {
      dividendPerShare: data.dividendPerShare,
      dividendYield: data.dividendYield,
      dividendGrowthRate: data.dividendGrowthRate
    });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should show dividend information for CAKE (pays dividends)', async () => {
    // Mock the quote response
    const mockQuoteResponse = {
      data: {
        c: 55.00 // Current price
      }
    };

    // Mock the metrics response with dividend data (like CAKE)
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 15.0,
          epsTTM: 3.67,
          epsGrowth3Y: 5.0,
          // CAKE dividend data
          dividendPerShareTTM: 1.0559,
          currentDividendYieldTTM: 1.9229,
          dividendGrowthRate5Y: 7.51
        }
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test dividend fields are populated
    expect(data.dividendPerShare).toBe(1.0559);
    expect(data.dividendYield).toBe(1.9229);
    expect(data.dividendGrowthRate).toBe(7.51);
    
    console.log('CAKE dividend data:', {
      dividendPerShare: data.dividendPerShare,
      dividendYield: data.dividendYield,
      dividendGrowthRate: data.dividendGrowthRate
    });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle partial dividend data gracefully', async () => {
    const mockQuoteResponse = { data: { c: 100.00 } };
    const mockMetricsResponse = { 
      data: { 
        metric: { 
          peTTM: 20.0,
          epsTTM: 5.0,
          // Only some dividend fields available
          dividendPerShareTTM: 2.0,
          currentDividendYieldTTM: null, // Missing
          dividendGrowthRate5Y: 5.0
        } 
      } 
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.dividendPerShare).toBe(2.0);
    expect(data.dividendYield).toBeNull();
    expect(data.dividendGrowthRate).toBe(5.0);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should demonstrate dividend yield calculation', () => {
    const dividendPerShare = 1.0559;
    const currentPrice = 55.00;
    const expectedYield = (dividendPerShare / currentPrice) * 100;
    
    console.log(`Dividend Yield Calculation:`);
    console.log(`  Dividend per share: $${dividendPerShare}`);
    console.log(`  Current price: $${currentPrice}`);
    console.log(`  Yield: (${dividendPerShare} / ${currentPrice}) * 100 = ${expectedYield.toFixed(2)}%`);
    
    expect(expectedYield).toBeCloseTo(1.92, 2);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
});
