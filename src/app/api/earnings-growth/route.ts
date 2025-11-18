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
    // Fetch income statement data and analyst estimates
    const [incomeStatementResponse, analystEstimatesResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/stable/income-statement?symbol=${symbol}&limit=5&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/stable/analyst-estimates?symbol=${symbol}&apikey=${FMP_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      historicalGrowthRate: null,
      analystGrowthRate: null,
      epsData: [],
      analystData: null
    };

    // Process income statement data for historical EPS growth
    if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      
      console.log('Income statement data:', JSON.stringify(incomeData, null, 2));
      
      if (Array.isArray(incomeData) && incomeData.length >= 2) {
        // Sort by date to get chronological order
        const sortedData = incomeData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Extract EPS data
        const epsData = sortedData.map(item => ({
          date: item.date,
          eps: item.eps
        }));
        
        result.epsData = epsData;
        
        // Calculate 5-year growth rate if we have at least 2 data points
        if (epsData.length >= 2) {
          const latestEPS = epsData[epsData.length - 1].eps;
          const oldestEPS = epsData[0].eps;
          const years = epsData.length - 1;
          
          // Handle negative EPS values by using absolute values for growth calculation
          if (latestEPS !== 0 && oldestEPS !== 0) {
            // Use absolute values to calculate growth rate, then apply sign
            const latestAbs = Math.abs(latestEPS);
            const oldestAbs = Math.abs(oldestEPS);
            
            if (latestAbs > 0 && oldestAbs > 0) {
              // Calculate compound annual growth rate: (latest / oldest)^(1/years) - 1
              const growthRate = Math.pow(latestAbs / oldestAbs, 1 / years) - 1;
              
              // For growth calculation, we need to handle the sign correctly
              let finalGrowthRate = growthRate;
              if (latestEPS < 0 && oldestEPS < 0) {
                // Both negative: apply sign based on which is more negative
                finalGrowthRate = latestEPS < oldestEPS ? growthRate : -growthRate;
              } else if (latestEPS > 0 && oldestEPS < 0) {
                // Moving from negative to positive: use the calculated growth rate (which will be negative)
                // This represents improvement from a large negative to a smaller positive
                finalGrowthRate = growthRate; // Keep the negative value
              }
              result.historicalGrowthRate = finalGrowthRate;
              
              console.log(`EPS Growth Calculation: (${latestEPS} / ${oldestEPS})^(1/${years}) - 1 = ${(result.historicalGrowthRate * 100).toFixed(2)}%`);
            }
          }
        }
      }
    } else {
      console.log('Income statement data not available or failed');
      if (incomeStatementResponse.status === 'rejected') {
        console.log('Income statement error:', incomeStatementResponse.reason);
      }
    }

    // Process analyst estimates data
    if (analystEstimatesResponse.status === 'fulfilled' && analystEstimatesResponse.value.data) {
      const analystData = analystEstimatesResponse.value.data;
      
      console.log('Analyst estimates data:', JSON.stringify(analystData, null, 2));
      
      result.analystData = analystData;
      
      // Look for growth rate in analyst data
      if (analystData && typeof analystData === 'object') {
        // Try different possible field names for growth rate
        const possibleGrowthFields = ['growthRate', 'growth', 'epsGrowth', 'longTermGrowth', 'analystGrowth'];
        
        for (const field of possibleGrowthFields) {
          if (analystData[field] !== undefined && analystData[field] !== null) {
            result.analystGrowthRate = analystData[field];
            console.log(`Found analyst growth rate in field '${field}':`, result.analystGrowthRate);
            break;
          }
        }
      }
    } else {
      console.log('Analyst estimates data not available or failed');
      if (analystEstimatesResponse.status === 'rejected') {
        console.log('Analyst estimates error:', analystEstimatesResponse.reason);
      }
    }

    console.log('Final earnings growth result:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching earnings growth data:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch earnings growth data', details: error.message },
      { status: 500 }
    );
  }
}
