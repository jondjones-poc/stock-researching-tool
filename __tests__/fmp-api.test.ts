import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/fmp/route';

// Mock axios
jest.mock('axios');
const mockedAxios = require('axios');

// Set environment variables for testing
process.env.FMP_API_KEY = "test-fmp-api-key";

// Constants for FMP calculations
const SHARES_OUTSTANDING = 418603009;
const SHARES_IN_MILLIONS = 418.6;
const SHARES_IN_BILLIONS = 0.419;
const FMP_PE = 21.63;
const MARKET_CAP = 145146407341;
const MARKET_CAP_IN_BILLIONS = 145.1;
const PRICE = 346.74;

describe('/api/fmp - Financial Modeling Prep API', () => {
  beforeEach(() => {
    // Mock the FMP API key environment variable
    process.env.FMP_API_KEY = "test-fmp-api-key";
  });

  it('should fetch and return FMP data for ADBE', async () => {
    // Mock the FMP API response using real ADBE data
    const mockFmpResponse = {
      data: [
        {
          "symbol": "ADBE",
          "name": "Adobe Inc.",
          "price": PRICE,
          "changesPercentage": -1.34858,
          "change": -4.74,
          "dayLow": 346.305,
          "dayHigh": 352.5926,
          "yearHigh": 557.9,
          "yearLow": 330.04,
          "marketCap": MARKET_CAP,
          "priceAvg50": 353.5018,
          "priceAvg200": 392.73306,
          "exchange": "NASDAQ",
          "volume": 3111281,
          "avgVolume": 4226990,
          "open": 351.735,
          "previousClose": 351.48,
          "eps": 16.03,
          "pe": FMP_PE,
          "earningsAnnouncement": "2025-12-10T05:00:00.000+0000",
          "sharesOutstanding": SHARES_OUTSTANDING,
          "timestamp": 1759521601
        }
      ]
    };

    mockedAxios.get.mockResolvedValueOnce(mockFmpResponse);

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);

    // Test shares outstanding using constants
    expect(data.sharesOutstanding).toBe(SHARES_OUTSTANDING);
    expect(data.sharesOutstanding / 1000000).toBeCloseTo(SHARES_IN_MILLIONS, 1); // 418.6M shares

    // Test FMP PE ratio
    expect(data.fmpPE).toBe(FMP_PE);

    // Test market cap using constants
    expect(data.marketCap).toBe(MARKET_CAP);
    expect(data.marketCap / 1000000000).toBeCloseTo(MARKET_CAP_IN_BILLIONS, 1); // $145.1B

    // Test price
    expect(data.price).toBe(PRICE);

    console.log('ADBE FMP Data:');
    console.log(`  Shares Outstanding: ${(data.sharesOutstanding / 1000000).toFixed(1)}M`);
    console.log(`  FMP PE Ratio: ${data.fmpPE}x`);
    console.log(`  Market Cap: $${(data.marketCap / 1000000000).toFixed(1)}B`);
    console.log(`  Price: $${data.price}`);
  });

  it('should handle empty FMP response gracefully', async () => {
    const mockFmpResponse = { data: [] }; // Empty response
    mockedAxios.get.mockResolvedValueOnce(mockFmpResponse);

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=INVALID');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sharesOutstanding).toBeNull();
    expect(data.fmpPE).toBeNull();
    expect(data.marketCap).toBeNull();
    expect(data.price).toBeNull();
  });

  it('should handle API errors gracefully', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch FMP data');
  });

  it('should handle missing symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/fmp');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });

  it('should demonstrate shares outstanding calculation', () => {
    console.log('Shares Outstanding Calculation:');
    console.log(`  Raw value: ${SHARES_OUTSTANDING.toLocaleString()}`);
    console.log(`  In millions: ${SHARES_IN_MILLIONS.toFixed(1)}M`);
    console.log(`  In billions: ${SHARES_IN_BILLIONS.toFixed(3)}B`);
  });
});
