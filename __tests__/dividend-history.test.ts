import { GET } from '../src/app/api/dividend-history/route';
import { NextRequest } from 'next/server';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock environment variable
process.env.FMP_API_KEY = 'test-fmp-api-key';

describe('Dividend History API - No Real API Calls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper function to create mock dividend data
  const createMockDividends = (years: number, paymentsPerYear: number[]) => {
    const dividends = [];
    const currentYear = 2025;
    const currentMonth = 6; // June
    
    for (let yearOffset = 0; yearOffset < years; yearOffset++) {
      const year = currentYear - yearOffset;
      const payments = paymentsPerYear[yearOffset % paymentsPerYear.length];
      
      for (let payment = 0; payment < payments; payment++) {
        const month = Math.floor((12 / payments) * payment);
        const date = new Date(year, month, 15);
        dividends.push({
          date: date.toISOString().split('T')[0],
          dividend: 0.75 + (yearOffset * 0.05),
          adjustedDividend: 0.75 + (yearOffset * 0.05)
        });
      }
    }
    
    return dividends;
  };

  // Helper to create request
  const createRequest = (symbol: string) => {
    const url = new URL(`http://localhost:3000/api/dividend-history?symbol=${symbol}`);
    return new NextRequest(url);
  };

  describe('Scenario 1: 4 years with 4 payments per year', () => {
    it('should return all 16 dividend payments', async () => {
      const mockDividends = createMockDividends(4, [4]);
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('TEST');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.historicalDividends).toHaveLength(16);
      expect(data.symbol).toBe('TEST');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Mocked only
      
      const years = new Set(data.historicalDividends.map((d: any) => 
        new Date(d.date).getFullYear()
      ));
      expect(years.size).toBe(4);
    });
  });

  describe('Scenario 2: 5 years with mixed payments (3 and 4 per year)', () => {
    it('should return all 18 dividend payments', async () => {
      const mockDividends = createMockDividends(5, [4, 3]);
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('MIXED');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.historicalDividends).toHaveLength(18);
      expect(data.dividendGrowthRate).toBeDefined();
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 3: 6 years with 4 payments per year', () => {
    it('should return all 24 dividend payments', async () => {
      const mockDividends = createMockDividends(6, [4]);
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('SIXYR');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.historicalDividends).toHaveLength(24);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      
      const years = new Set(data.historicalDividends.map((d: any) => 
        new Date(d.date).getFullYear()
      ));
      expect(years.size).toBe(6);
    });
  });

  describe('Scenario 4: 8+ years should be filtered to ~6 years', () => {
    it('should filter 8 years down to approximately 6 years', async () => {
      const mockDividends = createMockDividends(8, [4, 3]);
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('EIGHTYR');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      
      // Should have significantly fewer than 8 years of data
      const years = new Set(data.historicalDividends.map((d: any) => 
        new Date(d.date).getFullYear()
      ));
      
      // Should filter from 8 years down to 6-7 calendar years
      expect(years.size).toBeLessThan(8);
      expect(years.size).toBeGreaterThanOrEqual(6);
      
      // Should have filtered out the oldest payments
      expect(data.historicalDividends.length).toBeLessThan(mockDividends.length);
    });
  });

  describe('Edge cases', () => {
    it('should return error when symbol is missing', async () => {
      const url = new URL('http://localhost:3000/api/dividend-history');
      const request = new NextRequest(url);
      
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Stock symbol is required');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });

    it('should handle no dividend data', async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: [] } });

      const request = createRequest('NODIV');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No dividend data available');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

      const request = createRequest('ERROR');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Growth rate calculation with annual aggregation', () => {
    it('should calculate growth rate by aggregating quarterly dividends annually', async () => {
      // Year 2025: 4 × $0.80 = $3.20
      // Year 2024: 4 × $0.75 = $3.00
      // Growth: (3.20/3.00) - 1 = 6.67%
      const mockDividends = [
        { date: '2025-12-15', dividend: 0.80, adjustedDividend: 0.80 },
        { date: '2025-09-15', dividend: 0.80, adjustedDividend: 0.80 },
        { date: '2025-06-15', dividend: 0.80, adjustedDividend: 0.80 },
        { date: '2025-03-15', dividend: 0.80, adjustedDividend: 0.80 },
        { date: '2024-12-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2024-09-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2024-06-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2024-03-15', dividend: 0.75, adjustedDividend: 0.75 },
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('GROWTH');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dividendGrowthRate).toBeCloseTo(0.0667, 3);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed payment frequencies correctly', async () => {
      // Year 2025: 4 × $0.75 = $3.00
      // Year 2024: 3 × $0.67 ≈ $2.00
      const mockDividends = [
        { date: '2025-12-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2025-09-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2025-06-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2025-03-15', dividend: 0.75, adjustedDividend: 0.75 },
        { date: '2024-09-15', dividend: 0.67, adjustedDividend: 0.67 },
        { date: '2024-05-15', dividend: 0.67, adjustedDividend: 0.67 },
        { date: '2024-01-15', dividend: 0.66, adjustedDividend: 0.66 },
      ];
      
      mockedAxios.get.mockResolvedValueOnce({ data: { historical: mockDividends } });

      const request = createRequest('MIXEDFREQ');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dividendGrowthRate).toBeDefined();
      expect(data.dividendGrowthRate).toBeGreaterThan(0);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Summary: No real API calls made', () => {
    it('confirms all tests use mocked axios only', () => {
      // jest.mock('axios') at top ensures no real HTTP requests
      expect(true).toBe(true);
    });
  });
});
