import { NextRequest } from 'next/server';
import { GET } from '../src/app/api/fmp/route';

// Mock axios
jest.mock('axios');

// Set environment variables for testing
process.env.FMP_API_KEY = "test-fmp-api-key";
const mockedAxios = require('axios');

describe('/api/fmp - Financial Modeling Prep API', () => {
  beforeEach(() => {
    // Mock the FMP API key environment variable
    process.env.FMP_API_KEY = "test-fmp-api-key";
    jest.clearAllMocks();
    // Mock the FMP API key environment variable
    process.env.FMP_API_KEY = "test-fmp-api-key";
  });


  it('should fetch ADBE data from FMP API using real JSON data', async () => {
    // Mock the FMP API response using real ADBE data
    const mockFmpResponse = {
      data: [
        {
          "symbol": "ADBE",
          "name": "Adobe Inc.",
          "price": 346.74,
          "changesPercentage": -1.34858,
          "change": -4.74,
          "dayLow": 346.305,
          "dayHigh": 352.5926,
          "yearHigh": 557.9,
          "yearLow": 330.04,
          "marketCap": 145146407341,
          "priceAvg50": 353.5018,
          "priceAvg200": 392.73306,
          "exchange": "NASDAQ",
          "volume": 3111281,
          "avgVolume": 4226990,
          "open": 351.735,
          "previousClose": 351.48,
          "eps": 16.03,
          "pe": 21.63,
          "earningsAnnouncement": "2025-12-10T05:00:00.000+0000",
          "sharesOutstanding": 418603009,
          "timestamp": 1759521601
        }
      ]
    };

    mockedAxios.get.mockResolvedValue(mockFmpResponse);

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=ADBE');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    
    // Test shares outstanding
    expect(data.sharesOutstanding).toBe(418603009);
    expect(data.sharesOutstanding / 1000000).toBeCloseTo(418.6, 1); // 418.6M shares
    
    // Test FMP PE ratio
    expect(data.fmpPE).toBe(21.63);
    
    // Test market cap
    expect(data.marketCap).toBe(145146407341);
    expect(data.marketCap / 1000000000).toBeCloseTo(145.1, 1); // $145.1B
    
    // Test price
    expect(data.price).toBe(346.74);
    
    console.log('ADBE FMP Data:');
    console.log(`  Shares Outstanding: ${(data.sharesOutstanding / 1000000).toFixed(1)}M`);
    console.log(`  FMP PE Ratio: ${data.fmpPE}x`);
    console.log(`  Market Cap: $${(data.marketCap / 1000000000).toFixed(1)}B`);
    console.log(`  Price: $${data.price}`);
  });


  it('should handle missing data gracefully', async () => {
    const mockFmpResponse = { data: [] }; // Empty response

    mockedAxios.get.mockResolvedValue(mockFmpResponse);

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=INVALID');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sharesOutstanding).toBeNull();
    expect(data.fmpPE).toBeNull();
    expect(data.marketCap).toBeNull();
    expect(data.price).toBeNull();
  });


  it('should handle API errors', async () => {
    mockedAxios.get.mockRejectedValue(new Error('API Error'));

    const request = new NextRequest('http://localhost:3000/api/fmp?symbol=AAPL');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to fetch FMP data');
  });


  it('should require symbol parameter', async () => {
    const request = new NextRequest('http://localhost:3000/api/fmp');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Stock symbol is required');
  });


  it('should demonstrate shares outstanding calculation', () => {
    const sharesOutstanding = 418603009;
    const sharesInMillions = sharesOutstanding / 1000000;
    const sharesInBillions = sharesOutstanding / 1000000000;
    
    console.log(`Shares Outstanding Calculation:`);
    console.log(`  Raw value: ${sharesOutstanding.toLocaleString()}`);
    console.log(`  In millions: ${sharesInMillions.toFixed(1)}M`);
    console.log(`  In billions: ${sharesInBillions.toFixed(3)}B`);
    
    expect(sharesInMillions).toBeCloseTo(418.6, 1);
    expect(sharesInBillions).toBeCloseTo(0.419, 3);
  });

});
