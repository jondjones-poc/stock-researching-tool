import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

interface ChartData {
  year: string;
  value: number;
  change?: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    console.error('FMP_API_KEY environment variable is not set');
    return NextResponse.json({ error: 'FMP_API_KEY environment variable is not set' }, { status: 500 });
  }

  if (!FINNHUB_API_KEY) {
    console.error('FINNHUB_API_KEY environment variable is not set');
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  // Log API key presence (without exposing the actual key)
  console.log(`API Keys present: FMP=${!!FMP_API_KEY} (length: ${FMP_API_KEY?.length || 0}), Finnhub=${!!FINNHUB_API_KEY} (length: ${FINNHUB_API_KEY?.length || 0})`);

  try {
    // Calculate date range for 10 years
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(toDate.getFullYear() - 10);
    
    // Fetch all data in parallel - use quarterly for supported endpoints
    const [cashFlowResponse, incomeStatementResponse, portfolioResponse, dividendResponse, keyMetricsResponse, epsResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${symbol}&limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/stable/income-statement?symbol=${symbol}&limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      // Use FMP for historical prices since Finnhub has access restrictions
      axios.get(`https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${symbol}&from=${fromDate.toISOString().split('T')[0]}&to=${toDate.toISOString().split('T')[0]}&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${symbol}&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      freeCashFlow: [],
      shareBuybacks: [],
      revenue: [],
      netIncome: [],
      portfolioValue: [],
      dividendIncome: [],
      sharesOutstanding: [],
      netMargin: [],
      grossMargin: [],
      eps: [],
      operatingIncome: [],
      errors: [],
      symbol: symbol.toUpperCase()
    };

    // Helper function to check for rate limiting and errors
    const checkResponse = (response: any, endpointName: string, apiProvider: string) => {
      if (response.status === 'rejected') {
        const error = response.reason;
        const statusCode = error.response?.status;
        
        if (statusCode === 429) {
          result.errors.push(`${endpointName} (${symbol}): Rate limit exceeded - ${apiProvider} endpoint`);
          console.error(`${endpointName} rate limited:`, error.response?.data);
          return { isError: true, isRateLimited: true, isForbidden: false };
        }
        
        if (statusCode === 402) {
          result.errors.push(`${endpointName} (${symbol}): Payment required (402) - ${apiProvider} endpoint - This may indicate your daily/monthly API quota has been exceeded or the endpoint requires a premium subscription`);
          console.error(`${endpointName} payment required (402):`, error.response?.data || error.message);
          return { isError: true, isRateLimited: false, isForbidden: false };
        }
        
        if (statusCode === 403) {
          const errorDetails = error.response?.data || error.message;
          // Check if it's an invalid API key issue
          const errorStr = JSON.stringify(errorDetails).toLowerCase();
          const isInvalidKey = errorStr.includes('invalid') || errorStr.includes('api key') || errorStr.includes('authentication');
          
          let errorMsg = `${endpointName} (${symbol}): Access forbidden (403) - ${apiProvider} endpoint`;
          if (isInvalidKey) {
            errorMsg += ' - Invalid or expired API key. Please check your API key in the .env file.';
          }
          
          result.errors.push(errorMsg);
          console.error(`${endpointName} forbidden (403):`, errorDetails);
          console.error(`${endpointName} 403 error details:`, JSON.stringify(errorDetails, null, 2));
          return { isError: true, isRateLimited: false, isForbidden: true };
        }
        
        result.errors.push(`${endpointName} (${symbol}): ${error.message || `HTTP ${statusCode || 'Request failed'}`} - ${apiProvider} endpoint`);
        console.error(`${endpointName} error:`, error.message, error.response?.data);
        return { isError: true, isRateLimited: false, isForbidden: false };
      }
      
      if (response.value.status === 429) {
        result.errors.push(`${endpointName} (${symbol}): Rate limit exceeded - ${apiProvider} endpoint`);
        console.error(`${endpointName} rate limited:`, response.value.data);
        return { isError: true, isRateLimited: true, isForbidden: false };
      }
      
      if (response.value.status === 402) {
        result.errors.push(`${endpointName} (${symbol}): Payment required (402) - ${apiProvider} endpoint - This may indicate your daily/monthly API quota has been exceeded or the endpoint requires a premium subscription`);
        console.error(`${endpointName} payment required (402):`, response.value.data);
        return { isError: true, isRateLimited: false, isForbidden: false };
      }
      
      if (response.value.status === 403) {
        const errorDetails = response.value.data;
        // Check if it's an invalid API key issue
        const errorStr = JSON.stringify(errorDetails || {}).toLowerCase();
        const isInvalidKey = errorStr.includes('invalid') || errorStr.includes('api key') || errorStr.includes('authentication');
        
        let errorMsg = `${endpointName} (${symbol}): Access forbidden (403) - ${apiProvider} endpoint`;
        if (isInvalidKey) {
          errorMsg += ' - Invalid or expired API key. Please check your API key in the .env file.';
        }
        
        result.errors.push(errorMsg);
        console.error(`${endpointName} forbidden (403):`, errorDetails);
        console.error(`${endpointName} 403 error details:`, JSON.stringify(errorDetails, null, 2));
        return { isError: true, isRateLimited: false, isForbidden: true };
      }
      
      if (response.value.status !== 200) {
        result.errors.push(`${endpointName} (${symbol}): HTTP ${response.value.status} - ${apiProvider} endpoint`);
        console.error(`${endpointName} HTTP error:`, response.value.status, response.value.data);
        return { isError: true, isRateLimited: false, isForbidden: false };
      }

      // Check for error messages in the response data
      const data = response.value.data;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if ('Error Message' in data || 'message' in data || 'Note' in data) {
          const errorMsg = data['Error Message'] || data['message'] || data['Note'] || 'Unknown error';
          const lowerMsg = errorMsg.toLowerCase();
          const isRateLimit = lowerMsg.includes('rate limit') || lowerMsg.includes('429');
          const isForbidden = lowerMsg.includes('403') || lowerMsg.includes('forbidden') || lowerMsg.includes('premium');
          
          result.errors.push(`${endpointName} (${symbol}): ${errorMsg} - ${apiProvider} endpoint`);
          console.error(`${endpointName} API error:`, errorMsg);
          return { isError: true, isRateLimited: isRateLimit, isForbidden: isForbidden };
        }
      }

      return { isError: false, isRateLimited: false, isForbidden: false };
    };

    // Process cash flow statement data
    const cashFlowCheck = checkResponse(cashFlowResponse, 'Cash Flow', 'FMP');
    if (!cashFlowCheck.isError && cashFlowResponse.status === 'fulfilled' && cashFlowResponse.value.data) {
      const cashFlowData = cashFlowResponse.value.data;
      console.log('Cash flow data:', JSON.stringify(cashFlowData, null, 2));

      // Extract free cash flow and share buybacks
      const freeCashFlowData: Array<{year: string, value: number, change?: number}> = [];
      const buybacksData: Array<{year: string, value: number, change?: number}> = [];

      cashFlowData.forEach((item: any, index: number) => {
        const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
        const period = item.period || 'FY';
        const quarter = item.quarter || 4;
        const label = period === 'Q' ? `${year} Q${quarter}` : year;
        
        // Free Cash Flow = Operating Cash Flow - Capital Expenditures
        const operatingCashFlow = item.netCashProvidedByOperatingActivities || 0;
        const capitalExpenditures = Math.abs(item.capitalExpenditure || 0); // Make positive
        const freeCashFlow = operatingCashFlow - capitalExpenditures;

        if (freeCashFlow !== 0) {
          freeCashFlowData.push({
            year: label,
            value: freeCashFlow,
            change: index > 0 ? 
              (freeCashFlow - freeCashFlowData[index - 1]?.value) / Math.abs(freeCashFlowData[index - 1]?.value || 1) : undefined
          });
        }

        // Share Buybacks = Common Stock Repurchased - Common Stock Issued
        const repurchaseOfStock = Math.abs(item.commonStockRepurchased || 0); // Make positive
        const issuanceOfStock = Math.abs(item.commonStockIssued || 0); // Make positive
        const netBuybacks = repurchaseOfStock - issuanceOfStock;

        if (netBuybacks !== 0) {
          buybacksData.push({
            year: label,
            value: netBuybacks,
            change: index > 0 ? 
              (netBuybacks - buybacksData[index - 1]?.value) / Math.abs(buybacksData[index - 1]?.value || 1) : undefined
          });
        }
      });

      result.freeCashFlow = freeCashFlowData.reverse(); // Most recent first
      result.shareBuybacks = buybacksData.reverse(); // Most recent first

      console.log('Free Cash Flow data:', result.freeCashFlow);
      console.log('Share Buybacks data:', result.shareBuybacks);
    }

    // Process income statement data for revenue and net income
    const incomeCheck = checkResponse(incomeStatementResponse, 'Revenue', 'FMP');
    if (!incomeCheck.isError && incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.status === 200 && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      console.log('Income statement data:', JSON.stringify(incomeData, null, 2));

      // Check if response is an error message from the API (already checked, but double-check)
      if (incomeData && typeof incomeData === 'object' && !Array.isArray(incomeData) && ('Error Message' in incomeData || 'message' in incomeData)) {
        console.log('Income statement API returned error:', incomeData);
        result.errors.push(`Income Statement: ${incomeData['Error Message'] || incomeData['message'] || 'Unknown error'}`);
      } else if (!Array.isArray(incomeData)) {
        console.log('Income statement data is not an array:', typeof incomeData, incomeData);
      } else if (incomeData.length === 0) {
        console.log('Income statement data is empty array');
      } else {
        const revenueData: Array<{year: string, value: number, change?: number}> = [];
        const netIncomeData: Array<{year: string, value: number, change?: number}> = [];
        const operatingIncomeData: Array<{year: string, value: number, change?: number}> = [];
        const netMarginData: Array<{year: string, value: number, change?: number}> = [];
        const grossMarginData: Array<{year: string, value: number, change?: number}> = [];

        // Filter for annual data only (period === 'FY' or no period field means annual)
        const annualData = incomeData.filter((item: any) => {
          const period = item.period;
          return !period || period === 'FY' || period === 'annual';
        });

        console.log(`Filtered ${incomeData.length} income statements to ${annualData.length} annual records`);

        annualData.forEach((item: any, index: number) => {
          const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
          const label = year;
          
          const revenue = item.revenue || item.revenues || 0;
          const netIncome = item.netIncome || 0;
          const operatingIncome = item.operatingIncome || item.operatingIncomeLoss || 0;
          const grossProfit = item.grossProfit || 0;

          // Log if revenue is missing or 0 for debugging
          if (!item.revenue && !item.revenues) {
            console.log(`Revenue missing for ${year}:`, { revenue: item.revenue, revenues: item.revenues, item });
          }

          if (revenue > 0) {
            revenueData.push({
              year: label,
              value: revenue,
              change: index > 0 ? 
                (revenue - revenueData[index - 1]?.value) / revenueData[index - 1]?.value : undefined
            });
          }

          if (netIncome !== 0) { // Allow negative net income
            netIncomeData.push({
              year: label,
              value: netIncome,
              change: index > 0 ? 
                (netIncome - netIncomeData[index - 1]?.value) / Math.abs(netIncomeData[index - 1]?.value || 1) : undefined
            });
          }

          if (operatingIncome !== 0) { // Allow negative operating income
            operatingIncomeData.push({
              year: label,
              value: operatingIncome,
              change: index > 0 ? 
                (operatingIncome - operatingIncomeData[index - 1]?.value) / Math.abs(operatingIncomeData[index - 1]?.value || 1) : undefined
            });
          }

          // Calculate Net Margin (Net Income / Revenue)
          if (revenue > 0 && netIncome !== 0) {
            const netMargin = (netIncome / revenue) * 100; // Convert to percentage
            netMarginData.push({
              year: label,
              value: netMargin,
              change: index > 0 ? 
                (netMargin - netMarginData[index - 1]?.value) / Math.abs(netMarginData[index - 1]?.value || 1) : undefined
            });
          }

          // Calculate Gross Margin (Gross Profit / Revenue)
          if (revenue > 0 && grossProfit !== 0) {
            const grossMargin = (grossProfit / revenue) * 100; // Convert to percentage
            grossMarginData.push({
              year: label,
              value: grossMargin,
              change: index > 0 ? 
                (grossMargin - grossMarginData[index - 1]?.value) / Math.abs(grossMarginData[index - 1]?.value || 1) : undefined
            });
          }
        });

        result.revenue = revenueData.reverse(); // Most recent first
        result.netIncome = netIncomeData.reverse(); // Most recent first
        result.operatingIncome = operatingIncomeData.reverse(); // Most recent first
        result.netMargin = netMarginData.reverse(); // Most recent first
        result.grossMargin = grossMarginData.reverse(); // Most recent first
        console.log('Revenue data:', result.revenue);
        console.log('Net Income data:', result.netIncome);
        console.log('Net Margin data:', result.netMargin);
        console.log('Gross Margin data:', result.grossMargin);
      }
    } else {
      console.log('Income statement data not available or failed');
      if (incomeStatementResponse.status === 'rejected') {
        console.log('Income statement error:', incomeStatementResponse.reason);
      } else if (incomeStatementResponse.status === 'fulfilled') {
        console.log('Income statement response status:', incomeStatementResponse.value.status);
        console.log('Income statement response data:', incomeStatementResponse.value.data);
      }
    }

    // Process portfolio value data (historical stock prices)
    const portfolioCheck = checkResponse(portfolioResponse, 'Historical Prices', 'FMP');
    if (!portfolioCheck.isError && portfolioResponse.status === 'fulfilled' && portfolioResponse.value.data) {
      const portfolioData = portfolioResponse.value.data;
      console.log('Portfolio data:', JSON.stringify(portfolioData, null, 2));

      const portfolioValueData: Array<{year: string, value: number, change?: number}> = [];

      // The historical-price-eod/full endpoint returns data directly as an array
      if (Array.isArray(portfolioData)) {
        // Group by year and take the last price of each year
        const yearlyData: {[year: string]: number} = {};
        
        portfolioData.forEach((item: any) => {
          const year = item.date?.substring(0, 4) || 'Unknown';
          if (year !== 'Unknown' && item.close) {
            yearlyData[year] = item.close;
          }
        });

        // Convert to array and sort by year
        Object.entries(yearlyData)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([year, price], index) => {
            portfolioValueData.push({
              year,
              value: price,
              change: index > 0 ? 
                (price - portfolioValueData[index - 1]?.value) / portfolioValueData[index - 1]?.value : undefined
            });
          });
      }

      result.portfolioValue = portfolioValueData;
      console.log('Portfolio Value data:', result.portfolioValue);
    }

    // Process dividend income data
    const dividendCheck = checkResponse(dividendResponse, 'Dividends', 'FMP');
    if (!dividendCheck.isError && dividendResponse.status === 'fulfilled' && dividendResponse.value.data) {
      const dividendData = dividendResponse.value.data;
      console.log('Dividend data:', JSON.stringify(dividendData, null, 2));

      const dividendIncomeData: Array<{year: string, value: number, change?: number}> = [];

      if (dividendData.historical && Array.isArray(dividendData.historical)) {
        // Group by year and sum dividends
        const yearlyDividends: {[year: string]: number} = {};
        
        dividendData.historical.forEach((item: any) => {
          const year = item.date?.substring(0, 4) || 'Unknown';
          if (year !== 'Unknown' && item.adjDividend) {
            yearlyDividends[year] = (yearlyDividends[year] || 0) + item.adjDividend;
          }
        });

        // Convert to array and sort by year
        Object.entries(yearlyDividends)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([year, totalDividends], index) => {
            dividendIncomeData.push({
              year,
              value: totalDividends,
              change: index > 0 ? 
                (totalDividends - dividendIncomeData[index - 1]?.value) / dividendIncomeData[index - 1]?.value : undefined
            });
          });
      }

      result.dividendIncome = dividendIncomeData;
      console.log('Dividend Income data:', result.dividendIncome);
    }

    // Process shares outstanding data from key metrics
    const keyMetricsCheck = checkResponse(keyMetricsResponse, 'Key Metrics', 'FMP');
    if (!keyMetricsCheck.isError && keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetricsData = keyMetricsResponse.value.data;
      console.log('Key metrics data:', JSON.stringify(keyMetricsData, null, 2));

      const sharesOutstandingData: Array<{year: string, value: number, change?: number}> = [];

      if (Array.isArray(keyMetricsData)) {
        // Create a map to store shares outstanding by year
        const yearlyShares: {[year: string]: number} = {};
        
        keyMetricsData.forEach((item: any) => {
          const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
          const period = item.period || 'FY';
          const quarter = item.quarter || 4;
          const label = period === 'Q' ? `${year} Q${quarter}` : year;
          if (year !== 'Unknown' && item.marketCap) {
            // Calculate shares outstanding from market cap and stock price
            // We'll use the portfolio price data we already have to get accurate calculations
            const portfolioItem = result.portfolioValue.find((p: any) => p.year === year);
            if (portfolioItem && portfolioItem.value) {
              // Shares Outstanding = Market Cap / Stock Price
              const sharesOutstanding = Math.round(item.marketCap / portfolioItem.value);
              yearlyShares[label] = sharesOutstanding;
            } else {
              // Fallback: use market cap in billions as approximation
              const estimatedShares = Math.round(item.marketCap / 1000000000);
              yearlyShares[label] = estimatedShares;
            }
          }
        });

        // Convert to array and sort by year
        Object.entries(yearlyShares)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .forEach(([year, shares], index) => {
            sharesOutstandingData.push({
              year,
              value: shares,
              change: index > 0 ? 
                (shares - sharesOutstandingData[index - 1]?.value) / sharesOutstandingData[index - 1]?.value : undefined
            });
          });
      }

      result.sharesOutstanding = sharesOutstandingData;
      console.log('Shares Outstanding data:', result.sharesOutstanding);
    }

    // Process EPS data from Finnhub
    const epsCheck = checkResponse(epsResponse, 'EPS', 'Finnhub');
    if (!epsCheck.isError && epsResponse.status === 'fulfilled' && epsResponse.value.data) {
      const epsData = epsResponse.value.data;
      console.log('EPS data:', JSON.stringify(epsData, null, 2));
      
      const epsDataArray: ChartData[] = [];
      
      // Extract EPS data from Finnhub response - look for quarterly EPS data
      if (epsData.series && epsData.series.quarterly && epsData.series.quarterly.eps && Array.isArray(epsData.series.quarterly.eps) && epsData.series.quarterly.eps.length > 0) {
        epsData.series.quarterly.eps.forEach((item: any, index: number) => {
          if (item.period && item.v !== undefined) {
            // Parse the period to create a readable format
            const periodDate = new Date(item.period);
            const year = periodDate.getFullYear();
            const month = periodDate.getMonth() + 1;
            const quarter = Math.ceil(month / 3);
            
            epsDataArray.push({
              year: `${year} Q${quarter}`,
              value: item.v,
              change: index > 0 ? 
                (item.v - epsDataArray[index - 1]?.value) / Math.abs(epsDataArray[index - 1]?.value || 1) : undefined
            });
          }
        });
        
        // Sort by year (most recent first)
        epsDataArray.sort((a, b) => {
          const yearA = parseInt(a.year.split(' ')[0]);
          const yearB = parseInt(b.year.split(' ')[0]);
          return yearB - yearA;
        });
        
        // Take only the most recent 20 quarters for better visualization
        result.eps = epsDataArray.slice(0, 20);
      } else {
        console.log('EPS quarterly data is empty or not available');
        console.log('EPS series structure:', epsData.series);
        
        // Try to find EPS data in other parts of the response
        if (epsData.metric && epsData.metric.trailingEPS) {
          const trailingEPS = epsData.metric.trailingEPS;
          const currentDate = new Date();
          
          // Create quarterly data points for the last 4 quarters
          for (let i = 0; i < 4; i++) {
            const quarterDate = new Date(currentDate);
            quarterDate.setMonth(currentDate.getMonth() - (i * 3));
            const year = quarterDate.getFullYear();
            const quarter = Math.ceil((quarterDate.getMonth() + 1) / 3);
            
            epsDataArray.push({
              year: `${year} Q${quarter}`,
              value: trailingEPS,
              change: i > 0 ? 0 : undefined
            });
          }
          
          result.eps = epsDataArray;
        }
      }
      
      console.log('EPS data processed:', result.eps);
    }

    // Check if there were any rate limit errors
    const hasRateLimitErrors = result.errors.some((err: string) => err.toLowerCase().includes('rate limit'));
    if (hasRateLimitErrors) {
      console.warn('Rate limit errors detected:', result.errors.filter((err: string) => err.toLowerCase().includes('rate limit')));
    }

    // Check if there were any forbidden/403 errors
    const hasForbiddenErrors = result.errors.some((err: string) => err.toLowerCase().includes('forbidden') || err.includes('403'));
    if (hasForbiddenErrors) {
      console.warn('Forbidden/403 errors detected (API key may need premium subscription):', result.errors.filter((err: string) => err.toLowerCase().includes('forbidden') || err.includes('403')));
    }

    // Check if we have any data at all
    const hasAnyData = result.revenue.length > 0 || result.freeCashFlow.length > 0 || result.netIncome.length > 0;
    if (!hasAnyData && result.errors.length > 0) {
      console.error('No data returned and errors present:', result.errors);
    }

    console.log('Final graphs result:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching graphs data:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch graphs data', details: error.message },
      { status: 500 }
    );
  }
}
