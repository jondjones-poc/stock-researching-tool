import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pe-ratios/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/pe-ratios - Forward PE Calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate 1-year and 2-year forward PE for ADBE using mock earnings estimates', async () => {
    // Mock the quote response
    const mockQuoteResponse = {
      data: {
        c: 346.74 // Current price
      }
    };

    // Mock the metrics response
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 20.86, // Current PE from metrics
          forwardPE: 16.68 // 1-year forward PE from metrics
        }
      }
    };

    // Mock the earnings estimates response (using the format you specified)
    const mockEstimatesResponse = {
      data: {
        symbol: "ADBE",
        estimates: [
          { "period": "2024-11-30", "epsAvg": 18.9 },
          { "period": "2025-11-30", "epsAvg": 20.3 },
          { "period": "2026-11-30", "epsAvg": 21.1 }
        ]
      }
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)  // First call for quote
      .mockResolvedValueOnce(mockMetricsResponse) // Second call for metrics
      .mockResolvedValueOnce(mockEstimatesResponse); // Third call for estimates

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test current PE
    expect(data.currentPE).toBe(20.86);
    expect(data.currentPrice).toBe(346.74);
    
    // Test 1-year forward PE calculation
    const expectedForwardPE1Year = 346.74 / 20.3; // Current price / EPS 2025
    expect(data.forwardPE1Year).toBeCloseTo(expectedForwardPE1Year, 2);
    expect(data.eps2025).toBe(20.3);
    
    // Test 2-year forward PE calculation
    const expectedForwardPE2Year = 346.74 / 21.1; // Current price / EPS 2026
    expect(data.forwardPE2Year).toBeCloseTo(expectedForwardPE2Year, 2);
    expect(data.eps2026).toBe(21.1);
    
    // Log the calculations for verification
    console.log(`1-Year Forward PE: ${data.currentPrice} / ${data.eps2025} = ${data.forwardPE1Year.toFixed(2)}x`);
    console.log(`2-Year Forward PE: ${data.currentPrice} / ${data.eps2026} = ${data.forwardPE2Year.toFixed(2)}x`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle missing earnings estimates gracefully', async () => {
    const mockQuoteResponse = { data: { c: 100.00 } };
    const mockMetricsResponse = { data: { metric: { peTTM: 15.0 } } };
    const mockEstimatesResponse = { status: 404 }; // Simulate 404 error

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockRejectedValueOnce(new Error('404 Not Found'));

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBe(15.0);
    expect(data.currentPrice).toBe(100.00);
    expect(data.forwardPE1Year).toBeNull();
    expect(data.forwardPE2Year).toBeNull();
    expect(data.eps2025).toBeNull();
    expect(data.eps2026).toBeNull();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should use metrics forwardPE when estimates are not available', async () => {
    const mockQuoteResponse = { data: { c: 200.00 } };
    const mockMetricsResponse = { 
      data: { 
        metric: { 
          peTTM: 25.0,
          forwardPE: 18.5 // This should be used for 1-year forward PE
        } 
      } 
    };
    const mockEstimatesResponse = { data: { estimates: [] } }; // Empty estimates

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockResolvedValueOnce(mockEstimatesResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBe(25.0);
    expect(data.forwardPE1Year).toBe(18.5); // From metrics
    expect(data.forwardPE2Year).toBeNull(); // No 2-year estimate available
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
});
