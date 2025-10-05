import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

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
    // Fetch current quote, metrics, and company profile data
    const [quoteResponse, metricsResponse, profileResponse] = await Promise.allSettled([
      axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      axios.get(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${FINNHUB_API_KEY}`, { timeout: 10000 })
    ]);

    const result: any = {
      currentPE: null,
      forwardPE1Year: null,
      forwardPE2Year: null,
      currentPrice: null,
      eps2025: null,
      eps2026: null,
      dividendPerShare: null,
      dividendYield: null,
      dividendGrowthRate: null,
      industryAveragePE: null,
      sector: null
    };

    // Process quote data for current price
    if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
      const quote = quoteResponse.value.data;
      result.currentPrice = quote.c;
      
      console.log('Quote data:', JSON.stringify(quote, null, 2));
    }

    // Process metrics data for PE ratios
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      const metrics = metricsResponse.value.data;
      
      console.log('Metrics data:', JSON.stringify(metrics, null, 2));
      
      if (metrics.metric) {
        // Get current PE ratio from metrics
        if (metrics.metric.peTTM) {
          result.currentPE = metrics.metric.peTTM;
          console.log('Current PE from metrics:', result.currentPE);
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
      }
    } else {
      console.log('Metrics data not available or failed');
      if (metricsResponse.status === 'rejected') {
        console.log('Metrics data error:', metricsResponse.reason);
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
