import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY environment variable is not set' }, { status: 500 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    // Calculate date range for 10 years
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(toDate.getFullYear() - 10);
    
    // Fetch all data in parallel
    const [cashFlowResponse, incomeStatementResponse, portfolioResponse, dividendResponse, keyMetricsResponse] = await Promise.allSettled([
      axios.get(`https://financialmodelingprep.com/api/v3/cash-flow-statement/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/income-statement/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      // Use FMP for historical prices since Finnhub has access restrictions
      axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/${symbol}?from=${fromDate.toISOString().split('T')[0]}&to=${toDate.toISOString().split('T')[0]}&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${symbol}?apikey=${FMP_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://financialmodelingprep.com/api/v3/key-metrics/${symbol}?limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      freeCashFlow: [],
      shareBuybacks: [],
      revenue: [],
      netIncome: [],
      portfolioValue: [],
      dividendIncome: [],
      sharesOutstanding: []
    };

    // Process cash flow statement data
    if (cashFlowResponse.status === 'fulfilled' && cashFlowResponse.value.data) {
      const cashFlowData = cashFlowResponse.value.data;
      console.log('Cash flow data:', JSON.stringify(cashFlowData, null, 2));

      // Extract free cash flow and share buybacks
      const freeCashFlowData: Array<{year: string, value: number, change?: number}> = [];
      const buybacksData: Array<{year: string, value: number, change?: number}> = [];

      cashFlowData.forEach((item: any, index: number) => {
        const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
        
        // Free Cash Flow = Operating Cash Flow - Capital Expenditures
        const operatingCashFlow = item.netCashProvidedByOperatingActivities || 0;
        const capitalExpenditures = Math.abs(item.capitalExpenditure || 0); // Make positive
        const freeCashFlow = operatingCashFlow - capitalExpenditures;

        if (freeCashFlow !== 0) {
          freeCashFlowData.push({
            year,
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
            year,
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
    } else {
      console.log('Cash flow data not available or failed');
      if (cashFlowResponse.status === 'rejected') {
        console.log('Cash flow error:', cashFlowResponse.reason);
      }
    }

    // Process income statement data for revenue and net income
    if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      console.log('Income statement data:', JSON.stringify(incomeData, null, 2));

      const revenueData: Array<{year: string, value: number, change?: number}> = [];
      const netIncomeData: Array<{year: string, value: number, change?: number}> = [];

      incomeData.forEach((item: any, index: number) => {
        const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
        const revenue = item.revenue || 0;
        const netIncome = item.netIncome || 0;

        if (revenue > 0) {
          revenueData.push({
            year,
            value: revenue,
            change: index > 0 ? 
              (revenue - revenueData[index - 1]?.value) / revenueData[index - 1]?.value : undefined
          });
        }

        if (netIncome !== 0) { // Allow negative net income
          netIncomeData.push({
            year,
            value: netIncome,
            change: index > 0 ? 
              (netIncome - netIncomeData[index - 1]?.value) / Math.abs(netIncomeData[index - 1]?.value || 1) : undefined
          });
        }
      });

      result.revenue = revenueData.reverse(); // Most recent first
      result.netIncome = netIncomeData.reverse(); // Most recent first
      console.log('Revenue data:', result.revenue);
      console.log('Net Income data:', result.netIncome);
    } else {
      console.log('Income statement data not available or failed');
      if (incomeStatementResponse.status === 'rejected') {
        console.log('Income statement error:', incomeStatementResponse.reason);
      }
    }

    // Process portfolio value data (historical stock prices)
    if (portfolioResponse.status === 'fulfilled' && portfolioResponse.value.data) {
      const portfolioData = portfolioResponse.value.data;
      console.log('Portfolio data:', JSON.stringify(portfolioData, null, 2));

      const portfolioValueData: Array<{year: string, value: number, change?: number}> = [];

      if (portfolioData.historical && Array.isArray(portfolioData.historical)) {
        // Group by year and take the last price of each year
        const yearlyData: {[year: string]: number} = {};
        
        portfolioData.historical.forEach((item: any) => {
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
    } else {
      console.log('Portfolio data not available or failed');
      if (portfolioResponse.status === 'rejected') {
        console.log('Portfolio error:', portfolioResponse.reason);
      }
    }

    // Process dividend income data
    if (dividendResponse.status === 'fulfilled' && dividendResponse.value.data) {
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
    } else {
      console.log('Dividend data not available or failed');
      if (dividendResponse.status === 'rejected') {
        console.log('Dividend error:', dividendResponse.reason);
      }
    }

    // Process shares outstanding data from key metrics
    if (keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetricsData = keyMetricsResponse.value.data;
      console.log('Key metrics data:', JSON.stringify(keyMetricsData, null, 2));

      const sharesOutstandingData: Array<{year: string, value: number, change?: number}> = [];

      if (Array.isArray(keyMetricsData)) {
        // Create a map to store shares outstanding by year
        const yearlyShares: {[year: string]: number} = {};
        
        keyMetricsData.forEach((item: any) => {
          const year = item.calendarYear || item.date?.substring(0, 4) || 'Unknown';
          if (year !== 'Unknown' && item.marketCap) {
            // Calculate shares outstanding from market cap and stock price
            // We'll use the portfolio price data we already have to get accurate calculations
            const portfolioItem = result.portfolioValue.find((p: any) => p.year === year);
            if (portfolioItem && portfolioItem.value) {
              // Shares Outstanding = Market Cap / Stock Price
              const sharesOutstanding = Math.round(item.marketCap / portfolioItem.value);
              yearlyShares[year] = sharesOutstanding;
            } else {
              // Fallback: use market cap in billions as approximation
              const estimatedShares = Math.round(item.marketCap / 1000000000);
              yearlyShares[year] = estimatedShares;
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
    } else {
      console.log('Key metrics data not available or failed');
      if (keyMetricsResponse.status === 'rejected') {
        console.log('Key metrics error:', keyMetricsResponse.reason);
      }
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
