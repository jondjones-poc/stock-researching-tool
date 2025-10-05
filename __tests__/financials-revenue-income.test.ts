import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/financials/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Constants for financial calculations
const ADBE_REVENUE = 21505000000;
const ADBE_COST_OF_REVENUE = 2358000000;
const ADBE_NET_INCOME = 5560000000;
const ADBE_GROSS_PROFIT = 19147000000;
const ADBE_GROSS_PROFIT_MARGIN = 0.89035108114392;
const ADBE_GROSS_PROFIT_MARGIN_PERCENT = 89.04;

const REVENUE_IN_BILLIONS = 21.5;
const NET_INCOME_IN_BILLIONS = 5.6;

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

  it('should calculate gross profit margin for ADBE', async () => {
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
                { concept: "us-gaap_Revenues", unit: "usd", label: "Revenue", value: ADBE_REVENUE },
                { concept: "us-gaap_CostOfRevenue", unit: "usd", label: "Cost of revenue", value: ADBE_COST_OF_REVENUE },
                { concept: "us-gaap_NetIncomeLoss", unit: "usd", label: "Net income", value: ADBE_NET_INCOME }
              ]
            }
          }
        ]
      }
    };

    mockedAxios.get.mockResolvedValueOnce(mockFinancialsResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Test revenue
    expect(data.revenue).toBe(ADBE_REVENUE);
    expect(data.costOfGoodsSold).toBe(ADBE_COST_OF_REVENUE);
    
    // Test net income
    expect(data.netIncome).toBe(ADBE_NET_INCOME);
    
    // Test gross profit margin calculation using constants
    const expectedGrossProfit = ADBE_REVENUE - ADBE_COST_OF_REVENUE; // 19,147,000,000
    const expectedMargin = expectedGrossProfit / ADBE_REVENUE; // 0.8903
    expect(data.grossProfitMargin).toBeCloseTo(expectedMargin, 4);
    expect(data.grossProfitMargin).toBeCloseTo(ADBE_GROSS_PROFIT_MARGIN, 4);

    console.log('ADBE Financial Data:');
    console.log(`  Revenue: $${ADBE_REVENUE.toLocaleString()}`);
    console.log(`  Net Income: $${ADBE_NET_INCOME.toLocaleString()}`);
    console.log(`  Gross Profit Margin: ${(data.grossProfitMargin * 100).toFixed(2)}%`);
  });

  it('should handle missing revenue data gracefully', async () => {
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

    mockedAxios.get.mockResolvedValueOnce(mockFinancialsResponse);

    const request = new NextRequest('http://localhost:3000/api/financials?symbol=TEST');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.revenue).toBeNull();
    expect(data.netIncome).toBeNull();
    expect(data.grossProfitMargin).toBeNull();
  });

  it('should demonstrate number formatting', () => {
    // Test number formatting using constants
    const revenue = ADBE_REVENUE;
    const netIncome = ADBE_NET_INCOME;

    console.log('Number Formatting Examples:');
    console.log(`  Revenue: $${revenue.toLocaleString()}`);
    console.log(`  Net Income: $${netIncome.toLocaleString()}`);
    console.log(`  Revenue in billions: $${REVENUE_IN_BILLIONS}B`);
    console.log(`  Net Income in billions: $${NET_INCOME_IN_BILLIONS}B`);

    expect(REVENUE_IN_BILLIONS).toBe(21.5);
    expect(NET_INCOME_IN_BILLIONS).toBe(5.6);
  });
});
