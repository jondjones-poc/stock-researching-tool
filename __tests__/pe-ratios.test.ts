import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pe-ratios/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/pe-ratios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate PE ratios for ADBE (Adobe) using metrics endpoint', async () => {
    // Mock the quote response
    const mockQuoteResponse = {
      data: {
        c: 512.33 // Current price
      }
    };

    // Mock the metrics response
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 25.2 // Current PE ratio from metrics
        }
      }
    };

    // Mock the company profile response (empty to avoid earnings estimates)
    const mockProfileResponse = {
      data: {}
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)  // First call for quote
      .mockResolvedValueOnce(mockMetricsResponse) // Second call for metrics
      .mockResolvedValueOnce(mockProfileResponse); // Third call for company profile

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBe(25.2); // From metrics endpoint
    expect(data.currentPrice).toBe(512.33);
    expect(data.eps2026).toBeNull(); // No forward estimates available
    expect(data.forwardPE2Year).toBeNull();
  });

  it('should handle missing metrics data', async () => {
    const mockQuoteResponse = {
      data: {
        c: 100.00
      }
    };

    const mockMetricsResponse = {
      data: {
        metric: {} // Empty metrics
      }
    };

    // Mock the company profile response (empty)
    const mockProfileResponse = {
      data: {}
    };

    mockedAxios.get
      .mockResolvedValueOnce(mockQuoteResponse)
      .mockResolvedValueOnce(mockMetricsResponse)
      .mockResolvedValueOnce(mockProfileResponse);

    const request = new NextRequest('http://localhost:3000/api/pe-ratios?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.currentPE).toBeNull();
    expect(data.currentPrice).toBe(100.00);
    expect(data.eps2026).toBeNull();
    expect(data.forwardPE2Year).toBeNull();
  });

  it('should require symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/pe-ratios');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });
});
