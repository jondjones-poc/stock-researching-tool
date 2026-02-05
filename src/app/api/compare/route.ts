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

  try {
    // Fetch data from multiple external APIs in parallel
    const [quoteResponse, metricsResponse, profileResponse, incomeStatementResponse, analystEstimatesResponse, keyMetricsResponse, ratiosResponse, finnhubFinancialsResponse] = await Promise.allSettled([
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/income-statement?symbol=${symbol}&limit=5&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/analyst-estimates?symbol=${symbol}&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=5&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/ratios?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FINNHUB_API_KEY ? axios.get(`https://finnhub.io/api/v1/stock/financials-reported?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null })
    ]);

    const result: any = {
      symbol: symbol.toUpperCase(),
      // PE Ratios
      ttmPE: null,
      forwardPE: null,
      twoYearPE: null,
      // EPS Growth
      ttmEPSGrowth: null,
      currentYearExpectedEPSGrowth: null,
      nextYearEPSGrowth: null,
      // Revenue Growth
      ttmRevenueGrowth: null,
      currentYearExpectedRevenueGrowth: null,
      nextYearRevenueGrowth: null,
      // Margins & Ratios
      grossMargin: null,
      netMargin: null,
      ttmPSRatio: null,
      forwardPSRatio: null
    };

    // Process Finnhub Metrics for PE ratios
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      const metrics = metricsResponse.value.data;
      if (metrics.metric) {
        result.ttmPE = metrics.metric.peTTM;
        result.forwardPE = metrics.metric.forwardPE;
        
        // Get EPS growth rates
        if (metrics.metric.epsGrowth1Y) {
          result.currentYearExpectedEPSGrowth = metrics.metric.epsGrowth1Y;
        }
        if (metrics.metric.epsGrowth2Y) {
          result.nextYearEPSGrowth = metrics.metric.epsGrowth2Y;
        }
        if (metrics.metric.epsGrowth3Y && !result.currentYearExpectedEPSGrowth) {
          result.currentYearExpectedEPSGrowth = metrics.metric.epsGrowth3Y;
        }
      }
    }

    // Process Finnhub Profile for forward PE estimates
    if (profileResponse.status === 'fulfilled' && profileResponse.value.data) {
      const profile = profileResponse.value.data;
      if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
        const currentPrice = quoteResponse.value.data.c;
        
        if (profile.estimates && profile.estimates.length > 0) {
          const currentYear = new Date().getFullYear();
          const eps2025 = profile.estimates.find((est: any) => est.period && est.period.includes(String(currentYear)))?.epsAvg;
          const eps2026 = profile.estimates.find((est: any) => est.period && est.period.includes(String(currentYear + 1)))?.epsAvg;
          
          if (eps2025 && currentPrice) {
            result.forwardPE = currentPrice / eps2025;
          }
          if (eps2026 && currentPrice) {
            result.twoYearPE = currentPrice / eps2026;
          }
        }
      }
    }

    // Process Income Statement for revenue growth and margins
    if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      if (Array.isArray(incomeData) && incomeData.length >= 2) {
        const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = sortedData[sortedData.length - 1];
        const previous = sortedData[sortedData.length - 2];
        
        const latestRevenue = latest.revenue || latest.revenues;
        const previousRevenue = previous.revenue || previous.revenues;
        
        // Calculate TTM revenue growth
        if (previousRevenue && previousRevenue > 0 && latestRevenue) {
          result.ttmRevenueGrowth = ((latestRevenue - previousRevenue) / previousRevenue) * 100;
        }
        
        // Calculate net margin
        if (latestRevenue && latestRevenue > 0 && latest.netIncome) {
          result.netMargin = (latest.netIncome / latestRevenue) * 100;
        }
      }
    }

    // Process Finnhub Financials for gross margin
    if (finnhubFinancialsResponse.status === 'fulfilled' && finnhubFinancialsResponse.value.data) {
      const financials = finnhubFinancialsResponse.value.data;
      if (financials.data && financials.data.length > 0) {
        const latestFinancials = financials.data[0];
        if (latestFinancials.report && latestFinancials.report.ic) {
          const incomeStatement = latestFinancials.report.ic;
          
          const revenues = incomeStatement.find((item: any) => 
            item.concept === "us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax" ||
            item.concept === "us-gaap_Revenues" ||
            item.concept === "Revenues" ||
            item.label?.includes("Revenue")
          )?.value;
          
          const costOfGoodsSold = incomeStatement.find((item: any) => 
            item.concept === "us-gaap_CostOfGoodsAndServicesSold" ||
            item.concept === "us-gaap_CostOfRevenue" ||
            item.concept === "CostOfRevenue" ||
            item.label?.includes("Cost of Goods")
          )?.value;
          
          if (revenues && costOfGoodsSold && revenues > 0) {
            const grossProfit = revenues - costOfGoodsSold;
            result.grossMargin = (grossProfit / revenues) * 100;
          }
        }
      }
    }

    // Process Analyst Estimates for revenue growth
    if (analystEstimatesResponse.status === 'fulfilled' && analystEstimatesResponse.value.data) {
      const estimates = analystEstimatesResponse.value.data;
      if (estimates && Array.isArray(estimates) && estimates.length > 0) {
        const currentYear = new Date().getFullYear();
        const currentYearEst = estimates.find((est: any) => est.date && est.date.includes(String(currentYear)));
        const nextYearEst = estimates.find((est: any) => est.date && est.date.includes(String(currentYear + 1)));
        
        if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
          const incomeData = incomeStatementResponse.value.data;
          if (Array.isArray(incomeData) && incomeData.length > 0) {
            const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const lastRevenue = sortedData[sortedData.length - 1].revenue || sortedData[sortedData.length - 1].revenues;
            
            if (currentYearEst && currentYearEst.revenueAvg && lastRevenue && lastRevenue > 0) {
              result.currentYearExpectedRevenueGrowth = ((currentYearEst.revenueAvg - lastRevenue) / lastRevenue) * 100;
            }
            
            if (nextYearEst && currentYearEst && currentYearEst.revenueAvg && currentYearEst.revenueAvg > 0) {
              result.nextYearRevenueGrowth = ((nextYearEst.revenueAvg - currentYearEst.revenueAvg) / currentYearEst.revenueAvg) * 100;
            }
          }
        }
      }
    }

    // Process Key Metrics for P/S ratios
    if (keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetricsData = keyMetricsResponse.value.data;
      if (Array.isArray(keyMetricsData) && keyMetricsData.length > 0) {
        const latestMetrics = keyMetricsData[0];
        const marketCap = latestMetrics.marketCap;
        
        if (incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
          const incomeData = incomeStatementResponse.value.data;
          if (Array.isArray(incomeData) && incomeData.length > 0) {
            const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const latestRevenue = sortedData[sortedData.length - 1].revenue || sortedData[sortedData.length - 1].revenues;
            
            if (marketCap && latestRevenue && latestRevenue > 0) {
              result.ttmPSRatio = marketCap / latestRevenue;
            }
            
            // Forward P/S from analyst estimates
            if (analystEstimatesResponse.status === 'fulfilled' && analystEstimatesResponse.value.data) {
              const estimates = analystEstimatesResponse.value.data;
              if (estimates && Array.isArray(estimates) && estimates.length > 0) {
                const currentYear = new Date().getFullYear();
                const currentYearEst = estimates.find((est: any) => est.date && est.date.includes(String(currentYear)));
                if (currentYearEst && currentYearEst.revenueAvg && currentYearEst.revenueAvg > 0 && marketCap) {
                  result.forwardPSRatio = marketCap / currentYearEst.revenueAvg;
                }
              }
            }
          }
        }
      }
    }

    // Calculate TTM EPS Growth from income statement if not available
    if (!result.ttmEPSGrowth && incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      if (Array.isArray(incomeData) && incomeData.length >= 2) {
        const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latestEPS = sortedData[sortedData.length - 1].eps;
        const previousEPS = sortedData[sortedData.length - 2].eps;
        
        if (previousEPS !== 0 && previousEPS !== null && latestEPS !== null) {
          result.ttmEPSGrowth = ((latestEPS - previousEPS) / Math.abs(previousEPS)) * 100;
        }
      }
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching compare data:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch compare data', details: error.message },
      { status: 500 }
    );
  }
}
