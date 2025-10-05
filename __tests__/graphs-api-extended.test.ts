import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/graphs/route';
import fs from 'fs';
import path from 'path';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Load saved JSON data
const portfolioData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'portfolio-value-fmp-aapl.json'), 'utf8'));
const dividendData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'dividend-income-aapl.json'), 'utf8'));

// Mock cash flow and income statement data
const mockCashFlowData = [
  {
    calendarYear: "2024",
    netCashProvidedByOperatingActivities: 100000000,
    capitalExpenditure: -20000000,
    commonStockRepurchased: 50000000,
    commonStockIssued: 10000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  },
  {
    calendarYear: "2023",
    netCashProvidedByOperatingActivities: 90000000,
    capitalExpenditure: -18000000,
    commonStockRepurchased: 40000000,
    commonStockIssued: 8000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  }
];

const mockIncomeStatementData = [
  {
    calendarYear: "2024",
    revenue: 500000000,
    netIncome: 100000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  },
  {
    calendarYear: "2023",
    revenue: 450000000,
    netIncome: 90000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  }
];

// Mock key metrics data for shares outstanding
const mockKeyMetricsData = [
  {
    calendarYear: "2024",
    marketCap: 3000000000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  },
  {
    calendarYear: "2023", 
    marketCap: 2800000000000
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  }
];

describe('/api/graphs - Extended with Portfolio, Dividend, and Shares Outstanding Data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FMP_API_KEY = "test-fmp-api-key";
    process.env.FINNHUB_API_KEY = "test-finnhub-api-key";
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  });

  afterEach(() => {
    delete process.env.FMP_API_KEY;
    delete process.env.FINNHUB_API_KEY;
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  });

  it('should fetch all graph data including shares outstanding', async () => {
    // Mock all API responses with saved data
    mockedAxios.get
      .mockResolvedValueOnce({ data: mockCashFlowData }) // Cash flow
      .mockResolvedValueOnce({ data: mockIncomeStatementData }) // Income statement
      .mockResolvedValueOnce({ data: portfolioData }) // Portfolio data (from saved JSON)
      .mockResolvedValueOnce({ data: dividendData }) // Dividend data (from saved JSON)
      .mockResolvedValueOnce({ data: mockKeyMetricsData }); // Key metrics data

    const request = new NextRequest('http://localhost:3000/api/graphs?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Check existing data
    expect(data.freeCashFlow).toBeDefined();
    expect(data.shareBuybacks).toBeDefined();
    expect(data.revenue).toBeDefined();
    
    // Check new portfolio value data
    expect(data.portfolioValue).toBeDefined();
    expect(data.portfolioValue.length).toBeGreaterThan(0);
    
    // Check new dividend income data
    expect(data.dividendIncome).toBeDefined();
    expect(data.dividendIncome.length).toBeGreaterThan(0);
    
    // Check new shares outstanding data
    expect(data.sharesOutstanding).toBeDefined();
    expect(data.sharesOutstanding.length).toBeGreaterThan(0);
    
    console.log('Portfolio Value Data Points:', data.portfolioValue.length);
    console.log('Dividend Income Data Points:', data.dividendIncome.length);
    console.log('Shares Outstanding Data Points:', data.sharesOutstanding.length);
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  });

  it('should process shares outstanding data correctly', async () => {
    mockedAxios.get
      .mockResolvedValueOnce({ data: [] }) // Cash flow
      .mockResolvedValueOnce({ data: [] }) // Income statement
      .mockResolvedValueOnce({ data: portfolioData }) // Portfolio data
      .mockResolvedValueOnce({ data: { historical: [] } }) // Dividend data
      .mockResolvedValueOnce({ data: mockKeyMetricsData }); // Key metrics data

    const request = new NextRequest('http://localhost:3000/api/graphs?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sharesOutstanding).toBeDefined();
    expect(data.sharesOutstanding.length).toBeGreaterThan(0);
    
    // Verify data structure
    const sharesItem = data.sharesOutstanding[0];
    expect(sharesItem).toHaveProperty('year');
    expect(sharesItem).toHaveProperty('value');
    expect(typeof sharesItem.value).toBe('number');
    expect(sharesItem.value).toBeGreaterThan(0);
    
    console.log('Shares Outstanding Sample Data:');
    console.log('First Item:', data.sharesOutstanding[0]);
    console.log('Last Item:', data.sharesOutstanding[data.sharesOutstanding.length - 1]);
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  });

  it('should handle missing symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/graphs');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  },
  {
    calendarYear: "2022",
    revenue: 400000000,
    netIncome: 80000000
  },
  {
    calendarYear: "2021",
    revenue: 350000000,
    netIncome: 70000000
  },
  {
    calendarYear: "2020",
    revenue: 300000000,
    netIncome: 60000000  });
});
