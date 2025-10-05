import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pe-ratios/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Constants for forward PE calculations
const CURRENT_PRICE = 346.74;
const CURRENT_PE = 20.86;
const FORWARD_PE_METRICS = 16.68;
const EPS_2024 = 18.9;
const EPS_2025 = 20.3;
const EPS_2026 = 21.1;
const EXPECTED_FORWARD_PE_1_YEAR = 17.08;
const EXPECTED_FORWARD_PE_2_YEAR = 16.43;

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
        c: CURRENT_PRICE // Current price
      }
    };

    // Mock the metrics response
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: CURRENT_PE, // Current PE from metrics
          forwardPE: FORWARD_PE_METRICS // 1-year forward PE from metrics
        }
      }
    };

    // Mock the earnings estimates response (using the format you specified)
    const mockEstimatesResponse = {
      data: {
        symbol: "ADBE",
        estimates: [
          { "period": "2024-11-30", "epsAvg": EPS_2024 },
          { "period": "2025-11-30", "epsAvg": EPS_2025 },
          { "period": "2026-11-30", "epsAvg": EPS_2026 }
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
    expect(data.currentPE).toBe(CURRENT_PE);
    expect(data.currentPrice).toBe(CURRENT_PRICE);

    // Test 1-year forward PE calculation using constants
    expect(data.forwardPE1Year).toBeCloseTo(EXPECTED_FORWARD_PE_1_YEAR, 2);
    expect(data.eps2025).toBe(EPS_2025);

    // Test 2-year forward PE calculation using constants
    expect(data.forwardPE2Year).toBeCloseTo(EXPECTED_FORWARD_PE_2_YEAR, 2);
    expect(data.eps2026).toBe(EPS_2026);

    // Log the calculations for verification
    console.log(`1-Year Forward PE: ${data.currentPrice} / ${data.eps2025} = ${data.forwardPE1Year.toFixed(2)}x`);
    console.log(`2-Year Forward PE: ${data.currentPrice} / ${data.eps2026} = ${data.forwardPE2Year.toFixed(2)}x`);
  });

  it('should handle missing earnings estimates gracefully', async () => {
    const mockQuoteResponse = { data: { c: 100 } };
    const mockMetricsResponse = { data: { metric: { peTTM: 15 } } };
    const mockEstimatesResponse = { status: 404 }; // Simulate 404 error

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockRejectedValueOnce(mockEstimatesResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBe(15);
    expect(data.currentPrice).toBe(100);
    expect(data.forwardPE1Year).toBeNull();
    expect(data.forwardPE2Year).toBeNull();
  });

  it('should use metrics forward PE when estimates are not available', async () => {
    const mockQuoteResponse = { data: { c: 200 } };
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 25,
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
    expect(data.currentPE).toBe(25);
    expect(data.currentPrice).toBe(200);
    expect(data.forwardPE1Year).toBe(18.5); // From metrics
    expect(data.forwardPE2Year).toBeNull(); // No 2-year estimate available
  });
});
