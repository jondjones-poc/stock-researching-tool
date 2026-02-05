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

  if (!FMP_API_KEY && !FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY or FINNHUB_API_KEY environment variable is required' }, { status: 500 });
  }

  try {
    console.log(`Fetching key metrics for ${symbol}`);
    
    // Fetch key metrics, financial ratios from FMP, and Finnhub metrics in parallel
    const [metricsResponse, ratiosResponse, finnhubMetricsResponse] = await Promise.allSettled([
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/ratios?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null })
    ]);

    const result: any = {
      sharesOutstanding: null,
      symbol: symbol.toUpperCase(),
      date: null,
      marketCap: null,
      enterpriseValue: null,
      roic: null,
      payoutRatio: null
    };

    // Process FMP Key Metrics data (primary source)
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      if (Array.isArray(metricsResponse.value.data) && metricsResponse.value.data.length > 0) {
        const latestMetrics = metricsResponse.value.data[0];
        
        console.log(`Key Metrics data for ${symbol}:`, JSON.stringify(latestMetrics, null, 2));
        
        // Extract shares outstanding (number of shares) - try multiple field names
        result.sharesOutstanding = latestMetrics.numberOfShares || latestMetrics.sharesOutstanding || latestMetrics.sharesFloat;
        result.date = latestMetrics.date;
        result.marketCap = latestMetrics.marketCap;
        result.enterpriseValue = latestMetrics.enterpriseValue;
        // ROIC can be 0, so check explicitly for null/undefined
        result.roic = (latestMetrics.roic !== null && latestMetrics.roic !== undefined) ? latestMetrics.roic : null;
        
        console.log(`Shares outstanding for ${symbol}:`, result.sharesOutstanding);
        console.log(`ROIC from FMP Key Metrics for ${symbol}:`, result.roic);
      }
    } else if (metricsResponse.status === 'rejected') {
      const error = metricsResponse.reason?.response?.status === 429 
        ? 'Rate limit exceeded. Please try again later.'
        : metricsResponse.reason?.message || 'Request failed';
      console.log(`Key Metrics API error for ${symbol}:`, error);
      if (!result.error) result.error = error;
    }

    // Fallback: Get ROIC from FMP Ratios if not available from Key Metrics
    if (!result.roic && ratiosResponse.status === 'fulfilled' && ratiosResponse.value.data) {
      if (Array.isArray(ratiosResponse.value.data) && ratiosResponse.value.data.length > 0) {
        const latestRatios = ratiosResponse.value.data[0];
        if (latestRatios.roic !== null && latestRatios.roic !== undefined) {
          result.roic = latestRatios.roic;
          console.log(`ROIC from FMP Ratios for ${symbol}:`, result.roic);
        }
      }
    }

    // Fallback: Get ROIC from Finnhub Metrics if not available from FMP
    if (!result.roic && finnhubMetricsResponse.status === 'fulfilled' && finnhubMetricsResponse.value.data) {
      const finnhubData = finnhubMetricsResponse.value.data;
      if (finnhubData.metric && finnhubData.metric.roic !== null && finnhubData.metric.roic !== undefined) {
        result.roic = finnhubData.metric.roic;
        console.log(`ROIC from Finnhub Metrics for ${symbol}:`, result.roic);
      }
    }

    // Fallback: Try to calculate ROIC from FMP income statement and balance sheet if available
    if (!result.roic && FMP_API_KEY) {
      try {
        const [incomeStatementRes, balanceSheetRes] = await Promise.allSettled([
          axios.get(`https://financialmodelingprep.com/stable/income-statement?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 }),
          axios.get(`https://financialmodelingprep.com/stable/balance-sheet-statement?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 })
        ]);

        if (incomeStatementRes.status === 'fulfilled' && incomeStatementRes.value.data && 
            balanceSheetRes.status === 'fulfilled' && balanceSheetRes.value.data) {
          const incomeStatement = incomeStatementRes.value.data[0];
          const balanceSheet = balanceSheetRes.value.data[0];

          // ROIC = NOPAT / Invested Capital
          // NOPAT = Operating Income * (1 - Tax Rate)
          // Invested Capital = Total Assets - Cash - Current Liabilities (non-interest bearing)
          
          const operatingIncome = incomeStatement.operatingIncome || incomeStatement.ebitda;
          const netIncome = incomeStatement.netIncome;
          const totalAssets = balanceSheet.totalAssets;
          const cash = balanceSheet.cashAndCashEquivalents || balanceSheet.cashAndShortTermInvestments || 0;
          const currentLiabilities = balanceSheet.totalCurrentLiabilities || 0;
          const totalDebt = balanceSheet.totalDebt || 0;
          const totalEquity = balanceSheet.totalStockholdersEquity || 0;

          // Calculate tax rate (simplified: use effective tax rate from income statement)
          let taxRate = 0.21; // Default corporate tax rate
          if (operatingIncome && netIncome && operatingIncome > 0) {
            // Estimate tax rate: (Operating Income - Net Income) / Operating Income
            const estimatedTax = operatingIncome - netIncome;
            if (estimatedTax > 0 && estimatedTax < operatingIncome) {
              taxRate = estimatedTax / operatingIncome;
            }
          }

          // Calculate NOPAT (Net Operating Profit After Tax)
          let nopat = null;
          if (operatingIncome && operatingIncome > 0) {
            nopat = operatingIncome * (1 - taxRate);
          }

          // Calculate Invested Capital
          // Method 1: Total Assets - Cash - Current Liabilities
          // Method 2: Total Debt + Total Equity - Cash
          let investedCapital = null;
          if (totalAssets && totalAssets > 0) {
            investedCapital = totalAssets - cash - (currentLiabilities * 0.5); // Assume 50% of current liabilities are non-interest bearing
          } else if (totalDebt && totalEquity) {
            investedCapital = totalDebt + totalEquity - cash;
          }

          // Calculate ROIC
          if (nopat && investedCapital && investedCapital > 0) {
            result.roic = nopat / investedCapital;
            console.log(`Calculated ROIC for ${symbol}: ${result.roic} (NOPAT: ${nopat}, Invested Capital: ${investedCapital})`);
          }
        }
      } catch (calcError) {
        console.log(`Could not calculate ROIC for ${symbol}:`, calcError);
      }
    }

    // Get annual payout ratio from financial ratios endpoint only (full-year data)
    if (ratiosResponse.status === 'fulfilled' && ratiosResponse.value.data && ratiosResponse.value.data.length > 0) {
      const latestRatios = ratiosResponse.value.data[0];
      result.payoutRatio = latestRatios.payoutRatio || latestRatios.dividendPayoutRatio;
      console.log(`Annual Payout Ratio from ratios endpoint for ${symbol}:`, result.payoutRatio);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching key metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch key metrics data' },
      { status: 500 }
    );
  }
}
