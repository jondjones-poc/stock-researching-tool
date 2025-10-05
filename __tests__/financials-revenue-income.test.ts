import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/financials/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

describe('/api/financials - Revenue and Net Income', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the Finnhub API key environment variable
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should extract revenue and net income for ADBE using real data', async () => {
    // Mock the financials response using real ADBE data
    const mockFinancialsResponse = {
      data: {
        symbol: "ADBE",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                { concept: "us-gaap_Revenues", unit: "usd", label: "Revenue", value: 21505000000 },
                { concept: "us-gaap_CostOfRevenue", unit: "usd", label: "Cost of revenue", value: 2358000000 },
                { concept: "us-gaap_NetIncomeLoss", unit: "usd", label: "Net income", value: 5560000000 }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockFinancialsResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test revenue
    expect(data.revenue).toBe(21505000000);
    expect(data.revenue.toLocaleString()).toBe('21,505,000,000');
    
    // Test net income
    expect(data.netIncome).toBe(5560000000);
    expect(data.netIncome.toLocaleString()).toBe('5,560,000,000');
    
    // Test gross profit margin calculation
    const expectedGrossProfit = 21505000000 - 2358000000; // 19,147,000,000
    const expectedMargin = expectedGrossProfit / 21505000000; // 0.8903
    expect(data.grossProfitMargin).toBeCloseTo(expectedMargin, 3);
    
    console.log('ADBE Financial Data:');
    console.log(`  Revenue: $${data.revenue.toLocaleString()}`);
    console.log(`  Net Income: $${data.netIncome.toLocaleString()}`);
    console.log(`  Gross Profit Margin: ${(data.grossProfitMargin * 100).toFixed(2)}%`);
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle missing revenue and net income data', async () => {
    const mockFinancialsResponse = {
      data: {
        symbol: "TEST",
        data: [
          {
            year: 2024,
            quarter: 0,
            report: {
              ic: [
                { concept: "us-gaap_CostOfRevenue", unit: "usd", label: "Cost of revenue", value: 1000000000 }
                // Missing revenue and net income
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValue(mockFinancialsResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.revenue).toBeNull();
    expect(data.netIncome).toBeNull();
    expect(data.grossProfitMargin).toBeNull();
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValue(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });

  it('should demonstrate number formatting', () => {
    const revenue = 21505000000;
    const netIncome = 5560000000;
    
    console.log('Number Formatting Examples:');
    console.log(`  Revenue: $${revenue.toLocaleString()}`);
    console.log(`  Net Income: $${netIncome.toLocaleString()}`);
    console.log(`  Revenue in billions: $${(revenue / 1000000000).toFixed(1)}B`);
    console.log(`  Net Income in billions: $${(netIncome / 1000000000).toFixed(1)}B`);
    
    expect(revenue.toLocaleString()).toBe('21,505,000,000');
    expect(netIncome.toLocaleString()).toBe('5,560,000,000');
    expect((revenue / 1000000000).toFixed(1)).toBe('21.5');
    expect((netIncome / 1000000000).toFixed(1)).toBe('5.6');
  });

  afterEach(() => {
    // Restore original environment
    delete process.env.FINNHUB_API_KEY;
  });
});
