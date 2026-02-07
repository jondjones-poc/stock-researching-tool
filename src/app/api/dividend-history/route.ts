import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY && !FINNHUB_API_KEY && !ALPHA_VANTAGE_API_KEY) {
    return NextResponse.json({ error: 'At least one API key (FMP, Finnhub, or Alpha Vantage) is required' }, { status: 500 });
  }

  try {
    // Try multiple endpoints in parallel with fallbacks
    const [fmpResponse, finnhubResponse, alphaVantageResponse] = await Promise.allSettled([
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol}&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=2020-01-01&to=${new Date().getFullYear()}-12-31&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      ALPHA_VANTAGE_API_KEY ? axios.get(`https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null })
    ]);

    let allDividends: any[] = [];
    let source = '';

    // Try FMP first (primary source) - try both URL formats
    if (fmpResponse.status === 'fulfilled' && fmpResponse.value.status === 200 && fmpResponse.value.data) {
      const data = fmpResponse.value.data;
      console.log(`FMP response status for ${symbol}:`, fmpResponse.value.status);
      console.log(`FMP response data type:`, typeof data, Array.isArray(data));
      console.log(`FMP response for ${symbol}:`, JSON.stringify(data).substring(0, 1000));
      
      // FMP can return data in different formats
      if (data.historical && Array.isArray(data.historical) && data.historical.length > 0) {
        // Transform FMP format to our format - FMP uses 'adjDividend' or 'dividend'
        allDividends = data.historical.map((item: any) => ({
          date: item.date,
          dividend: item.dividend || item.adjDividend || 0,
          adjustedDividend: item.adjDividend || item.dividend || 0
        })).filter((item: any) => item.date && (item.dividend > 0 || item.adjustedDividend > 0));
        source = 'FMP';
        console.log(`Using FMP dividend data for ${symbol}: ${allDividends.length} records`);
      } else if (Array.isArray(data) && data.length > 0) {
        // Sometimes FMP returns array directly
        allDividends = data.map((item: any) => ({
          date: item.date,
          dividend: item.dividend || item.adjDividend || 0,
          adjustedDividend: item.adjDividend || item.dividend || 0
        })).filter((item: any) => item.date && (item.dividend > 0 || item.adjustedDividend > 0));
        source = 'FMP';
        console.log(`Using FMP dividend data (array format) for ${symbol}: ${allDividends.length} records`);
      } else {
        console.log(`FMP response structure for ${symbol}:`, Object.keys(data || {}));
        if (data && typeof data === 'object') {
          console.log(`FMP response has 'historical' key:`, 'historical' in data);
          console.log(`FMP response 'historical' value:`, data.historical);
        }
      }
    } else if (fmpResponse.status === 'rejected') {
      const error = fmpResponse.reason;
      const status = error?.response?.status;
      const statusText = error?.response?.statusText;
      const responseData = error?.response?.data;
      console.log(`FMP request failed for ${symbol}:`, status, statusText, error?.message);
      console.log(`FMP error response data:`, JSON.stringify(responseData).substring(0, 500));
      
      // Try alternative FMP URL format if first one failed (v3 API)
      if (FMP_API_KEY && status === 404) {
        try {
          console.log(`Trying FMP v3 API endpoint for ${symbol}`);
          const altResponse = await axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${symbol}?apikey=${FMP_API_KEY}`, { timeout: 10000 });
          console.log(`FMP v3 API response status:`, altResponse.status);
          console.log(`FMP v3 API response data keys:`, Object.keys(altResponse.data || {}));
          if (altResponse.data) {
            const altData = altResponse.data;
            if (altData.historical && Array.isArray(altData.historical) && altData.historical.length > 0) {
              allDividends = altData.historical.map((item: any) => ({
                date: item.date,
                dividend: item.dividend || item.adjDividend || 0,
                adjustedDividend: item.adjDividend || item.dividend || 0
              })).filter((item: any) => item.date && item.dividend > 0);
              source = 'FMP (v3 API)';
              console.log(`Using FMP dividend data (v3 API) for ${symbol}: ${allDividends.length} records`);
            } else if (Array.isArray(altData) && altData.length > 0) {
              allDividends = altData.map((item: any) => ({
                date: item.date,
                dividend: item.dividend || item.adjDividend || 0,
                adjustedDividend: item.adjDividend || item.dividend || 0
              })).filter((item: any) => item.date && item.dividend > 0);
              source = 'FMP (v3 API)';
              console.log(`Using FMP dividend data (v3 API, array format) for ${symbol}: ${allDividends.length} records`);
            }
          }
        } catch (altError: any) {
          console.log(`FMP v3 API also failed for ${symbol}:`, altError?.response?.status, altError?.message);
        }
      }
    }

    // Fallback to Finnhub
    if (allDividends.length === 0 && finnhubResponse.status === 'fulfilled' && finnhubResponse.value.data) {
      const data = finnhubResponse.value.data;
      console.log(`Finnhub response for ${symbol}:`, JSON.stringify(data).substring(0, 500));
      
      if (Array.isArray(data) && data.length > 0) {
        // Finnhub returns array of {date, amount} or {exDate, amount}
        allDividends = data.map((div: any) => ({
          date: div.date || div.exDate,
          dividend: parseFloat(div.amount || div.dividend || 0),
          adjustedDividend: parseFloat(div.amount || div.dividend || 0)
        })).filter((div: any) => div.date && div.dividend > 0);
        source = 'Finnhub';
        console.log(`Using Finnhub dividend data for ${symbol}: ${allDividends.length} records`);
      }
    } else if (finnhubResponse.status === 'rejected') {
      console.log(`Finnhub request failed for ${symbol}:`, finnhubResponse.reason?.response?.status, finnhubResponse.reason?.message);
    }

    // Fallback to Alpha Vantage
    if (allDividends.length === 0 && alphaVantageResponse.status === 'fulfilled' && alphaVantageResponse.value.data) {
      const data = alphaVantageResponse.value.data;
      console.log(`Alpha Vantage response for ${symbol}:`, JSON.stringify(data).substring(0, 500));
      
      // Check for error messages from Alpha Vantage
      if (data['Error Message'] || data['Note']) {
        console.log(`Alpha Vantage error/note for ${symbol}:`, data['Error Message'] || data['Note']);
      } else if (data.dividends && Array.isArray(data.dividends) && data.dividends.length > 0) {
        // Alpha Vantage returns {dividends: [{date, dividend}]}
        allDividends = data.dividends.map((div: any) => ({
          date: div.date,
          dividend: parseFloat(div.dividend || 0),
          adjustedDividend: parseFloat(div.dividend || 0)
        })).filter((div: any) => div.date && div.dividend > 0);
        source = 'Alpha Vantage';
        console.log(`Using Alpha Vantage dividend data for ${symbol}: ${allDividends.length} records`);
      }
    } else if (alphaVantageResponse.status === 'rejected') {
      console.log(`Alpha Vantage request failed for ${symbol}:`, alphaVantageResponse.reason?.response?.status, alphaVantageResponse.reason?.message);
    }


    if (allDividends.length === 0) {
      // Collect error details from all failed requests
      const errors: string[] = [];
      
      if (fmpResponse.status === 'rejected') {
        const error = fmpResponse.reason;
        const status = error?.response?.status;
        if (status === 429) {
          errors.push('FMP: Rate limit exceeded');
        } else if (status === 404) {
          errors.push('FMP: Endpoint not found');
        } else {
          errors.push(`FMP: ${error?.message || 'Request failed'}`);
        }
      } else if (fmpResponse.status === 'fulfilled' && fmpResponse.value.data) {
        const data = fmpResponse.value.data;
        if (!data.historical || (Array.isArray(data.historical) && data.historical.length === 0)) {
          errors.push('FMP: No dividend data in response');
        }
      }
      
      if (finnhubResponse.status === 'rejected') {
        const error = finnhubResponse.reason;
        const status = error?.response?.status;
        if (status === 429) {
          errors.push('Finnhub: Rate limit exceeded');
        } else {
          errors.push(`Finnhub: ${error?.message || 'Request failed'}`);
        }
      } else if (finnhubResponse.status === 'fulfilled' && finnhubResponse.value.data) {
        const data = finnhubResponse.value.data;
        if (!Array.isArray(data) || data.length === 0) {
          errors.push('Finnhub: No dividend data in response');
        }
      }
      
      if (alphaVantageResponse.status === 'rejected') {
        const error = alphaVantageResponse.reason;
        errors.push(`Alpha Vantage: ${error?.message || 'Request failed'}`);
      } else if (alphaVantageResponse.status === 'fulfilled' && alphaVantageResponse.value.data) {
        const data = alphaVantageResponse.value.data;
        if (data['Error Message'] || data['Note']) {
          errors.push(`Alpha Vantage: ${data['Error Message'] || data['Note']}`);
        } else if (!data.dividends || (Array.isArray(data.dividends) && data.dividends.length === 0)) {
          errors.push('Alpha Vantage: No dividend data in response');
        }
      }
      
      const errorMessage = errors.length > 0 
        ? `No dividend data available. All APIs failed: ${errors.join('; ')}`
        : 'No dividend data available from any API source';
      
      return NextResponse.json({ 
        error: errorMessage,
        details: errors 
      }, { status: 404 });
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
    console.error('Error fetching dividend history:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch dividend history data', details: error.message },
      { status: 500 }
    );
  }
}

