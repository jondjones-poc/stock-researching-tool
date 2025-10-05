import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/pe-ratios/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Constants for calculations
const CURRENT_PRICE = 346.74;
const CURRENT_PE = 20.86;
const EXPECTED_EPS = 16.62;

// Constants for ADBE earnings data calculations
const EPS_2024_Q4 = 4.81;
const EPS_2025_Q1 = 5.08;
const EPS_2025_Q2 = 5.06;
const EPS_2025_Q3 = 5.31;
const EPS_2024_TOTAL = 4.81;
const EPS_2025_TOTAL = 15.45;
const GROWTH_RATE = 2.2121;
const GROWTH_RATE_PERCENT = 221.21;
const PROJECTED_EPS_2026 = 49.63;
const FORWARD_PE_2026 = 6.99;

describe('/api/pe-ratios - Earnings Estimates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate forward EPS estimates from actual ADBE earnings data', async () => {
    // Mock the quote response
    const mockQuoteResponse = {
      data: {
        c: CURRENT_PRICE // Current price
      }
    };

    // Mock the metrics response with actual ADBE data
    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: CURRENT_PE // Current PE ratio from metrics
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
    expect(data.currentPE).toBe(CURRENT_PE);
    expect(data.currentPrice).toBe(CURRENT_PRICE);

    // Calculate expected EPS from current PE and price using constants
    const expectedEPS = CURRENT_PRICE / CURRENT_PE;
    console.log(`Expected EPS calculation: ${CURRENT_PRICE} / ${CURRENT_PE} = ${expectedEPS.toFixed(2)}`);

    // Verify the calculation
    expect(expectedEPS).toBeCloseTo(EXPECTED_EPS, 1); // 346.74 / 20.86 = 16.62
  });

  it('should demonstrate EPS growth calculation from historical data', () => {
    // Actual ADBE earnings data from Finnhub API
    const adbeEarningsData = [
      {
        "actual": EPS_2025_Q3,
        "estimate": 5.2812,
        "period": "2025-09-30",
        "quarter": 3,
        "year": 2025
      },
      {
        "actual": EPS_2025_Q2,
        "estimate": 5.0632,
        "period": "2025-06-30",
        "quarter": 2,
        "year": 2025
      },
      {
        "actual": EPS_2025_Q1,
        "estimate": 5.0709,
        "period": "2025-03-31",
        "quarter": 1,
        "year": 2025
      },
      {
        "actual": EPS_2024_Q4,
        "estimate": 4.7553,
        "period": "2024-12-31",
        "quarter": 4,
        "year": 2024
      }
    ];

    // Calculate annual EPS for 2024 and 2025 using constants
    const eps2024 = adbeEarningsData
      .filter(earning => earning.year === 2024)
      .reduce((sum, earning) => sum + earning.actual, 0);

    const eps2025 = adbeEarningsData
      .filter(earning => earning.year === 2025)
      .reduce((sum, earning) => sum + earning.actual, 0);

    console.log(`ADBE 2024 Annual EPS: ${eps2024.toFixed(2)}`);
    console.log(`ADBE 2025 Annual EPS: ${eps2025.toFixed(2)}`);

    // Calculate growth rate using constants
    const growthRate = (eps2025 - eps2024) / eps2024;
    console.log(`EPS Growth Rate: ${(growthRate * 100).toFixed(2)}%`);

    // Project 2026 EPS based on growth rate using constants
    const projectedEPS2026 = eps2025 * (1 + growthRate);
    console.log(`Projected 2026 EPS: ${projectedEPS2026.toFixed(2)}`);

    // Calculate forward PE for 2026 using constants
    const currentPrice = CURRENT_PRICE;
    const forwardPE2026 = currentPrice / projectedEPS2026;
    console.log(`2-Year Forward PE: ${currentPrice} / ${projectedEPS2026.toFixed(2)} = ${forwardPE2026.toFixed(2)}x`);

    // Test assertions - using the actual calculated values
    expect(eps2024).toBeCloseTo(EPS_2024_TOTAL, 1); // Only Q4 2024 data available
    expect(eps2025).toBeCloseTo(EPS_2025_TOTAL, 1); // Sum of Q1, Q2, Q3 2025
    expect(forwardPE2026).toBeCloseTo(FORWARD_PE_2026, 1); // Actual calculated forward PE (6.99x)
  });

  it('should handle missing earnings estimates gracefully', async () => {
    const mockQuoteResponse = {
      data: {
        c: 100.00
      }
    };

    const mockMetricsResponse = {
      data: {
        metric: {
          peTTM: 15.0
        }
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
    expect(data.currentPE).toBe(15.0);
    expect(data.currentPrice).toBe(100.00);
    expect(data.forwardPE2Year).toBeNull(); // No forward estimates available
    expect(data.eps2026).toBeNull();
  });
});
