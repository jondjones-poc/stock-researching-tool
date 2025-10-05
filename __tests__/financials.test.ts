import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/financials/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/financials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate gross profit margin for CAKE (Cheesecake Factory)', async () => {
    // Mock the API response for CAKE
    const mockResponse = {
      data: {
        symbol: "CAKE",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
                  value: 3581699000
                },
                {
                  concept: "cake_FoodAndBeverageCosts",
                  value: 806021000
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeCloseTo(0.775, 3); // 77.5%
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate gross profit margin for AAPL (Apple)', async () => {
    // Mock the API response for AAPL
    const mockResponse = {
      data: {
        symbol: "AAPL",
        data: [
          {
            year: 2024,
            quarter: 2,
            report: {
              ic: [
                {
                  concept: "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
                  value: 81247000000
                },
                {
                  concept: "us-gaap_CostOfGoodsAndServicesSold",
                  value: 45956000000
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeCloseTo(0.434, 3); // 43.4%
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle missing revenue data', async () => {
    const mockResponse = {
      data: {
        symbol: "INVALID",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "cake_FoodAndBeverageCosts",
                  value: 1000000
                }
                // Missing revenue
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=INVALID');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeNull();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle missing cost of goods sold data', async () => {
    const mockResponse = {
      data: {
        symbol: "INVALID",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
                  value: 1000000
                }
                // Missing cost of goods sold
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=INVALID');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeNull();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle empty data array', async () => {
    const mockResponse = {
      data: {
        symbol: "INVALID",
        data: []
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=INVALID');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeNull();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle API errors', async () => {
    mockedAxios.get.mockRejectedValue(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should require symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/financials');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle different revenue field names', async () => {
    const mockResponse = {
      data: {
        symbol: "TEST",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "Revenues",
                  value: 1000000
                },
                {
                  concept: "CostOfRevenue",
                  value: 600000
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeCloseTo(0.4, 3); // 40%
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle different cost field names', async () => {
    const mockResponse = {
      data: {
        symbol: "TEST",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
                  value: 2000000
                },
                {
                  concept: "us-gaap_CostOfGoodsAndServicesSold",
                  value: 1200000
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grossProfitMargin).toBeCloseTo(0.4, 3); // 40%
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
});

  it('should calculate gross profit margin for ADBE (Adobe)', async () => {
    // Mock the API response for ADBE with actual data structure
    const mockResponse = {
      data: {
        symbol: "ADBE",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "us-gaap_Revenues",
                  unit: "usd",
                  label: "Revenue",
                  value: 21505000000.0
                },
                {
                  concept: "us-gaap_CostOfRevenue",
                  unit: "usd",
                  label: "Cost of revenue",
                  value: 2358000000.0
                },
                {
                  concept: "us-gaap_GrossProfit",
                  unit: "usd",
                  label: "Gross profit",
                  value: 19147000000.0
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Expected: (21505000000 - 2358000000) / 21505000000 = 0.8903 = 89.03%
    expect(data.grossProfitMargin).toBeCloseTo(0.8903, 3);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should calculate gross profit margin for CAKE (Cheesecake Factory) - Real API Data', async () => {
    // Mock the API response for CAKE with actual API response structure
    const mockResponse = {
      data: {
        symbol: "CAKE",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                {
                  concept: "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax",
                  unit: "unit_standard_usd_el5214mhz0ueilxzxnuqyw",
                  label: "Revenue from Contract with Customer, Excluding Assessed Tax",
                  value: 3581699000.0
                },
                {
                  concept: "cake_FoodAndBeverageCosts",
                  unit: "unit_standard_usd_el5214mhz0ueilxzxnuqyw",
                  label: "The amount of food and beverage costs.",
                  value: 806021000.0
                }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=CAKE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Expected: (3581699000 - 806021000) / 3581699000 = 0.775 = 77.5%
    expect(data.grossProfitMargin).toBeCloseTo(0.775, 3);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
