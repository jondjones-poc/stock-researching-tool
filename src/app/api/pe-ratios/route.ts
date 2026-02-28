import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

// Industry average P/E ratios (based on recent market data)
const INDUSTRY_AVERAGE_PE: { [key: string]: number } = {
  'Restaurants': 20.72,
  'Technology': 25.5,
  'Healthcare': 22.8,
  'Financial Services': 12.4,
  'Consumer Discretionary': 18.9,
  'Consumer Staples': 19.2,
  'Energy': 15.6,
  'Industrials': 17.8,
  'Materials': 16.2,
  'Real Estate': 14.3,
  'Utilities': 18.1,
  'Communication Services': 21.7
};

// Function to get industry average P/E based on sector
function getIndustryAveragePE(sector: string): number | null {
  if (!sector) return null;
  
  // Try exact match first
  if (INDUSTRY_AVERAGE_PE[sector]) {
    return INDUSTRY_AVERAGE_PE[sector];
  }
  
  // Try partial matches for common variations
  const sectorLower = sector.toLowerCase();
  for (const [industry, pe] of Object.entries(INDUSTRY_AVERAGE_PE)) {
    if (sectorLower.includes(industry.toLowerCase()) || industry.toLowerCase().includes(sectorLower)) {
      return pe;
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ error: 'Stock symbol is required' }, { status: 400 });
  }

  if (!FINNHUB_API_KEY) {
    return NextResponse.json({ error: 'FINNHUB_API_KEY environment variable is not set' }, { status: 500 });
  }

  try {
    // Fetch current quote, metrics, company profile, key metrics (for Enterprise Value), and cash flow (for Free Cash Flow)
    const [quoteResponse, metricsResponse, profileResponse, keyMetricsResponse, cashFlowResponse] = await Promise.allSettled([
      axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/cash-flow-statement?symbol=${symbol}&limit=1&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null })
    ]);

    const result: any = {
      currentPE: null,
      forwardPE1Year: null,
      forwardPE2Year: null,
      currentPrice: null,
      marketCap: null,
      enterpriseValue: null,
      freeCashFlow: null,
      epsTTM: null,
      eps2025: null,
      eps2026: null,
      dividendPerShare: null,
      dividendYield: null,
      dividendGrowthRate: null,
      industryAveragePE: null,
      sector: null,
      changePercent: null,
      yearHigh: null,
      yearLow: null
    };

    // Process quote data for current price, market cap, change percent
    // NOTE: Finnhub quote API returns h (daily high) and l (daily low), NOT 52-week high/low
    // We will use Finnhub's metrics API for true 52-week high/low instead of quote.h/quote.l
    if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
      const quote = quoteResponse.value.data;
      result.currentPrice = quote.c;
      // Finnhub quote API returns mc (market cap) field
      result.marketCap = quote.mc !== null && quote.mc !== undefined ? quote.mc : null;
      // Finnhub quote API returns dp (change percent) as a percentage value (e.g., 1.5 = 1.5%)
      result.changePercent = quote.dp !== null && quote.dp !== undefined ? quote.dp : null;
      // DO NOT use quote.h and quote.l - these are daily high/low, not 52-week
      // Year high/low will come from Finnhub metrics (52WeekHigh/52WeekLow)
      
      console.log('Quote data:', JSON.stringify(quote, null, 2));
      console.log('Market Cap from Finnhub Quote (mc):', result.marketCap);
      console.log('Change % from Finnhub:', result.changePercent);
      console.log('NOTE: Finnhub h/l are daily values, not 52-week - using FMP for year high/low');
    }

    // Process metrics data for PE ratios, dividends, and 52-week high/low
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      const metrics = metricsResponse.value.data;
      
      console.log('Metrics data:', JSON.stringify(metrics, null, 2));
      
      if (metrics.metric) {
        // Get TTM EPS from metrics
        if (metrics.metric.epsTTM !== null && metrics.metric.epsTTM !== undefined) {
          result.epsTTM = metrics.metric.epsTTM;
          console.log('TTM EPS from metrics:', result.epsTTM);
        }
        
        // Calculate PE from latest price and TTM EPS (most accurate method)
        if (result.currentPrice && result.epsTTM && result.epsTTM > 0) {
          result.currentPE = result.currentPrice / result.epsTTM;
          console.log('Current PE calculated from price/EPS:', result.currentPE, `(${result.currentPrice} / ${result.epsTTM})`);
        } else if (metrics.metric.peTTM) {
          // Fallback to PE from metrics if we can't calculate
          result.currentPE = metrics.metric.peTTM;
          console.log('Current PE from metrics (fallback):', result.currentPE);
        }
        
        // Get 1-year forward PE from metrics if available
        if (metrics.metric.forwardPE) {
          result.forwardPE1Year = metrics.metric.forwardPE;
          console.log('1-Year Forward PE from metrics:', result.forwardPE1Year);
        }

        // Process dividend information
        if (metrics.metric.dividendPerShareTTM) {
          result.dividendPerShare = metrics.metric.dividendPerShareTTM;
          console.log('Dividend per share:', result.dividendPerShare);
        }
        
        if (metrics.metric.currentDividendYieldTTM) {
          result.dividendYield = metrics.metric.currentDividendYieldTTM;
          console.log('Dividend yield:', result.dividendYield);
        }
        
        if (metrics.metric.dividendGrowthRate5Y) {
          result.dividendGrowthRate = metrics.metric.dividendGrowthRate5Y;
          console.log('Dividend growth rate:', result.dividendGrowthRate);
        }

        // 52-week high/low from Finnhub metrics
        // Finnhub metrics returns true 52-week values as 52WeekHigh / 52WeekLow
        const week52High = (metrics.metric as any)['52WeekHigh'];
        const week52Low = (metrics.metric as any)['52WeekLow'];

        if (week52High !== null && week52High !== undefined && typeof week52High === 'number' && week52High > 0) {
          result.yearHigh = week52High;
          console.log('52-week high from Finnhub metrics (52WeekHigh):', result.yearHigh);
        }

        if (week52Low !== null && week52Low !== undefined && typeof week52Low === 'number' && week52Low > 0) {
          result.yearLow = week52Low;
          console.log('52-week low from Finnhub metrics (52WeekLow):', result.yearLow);
        }

        // Get Enterprise Value from Finnhub metrics if available
        const enterpriseValue = (metrics.metric as any).enterpriseValue;
        if (enterpriseValue !== null && enterpriseValue !== undefined && typeof enterpriseValue === 'number' && enterpriseValue > 0) {
          result.enterpriseValue = enterpriseValue * 1000000; // Convert from millions to actual value
          console.log('Enterprise Value from Finnhub metrics:', result.enterpriseValue);
        }
      }
    } else {
      console.log('Metrics data not available or failed');
      if (metricsResponse.status === 'rejected') {
        console.log('Metrics data error:', metricsResponse.reason);
      }
    }

    // Get Market Cap from FMP Key Metrics if not available from Finnhub
    if (!result.marketCap && keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      if (Array.isArray(keyMetricsResponse.value.data) && keyMetricsResponse.value.data.length > 0) {
        const latestMetrics = keyMetricsResponse.value.data[0];
        if (latestMetrics.marketCap !== null && latestMetrics.marketCap !== undefined && latestMetrics.marketCap > 0) {
          result.marketCap = latestMetrics.marketCap;
          console.log('Market Cap from FMP Key Metrics:', result.marketCap);
        }
      }
    }

    // Get Enterprise Value from FMP Key Metrics if not available from Finnhub
    if (!result.enterpriseValue && keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      if (Array.isArray(keyMetricsResponse.value.data) && keyMetricsResponse.value.data.length > 0) {
        const latestMetrics = keyMetricsResponse.value.data[0];
        if (latestMetrics.enterpriseValue !== null && latestMetrics.enterpriseValue !== undefined) {
          result.enterpriseValue = latestMetrics.enterpriseValue;
          console.log('Enterprise Value from FMP Key Metrics:', result.enterpriseValue);
        }
      }
    }

    // Get Free Cash Flow from FMP Cash Flow Statement
    if (cashFlowResponse.status === 'fulfilled' && cashFlowResponse.value.data) {
      if (Array.isArray(cashFlowResponse.value.data) && cashFlowResponse.value.data.length > 0) {
        const latestCashFlow = cashFlowResponse.value.data[0];
        // Free Cash Flow = Operating Cash Flow - Capital Expenditures
        const operatingCashFlow = latestCashFlow.netCashProvidedByOperatingActivities || 0;
        const capitalExpenditures = Math.abs(latestCashFlow.capitalExpenditure || 0);
        const freeCashFlow = operatingCashFlow - capitalExpenditures;
        
        if (freeCashFlow !== 0) {
          result.freeCashFlow = freeCashFlow;
          console.log('Free Cash Flow from FMP:', result.freeCashFlow, `(Operating: ${operatingCashFlow}, CapEx: ${capitalExpenditures})`);
        }
      }
    }

    // Process company profile data for sector information and earnings estimates
    if (profileResponse.status === 'fulfilled' && profileResponse.value.data) {
      const profile = profileResponse.value.data;
      
      console.log('Company profile data:', JSON.stringify(profile, null, 2));
      
      if (profile.finnhubIndustry) {
        result.sector = profile.finnhubIndustry;
        result.industryAveragePE = getIndustryAveragePE(profile.finnhubIndustry);
        
        console.log('Company sector:', result.sector);
        console.log('Industry average PE:', result.industryAveragePE);
      }

      // Process earnings estimates if available
      if (profile.estimates && profile.estimates.length > 0) {
        // Find 2025 and 2026 EPS estimates
        const eps2025 = profile.estimates.find((est: any) => est.period && est.period.includes('2025'))?.epsAvg;
        const eps2026 = profile.estimates.find((est: any) => est.period && est.period.includes('2026'))?.epsAvg;
        
        if (eps2025 && result.currentPrice) {
          result.eps2025 = eps2025;
          result.forwardPE1Year = result.currentPrice / eps2025;
          console.log('1-Year Forward PE calculated from earnings estimates:', result.forwardPE1Year);
          console.log('EPS 2025 from estimates:', eps2025);
        }
        
        if (eps2026 && result.currentPrice) {
          result.eps2026 = eps2026;
          result.forwardPE2Year = result.currentPrice / eps2026;
          console.log('2-Year Forward PE calculated from earnings estimates:', result.forwardPE2Year);
          console.log('EPS 2026 from estimates:', eps2026);
        }
      }
    } else {
      console.log('Company profile data not available or failed');
      if (profileResponse.status === 'rejected') {
        console.log('Company profile error:', profileResponse.reason);
      }
    }

    // Calculate forward PE using EPS growth rates from metrics (only if earnings estimates not available)
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data && result.currentPrice && !result.forwardPE1Year) {
      const metrics = metricsResponse.value.data;
      
      if (metrics.metric && metrics.metric.epsTTM && metrics.metric.epsGrowth3Y) {
        const currentEPS = metrics.metric.epsTTM;
        const growthRate = metrics.metric.epsGrowth3Y / 100; // Convert percentage to decimal
        
        // Calculate 1-year forward EPS and PE
        const projectedEPS1Year = currentEPS * (1 + growthRate);
        result.eps2025 = projectedEPS1Year;
        result.forwardPE1Year = result.currentPrice / projectedEPS1Year;
        console.log('1-Year Forward PE calculated from growth (fallback):', result.forwardPE1Year);
        console.log('Projected EPS 1-year:', projectedEPS1Year);
        
        // Calculate 2-year forward EPS and PE
        const projectedEPS2Year = currentEPS * Math.pow(1 + growthRate, 2);
        result.eps2026 = projectedEPS2Year;
        result.forwardPE2Year = result.currentPrice / projectedEPS2Year;
        console.log('2-Year Forward PE calculated from growth (fallback):', result.forwardPE2Year);
        console.log('Projected EPS 2-year:', projectedEPS2Year);
        console.log('Growth rate used:', growthRate * 100 + '%');
      }
    }

    console.log('Final PE ratios result:', result);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error fetching PE ratios:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch PE ratio data', details: error.message },
      { status: 500 }
    );
  }
}
