import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    const fmpUrl = `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    const response = await axios.get(fmpUrl, { timeout: 10000 });

    if (!response.data || !response.data.historical) {
      return NextResponse.json({ error: 'No dividend data available' }, { status: 404 });
    }

    // Get all dividend data
    const allDividends = response.data.historical;
    
    if (allDividends.length === 0) {
      return NextResponse.json({ error: 'No dividend data available' }, { status: 404 });
    }

    // Calculate the cutoff date (6 years ago from the most recent dividend)
    const mostRecentDate = new Date(allDividends[0].date);
    const cutoffDate = new Date(mostRecentDate);
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 6);
    
    // Filter dividends to only include those from the last 6 years
    const historicalDividends = allDividends.filter((dividend: any) => {
      const dividendDate = new Date(dividend.date);
      return dividendDate >= cutoffDate;
    });
    
    // Log raw dividend data to debug missing years
    console.log(`Raw dividend count for ${symbol}:`, historicalDividends.length);
    const yearCounts: { [year: string]: number } = {};
    historicalDividends.forEach((div: any) => {
      const year = new Date(div.date).getFullYear().toString();
      yearCounts[year] = (yearCounts[year] || 0) + 1;
    });
    console.log('Dividend payments per year:', yearCounts);
    
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
          console.log(`Filled missing year ${yearStr} with $0.00 (dividends suspended)`);
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
        // Calculate average growth rate from last 4 transitions (years 2021, 2022, 2023, 2024)
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
        
        console.log(`Projected ${currentYear} dividend: $${dividendsByYear[currentYear].toFixed(2)} (based on ${lastCompleteYear}: $${lastYearDividend.toFixed(2)}, avg growth: ${(avgGrowthRate * 100).toFixed(2)}%)`);
      }
    }
    
    // Calculate dividend growth rate using annual aggregation (now with projected current year if applicable)
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
      symbol: symbol,
      historicalDividends: historicalDividends.map((dividend: any) => ({
        date: dividend.date,
        dividend: dividend.dividend,
        adjustedDividend: dividend.adjustedDividend
      })),
      dividendsByYear: dividendsByYear, // Annual aggregated dividends (with projected current year if applicable)
      currentYearProjected: years.includes(currentYear) && years.length >= 5,
      dividendGrowthRate: dividendGrowthRate,
      latestDividend: historicalDividends[0]?.dividend || null
    };
    
    console.log('API Response - dividendsByYear:', result.dividendsByYear);
    console.log('API Response - currentYearProjected:', result.currentYearProjected);
    
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching dividend history from FMP:', error.message);
    const statusCode = error.response?.status;
    let errorMessage = 'Failed to fetch dividend history data from FMP';
    
    if (statusCode === 429) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol} - rate limit`;
    } else if (statusCode === 402) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol} - payment required (402)`;
    } else if (statusCode === 403) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol} - forbidden (403)`;
    } else if (statusCode) {
      errorMessage = `FMP https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol} - HTTP ${statusCode}`;
    }
    
    return NextResponse.json(
      { error: errorMessage, details: error.message },
      { status: statusCode || 500 }
    );
  }
}

