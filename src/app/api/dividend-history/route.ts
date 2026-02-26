import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!ALPHA_VANTAGE_API_KEY) {
    return NextResponse.json({ 
      error: 'Alpha Vantage API key is required',
      details: ['Please set ALPHA_VANTAGE_API_KEY or ALPHA_VANTAGE in your environment variables']
    }, { status: 500 });
  }

  try {
    // Call Alpha Vantage API
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`,
      { timeout: 10000 }
    );

    const data = response.data;
    
    // Check for error messages
    const errorMsg = data['Error Message'] || data['Note'] || data['Information'];
    const isRateLimit = errorMsg && typeof errorMsg === 'string' && (
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.toLowerCase().includes('spreading out') ||
      errorMsg.toLowerCase().includes('25 requests per day')
    );

    // Parse dividend data
    let allDividends: any[] = [];
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      // Alpha Vantage returns {symbol: "NKE", data: [{ex_dividend_date, amount, ...}]}
      allDividends = data.data.map((div: any) => ({
        date: div.ex_dividend_date || div.date,
        dividend: parseFloat(div.amount || div.dividend || 0),
        adjustedDividend: parseFloat(div.amount || div.dividend || 0)
      })).filter((div: any) => div.date && div.dividend > 0);
      
      if (isRateLimit) {
        console.log(`Alpha Vantage rate limit warning for ${symbol} (but data retrieved successfully)`);
      }
    } else if (data.dividends && Array.isArray(data.dividends) && data.dividends.length > 0) {
      // Legacy format: {dividends: [{date, dividend}]}
      allDividends = data.dividends.map((div: any) => ({
        date: div.date,
        dividend: parseFloat(div.dividend || 0),
        adjustedDividend: parseFloat(div.dividend || 0)
      })).filter((div: any) => div.date && div.dividend > 0);
    }

    // If no data and there's an error, return error
    if (allDividends.length === 0) {
      if (isRateLimit) {
        return NextResponse.json({
          error: 'Alpha Vantage rate limit exceeded',
          details: ['Rate limit: 25 requests/day, 1 request/second. Please wait 1 second between requests or upgrade to premium.']
        }, { status: 429 });
      } else if (errorMsg) {
        return NextResponse.json({
          error: 'Alpha Vantage API error',
          details: [errorMsg]
        }, { status: 400 });
      } else {
        return NextResponse.json({
          error: 'No dividend data available',
          details: ['This stock may not pay dividends or dividend data is not available']
        }, { status: 404 });
      }
    }

    // Sort by date descending (most recent first)
    allDividends.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter dividends to only include those from the last 6 years (dynamic)
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setFullYear(today.getFullYear() - 6);
    cutoffDate.setMonth(0, 1); // Start of the year 6 years ago
    
    const historicalDividends = allDividends.filter((dividend: any) => {
      const dividendDate = new Date(dividend.date);
      return dividendDate >= cutoffDate;
    });
    
    // Aggregate by year
    const dividendsByYear: { [year: string]: number } = {};
    historicalDividends.forEach((div: any) => {
      const year = new Date(div.date).getFullYear().toString();
      if (!dividendsByYear[year]) {
        dividendsByYear[year] = 0;
      }
      dividendsByYear[year] += div.dividend;
    });
    
    // Fill in missing years with $0.00 (for suspended dividends)
    if (Object.keys(dividendsByYear).length > 0) {
      const years = Object.keys(dividendsByYear).map(y => parseInt(y)).sort((a, b) => a - b);
      const oldestYear = years[0];
      const newestYear = years[years.length - 1];
      
      // Fill in all years from oldest to newest
      for (let year = oldestYear; year <= newestYear; year++) {
        const yearStr = year.toString();
        if (!dividendsByYear[yearStr]) {
          dividendsByYear[yearStr] = 0;
        }
      }
    }
    
    // Get current year and sorted years
    const currentYear = new Date().getFullYear().toString();
    const years = Object.keys(dividendsByYear).sort();
    
    // Project current year's dividend if it exists (it's likely incomplete)
    if (years.includes(currentYear) && years.length >= 6) {
      // Get last 5 complete years (excluding current year) to calculate 4 growth rates
      const completeYears = years.filter(y => y !== currentYear).slice(-5);
      
      if (completeYears.length === 5) {
        // Calculate average growth rate from last 4 transitions
        let totalGrowthRate = 0;
        let growthCount = 0;
        
        for (let i = 1; i < completeYears.length; i++) {
          const prevYear = completeYears[i - 1];
          const currYear = completeYears[i];
          const prevDividend = dividendsByYear[prevYear];
          const currDividend = dividendsByYear[currYear];
          
          // Skip if previous dividend is 0 (can't calculate growth from zero)
          if (prevDividend > 0) {
            totalGrowthRate += (currDividend - prevDividend) / prevDividend;
            growthCount++;
          }
        }
        
        const avgGrowthRate = growthCount > 0 ? totalGrowthRate / growthCount : 0;
        
        // Project current year: last year's total * (1 + avg growth rate)
        const lastCompleteYear = completeYears[completeYears.length - 1];
        const lastYearDividend = dividendsByYear[lastCompleteYear];
        dividendsByYear[currentYear] = lastYearDividend * (1 + avgGrowthRate);
      }
    }
    
    // Calculate dividend growth rate using annual aggregation
    let dividendGrowthRate = null;
    if (years.length >= 2) {
      const sortedYears = Object.keys(dividendsByYear).sort();
      
      if (sortedYears.length >= 2) {
        const oldestYear = sortedYears[0];
        const latestYear = sortedYears[sortedYears.length - 1];
        const oldestAnnualDividend = dividendsByYear[oldestYear];
        const latestAnnualDividend = dividendsByYear[latestYear];
        const yearsDiff = parseInt(latestYear) - parseInt(oldestYear);
        
        if (yearsDiff > 0 && oldestAnnualDividend > 0) {
          dividendGrowthRate = Math.pow(latestAnnualDividend / oldestAnnualDividend, 1 / yearsDiff) - 1;
        }
      }
    }

    const result = {
      symbol: symbol.toUpperCase(),
      historicalDividends: historicalDividends.map((dividend: any) => ({
        date: dividend.date,
        dividend: dividend.dividend,
        adjustedDividend: dividend.adjustedDividend
      })),
      dividendsByYear: dividendsByYear,
      currentYearProjected: years.includes(currentYear) && years.length >= 5,
      dividendGrowthRate: dividendGrowthRate,
      latestDividend: historicalDividends[0]?.dividend || null
    };
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching dividend history from Alpha Vantage:', error.message);
    
    if (error.response) {
      // API returned an error response
      return NextResponse.json({
        error: 'Alpha Vantage API request failed',
        details: [error.response.statusText || error.message]
      }, { status: error.response.status || 500 });
    } else if (error.request) {
      // Request was made but no response received
      return NextResponse.json({
        error: 'No response from Alpha Vantage API',
        details: ['Network timeout or connection error']
      }, { status: 504 });
    } else {
      // Error setting up the request
      return NextResponse.json({
        error: 'Failed to fetch dividend history',
        details: [error.message || 'Unknown error']
      }, { status: 500 });
    }
  }
}
