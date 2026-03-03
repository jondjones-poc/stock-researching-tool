import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

const LOW_YIELD = 0.015; // 1.5%
const MID_YIELD = 0.03; // 3%
const BUYBACK_HEAVY = -0.10; // Shares down 10%+ in ~5y

/**
 * Get 5-year share change using SEC EDGAR XBRL API
 * @param ticker Stock ticker symbol
 * @returns Object with latestShares, shares5Yago, shareChange5Y, or null if insufficient data
 */
async function getFiveYearShareChange(ticker: string): Promise<{
  ticker: string;
  latestShares: number;
  shares5Yago: number;
  shareChange5Y: number;
} | null> {
  try {
    // Step 1: Fetch SEC ticker → CIK mapping
    const tickersResponse = await axios.get('https://www.sec.gov/files/company_tickers.json', {
      headers: {
        'User-Agent': 'ShareResearchApp research@example.com',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    const tickersData = tickersResponse.data;
    if (!tickersData || typeof tickersData !== 'object') {
      console.error('[SEC EDGAR] Invalid tickers data structure');
      return null;
    }

    // Step 2: Find the object where ticker matches (case insensitive)
    const tickerUpper = ticker.toUpperCase();
    let cikStr: string | null = null;

    // The data structure is an object with numeric keys, each containing ticker and cik_str
    for (const key in tickersData) {
      const entry = tickersData[key];
      if (entry && entry.ticker && entry.ticker.toUpperCase() === tickerUpper) {
        cikStr = entry.cik_str;
        break;
      }
    }

    if (!cikStr) {
      console.error(`[SEC EDGAR] Ticker ${ticker} not found in SEC company tickers`);
      return null;
    }

    // Step 3 & 4: Convert cik_str to 10-digit string with leading zeros
    const cik = cikStr.toString().padStart(10, '0');

    // Step 5: Call SEC company facts endpoint
    const companyFactsResponse = await axios.get(
      `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`,
      {
        headers: {
          'User-Agent': 'ShareResearchApp research@example.com',
          'Accept': 'application/json'
        },
        timeout: 15000
      }
    );

    const companyFacts = companyFactsResponse.data;
    if (!companyFacts || !companyFacts.facts || !companyFacts.facts['us-gaap']) {
      console.error('[SEC EDGAR] Invalid company facts structure');
      return null;
    }

    // Step 6 & 7: Extract shares outstanding data
    const usGaap = companyFacts.facts['us-gaap'];
    
    // Try WeightedAverageNumberOfDilutedSharesOutstanding first
    let sharesData = usGaap['WeightedAverageNumberOfDilutedSharesOutstanding'];
    
    // Fallback to CommonStockSharesOutstanding if diluted shares don't exist
    if (!sharesData) {
      sharesData = usGaap['CommonStockSharesOutstanding'];
    }

    if (!sharesData || !sharesData.units || !sharesData.units.shares) {
      console.error('[SEC EDGAR] No shares outstanding data found in company facts');
      return null;
    }

    // Step 8: Filter for annual filings only (form = "10-K")
    const annualData: Array<{ end: string; val: number; form: string }> = [];
    
    // Handle different possible structures of units.shares
    const sharesUnits = sharesData.units.shares;
    
    if (Array.isArray(sharesUnits)) {
      // If it's an array, iterate through it
      for (const entry of sharesUnits) {
        // Entry could be an object directly, or an array of objects
        if (entry && typeof entry === 'object') {
          if (Array.isArray(entry)) {
            // If entry is an array, iterate through it
            for (const item of entry) {
              if (item && item.form === '10-K' && item.val !== null && item.val !== undefined) {
                annualData.push({
                  end: item.end,
                  val: item.val,
                  form: item.form
                });
              }
            }
          } else {
            // Entry is an object directly
            if (entry.form === '10-K' && entry.val !== null && entry.val !== undefined) {
              annualData.push({
                end: entry.end,
                val: entry.val,
                form: entry.form
              });
            }
          }
        }
      }
    } else if (sharesUnits && typeof sharesUnits === 'object') {
      // If it's an object (keyed by unit type), iterate through values
      for (const key in sharesUnits) {
        const unitArray = sharesUnits[key];
        if (Array.isArray(unitArray)) {
          for (const entry of unitArray) {
            if (entry && entry.form === '10-K' && entry.val !== null && entry.val !== undefined) {
              annualData.push({
                end: entry.end,
                val: entry.val,
                form: entry.form
              });
            }
          }
        }
      }
    }

    if (annualData.length < 5) {
      console.error(`[SEC EDGAR] Insufficient annual data points: ${annualData.length} (need at least 5)`);
      return null;
    }

    // Step 9: Sort by fiscal year (end date)
    annualData.sort((a, b) => {
      const dateA = new Date(a.end);
      const dateB = new Date(b.end);
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });

    // Step 10: Get most recent and ~5 fiscal years ago
    const latestShares = annualData[0].val;
    const shares5Yago = annualData.length >= 5 ? annualData[4].val : annualData[annualData.length - 1].val;

    if (!latestShares || !shares5Yago || shares5Yago <= 0) {
      console.error('[SEC EDGAR] Invalid share values');
      return null;
    }

    // Step 11: Compute share change
    const shareChange5Y = (latestShares - shares5Yago) / shares5Yago;

    // Step 12: Return result
    return {
      ticker: ticker.toUpperCase(),
      latestShares,
      shares5Yago,
      shareChange5Y
    };

  } catch (error: any) {
    console.error(`[SEC EDGAR] Error fetching 5-year share change for ${ticker}:`, error.message);
    return null;
  }
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
    // Fetch current price, dividend data, shares outstanding (using same approach as research page), and historical data
    const [quoteResponse, metricsResponse, fmpProfileResponse, fmpShareFloatResponse, keyMetricsResponse] = await Promise.allSettled([
      // Current price from Finnhub quote
      axios.get(`https://finnhub.io/api/v1/quote?symbol=${symbol.toUpperCase()}&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      // Metrics for dividend data
      axios.get(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol.toUpperCase()}&metric=all&token=${FINNHUB_API_KEY}`, { timeout: 10000 }),
      // FMP Profile API (priority source for current shares outstanding)
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/api/v3/profile/${symbol.toUpperCase()}?apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      // FMP Share Float API (fallback for current shares outstanding)
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/api/v4/shares_float?symbol=${symbol.toUpperCase()}&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null }),
      // Historical key metrics for shares outstanding 5y ago (FMP)
      FMP_API_KEY ? axios.get(`https://financialmodelingprep.com/stable/key-metrics?symbol=${symbol.toUpperCase()}&limit=10&apikey=${FMP_API_KEY}`, { timeout: 10000 }) : Promise.resolve({ data: null })
    ]);

    let currentPrice: number | null = null;
    let annualDividendPerShare: number | null = null;
    let sharesOutstandingNow: number | null = null;
    let sharesOutstanding5yAgo: number | null = null;

    // Process quote data for current price
    if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
      const quote = quoteResponse.value.data;
      const price = quote.c;
      if (price !== null && price !== undefined && !isNaN(price) && isFinite(price) && price > 0) {
        currentPrice = Number(price);
      } else {
        currentPrice = null;
      }
    }

    // Process metrics data for dividend
    if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
      const metrics = metricsResponse.value.data;
      if (metrics.metric) {
        // Try multiple fields for dividend per share
        if (metrics.metric.dividendPerShare !== null && metrics.metric.dividendPerShare !== undefined && !isNaN(metrics.metric.dividendPerShare)) {
          annualDividendPerShare = Number(metrics.metric.dividendPerShare);
        } else if (metrics.metric.dividendPerShareAnnual !== null && metrics.metric.dividendPerShareAnnual !== undefined && !isNaN(metrics.metric.dividendPerShareAnnual)) {
          annualDividendPerShare = Number(metrics.metric.dividendPerShareAnnual);
        } else if (metrics.metric.dividendYield !== null && metrics.metric.dividendYield !== undefined && !isNaN(metrics.metric.dividendYield) && currentPrice && currentPrice > 0) {
          // Calculate from yield: yield is typically a percentage (e.g., 2.5 = 2.5%)
          // Convert to decimal and multiply by price
          const yieldValue = Number(metrics.metric.dividendYield);
          const yieldDecimal = yieldValue / 100;
          annualDividendPerShare = yieldDecimal * currentPrice;
        }
      }
    }
    
    // Ensure annualDividendPerShare is a valid number or null
    if (annualDividendPerShare !== null && (!isFinite(annualDividendPerShare) || isNaN(annualDividendPerShare) || annualDividendPerShare < 0)) {
      annualDividendPerShare = null;
    }

    // Process shares outstanding using same priority as research page:
    // 1. FMP Profile API (priority)
    // 2. FMP Share Float API
    // 3. Finnhub Metrics API (calculated from market cap / price)
    // 4. FMP Key Metrics API (fallback)
    
    // Try FMP Profile API first (priority source)
    if (fmpProfileResponse.status === 'fulfilled' && fmpProfileResponse.value.data) {
      if (Array.isArray(fmpProfileResponse.value.data) && fmpProfileResponse.value.data.length > 0) {
        const profile = fmpProfileResponse.value.data[0];
        const profileShares = profile.sharesOutstanding || profile.sharesFloat || profile.numberOfShares;
        if (profileShares !== null && profileShares !== undefined && typeof profileShares === 'number') {
          sharesOutstandingNow = profileShares;
        }
      }
    }
    
    // Try FMP Share Float API if profile didn't have it
    if (!sharesOutstandingNow && fmpShareFloatResponse.status === 'fulfilled' && fmpShareFloatResponse.value.data) {
      const shareFloatData = fmpShareFloatResponse.value.data;
      const shareFloat = Array.isArray(shareFloatData) ? shareFloatData[0] : shareFloatData;
      if (shareFloat) {
        const shares = shareFloat.sharesOutstanding || shareFloat.numberOfShares || shareFloat.totalShares || shareFloat.sharesFloat;
        if (shares !== null && shares !== undefined && typeof shares === 'number') {
          sharesOutstandingNow = shares;
        }
      }
    }
    
    // Try Finnhub Metrics API (calculate from market cap / price) - reuse existing responses
    if (!sharesOutstandingNow && metricsResponse.status === 'fulfilled' && quoteResponse.status === 'fulfilled') {
      const metricsData = metricsResponse.value.data;
      const quoteData = quoteResponse.value.data;
      
      if (metricsData && metricsData.metric && quoteData) {
        const marketCap = metricsData.metric.marketCapitalization;
        const price = quoteData.c;
        
        if (marketCap && price && marketCap > 0 && price > 0) {
          // Market cap is in millions, convert to actual value
          const marketCapActual = marketCap * 1000000;
          sharesOutstandingNow = Math.round(marketCapActual / price);
        }
      }
    }
    
    // Try FMP Key Metrics API as fallback for current shares outstanding
    if (!sharesOutstandingNow && keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetrics = keyMetricsResponse.value.data;
      if (Array.isArray(keyMetrics) && keyMetrics.length > 0) {
        const latest = keyMetrics[0];
        sharesOutstandingNow = latest.numberOfShares || latest.sharesOutstanding || latest.sharesFloat || null;
      }
    }
    
    // Check if shares outstanding is in millions (like research page does)
    // If it's less than 10,000, it's likely in millions
    if (sharesOutstandingNow !== null && sharesOutstandingNow !== undefined && sharesOutstandingNow > 0 && sharesOutstandingNow < 10000) {
      sharesOutstandingNow = Math.round(sharesOutstandingNow * 1000000);
    }
    
    // Debug logging for shares outstanding
    console.log(`[Value Driver Classification] Shares Outstanding for ${symbol.toUpperCase()}:`, {
      sharesOutstandingNow,
      sharesOutstanding5yAgo,
      fmpProfileStatus: fmpProfileResponse.status,
      fmpShareFloatStatus: fmpShareFloatResponse.status,
      keyMetricsStatus: keyMetricsResponse.status
    });

    // Process historical key metrics for shares outstanding 5y ago
    if (keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetrics = keyMetricsResponse.value.data;
      if (Array.isArray(keyMetrics) && keyMetrics.length > 0) {
        // Find shares outstanding ~5 years ago (oldest available point ≥ 4.5y)
        const now = new Date();
        
        for (const metric of keyMetrics) {
          if (metric.date) {
            const metricDate = new Date(metric.date);
            const yearsDiff = (now.getTime() - metricDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            
            // Find the oldest point that's at least 4.5 years ago
            if (yearsDiff >= 4.5) {
              sharesOutstanding5yAgo = metric.numberOfShares || metric.sharesOutstanding || metric.sharesFloat || null;
              // Check if shares outstanding is in millions (like research page does)
              if (sharesOutstanding5yAgo !== null && sharesOutstanding5yAgo > 0 && sharesOutstanding5yAgo < 10000) {
                sharesOutstanding5yAgo = Math.round(sharesOutstanding5yAgo * 1000000);
              }
              break;
            }
          }
        }
      }
    }

    // If FMP didn't provide 5-year data, try SEC EDGAR API as fallback
    let secData: { latestShares: number; shares5Yago: number; shareChange5Y: number } | null = null;
    if (!sharesOutstanding5yAgo) {
      console.log(`[Value Driver Classification] FMP did not provide 5-year data for ${symbol.toUpperCase()}, trying SEC EDGAR API...`);
      secData = await getFiveYearShareChange(symbol.toUpperCase());
      
      if (secData) {
        console.log(`[Value Driver Classification] SEC EDGAR data retrieved for ${symbol.toUpperCase()}:`, {
          latestShares: secData.latestShares,
          shares5Yago: secData.shares5Yago,
          shareChange5Y: secData.shareChange5Y
        });
        
        // Use SEC data for 5-year ago shares outstanding
        sharesOutstanding5yAgo = secData.shares5Yago;
        
        // If we don't have current shares outstanding, use the latest from SEC
        if (!sharesOutstandingNow) {
          sharesOutstandingNow = secData.latestShares;
        }
      } else {
        console.log(`[Value Driver Classification] SEC EDGAR API also did not provide data for ${symbol.toUpperCase()}`);
      }
    }

    // Calculate dividend yield
    // If dividend data is missing, treat yield as 0
    let dividendYield = 0;
    if (currentPrice && currentPrice > 0 && annualDividendPerShare !== null && annualDividendPerShare !== undefined && annualDividendPerShare > 0) {
      dividendYield = annualDividendPerShare / currentPrice;
    }
    
    // Ensure dividendYield is a valid number (not NaN or Infinity)
    if (!isFinite(dividendYield) || isNaN(dividendYield)) {
      dividendYield = 0;
    }
    
    // Debug logging
    console.log(`[Value Driver Classification] ${symbol.toUpperCase()}:`, {
      currentPrice,
      annualDividendPerShare,
      dividendYield,
      dividendYieldPercent: dividendYield * 100,
      sharesOutstandingNow,
      sharesOutstanding5yAgo
    });

    // Calculate 5-year share change
    // IMPORTANT: Always derive this from the final sharesOutstandingNow and sharesOutstanding5yAgo
    // so that the reported percentage is mathematically consistent with the values shown in the UI.
    let shareChange5y: number | null = null;
    if (sharesOutstandingNow && sharesOutstanding5yAgo && sharesOutstanding5yAgo > 0) {
      shareChange5y = (sharesOutstandingNow - sharesOutstanding5yAgo) / sharesOutstanding5yAgo;
    }

    // Check if essential data is missing
    const hasCurrentPrice = currentPrice !== null && currentPrice !== undefined && currentPrice > 0;
    const hasShareData = sharesOutstandingNow !== null && sharesOutstandingNow !== undefined && sharesOutstandingNow > 0;
    const hasShareData5yAgo = sharesOutstanding5yAgo !== null && sharesOutstanding5yAgo !== undefined && sharesOutstanding5yAgo > 0;
    
    // Determine if we have enough data to make a classification
    // We need: current price, current shares outstanding, AND 5-year historical shares outstanding
    // Note: Dividend data is optional - if missing, we treat yield as 0 (per original instructions)
    const hasEnoughData = hasCurrentPrice && hasShareData && hasShareData5yAgo;
    
    // Track what's missing
    const missingData: string[] = [];
    if (!hasCurrentPrice) missingData.push('Current Price');
    if (!hasShareData) missingData.push('Shares Outstanding (Current)');
    if (!hasShareData5yAgo) missingData.push('Shares Outstanding (5y ago)');

    // Classification logic
    let driverBuckets: string[] = [];
    let recommendedModel: string = '';
    let explain: string[] = [];
    let hasMissingData = false;
    
    // Helper to safely format dividend yield
    const formatYield = (yieldValue: number): string => {
      if (!isFinite(yieldValue) || isNaN(yieldValue)) return '0.00';
      return (yieldValue * 100).toFixed(2);
    };
    
    // Helper to safely format share change
    const formatShareChange = (change: number | null): string => {
      if (change === null || !isFinite(change) || isNaN(change)) return 'N/A';
      return (change * 100).toFixed(1);
    };

    // Only classify if we have enough data
    // Require: current price, dividend data, current shares outstanding, AND 5-year historical shares outstanding
    if (!hasEnoughData) {
      hasMissingData = true;
      recommendedModel = '';
      explain = [`Missing required data: ${missingData.join(', ')}`];
    } else {
      // We have all required data, proceed with full classification using three yield zones
      const isBuybackHeavy = shareChange5y !== null && shareChange5y <= BUYBACK_HEAVY;
      
      if (dividendYield < LOW_YIELD) {
        // Low yield (< 1.5%): DCF (growth-driven)
        if (isBuybackHeavy) {
          // Driver: Buybacks
          driverBuckets = ['Buybacks'];
          recommendedModel = 'Total Payout Model';
          explain = [
            `Dividend yield (${formatYield(dividendYield)}%) is low (<1.5%).`,
            `Shares outstanding decreased by ${formatShareChange(Math.abs(shareChange5y!))}% over ~5 years, indicating significant buybacks.`,
            `Recommended: Total Payout Model (Dividends + Net Buybacks)`
          ];
        } else {
          // Driver: Reinvestment growth
          driverBuckets = ['Reinvestment growth'];
          recommendedModel = 'DCF';
          explain = [
            `Dividend yield (${formatYield(dividendYield)}%) is low (<1.5%), indicating growth-driven value.`,
            `Shares outstanding changed by ${formatShareChange(shareChange5y)}% over ~5 years (not significant buyback activity).`,
            `Recommended: DCF (Discounted Cash Flow) model`
          ];
        }
      } else if (dividendYield >= LOW_YIELD && dividendYield < MID_YIELD) {
        // Mid yield (1.5% – 3%): DCF (primary) + DDM cross-check
        driverBuckets = ['Dividends'];
        recommendedModel = 'DCF + DDM';
        explain = [
          `Dividend yield (${formatYield(dividendYield)}%) is in the mid range (1.5%–3%).`,
          `Recommended: DCF (Primary) + DDM cross-check`
        ];
        if (isBuybackHeavy) {
          driverBuckets = ['Dividends', 'Buybacks'];
          explain.push(`Shares outstanding decreased by ${formatShareChange(Math.abs(shareChange5y!))}% over ~5 years, indicating significant buybacks.`);
        }
      } else {
        // High yield (≥ 3%): Strict DDM (unless buyback-heavy)
        if (isBuybackHeavy) {
          // High yield but buyback-heavy: DCF + DDM cross-check
          driverBuckets = ['Dividends', 'Buybacks'];
          recommendedModel = 'DCF + DDM';
          explain = [
            `Dividend yield (${formatYield(dividendYield)}%) is high (≥3%).`,
            `Shares outstanding decreased by ${formatShareChange(Math.abs(shareChange5y!))}% over ~5 years, indicating significant buybacks.`,
            `Recommended: DCF (Primary) + DDM cross-check`
          ];
        } else {
          // High yield, not buyback-heavy: Strict DDM
          driverBuckets = ['Dividends'];
          recommendedModel = 'Strict DDM';
          explain = [
            `Dividend yield (${formatYield(dividendYield)}%) is high (≥3%), indicating dividend-driven value.`,
            `Shares outstanding changed by ${formatShareChange(shareChange5y)}% over ~5 years (not significant buyback activity).`,
            `Recommended: Strict DDM (Dividend Discount Model)`
          ];
        }
      }
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      currentPrice,
      annualDividendPerShare,
      dividendYield,
      dividendYieldPercent: isFinite(dividendYield) ? dividendYield * 100 : 0,
      sharesOutstandingNow,
      sharesOutstanding5yAgo,
      shareChange5y,
      shareChange5yPercent: shareChange5y !== null && isFinite(shareChange5y) ? shareChange5y * 100 : null,
      // Debug info
      debug: {
        lowYieldThreshold: LOW_YIELD * 100,
        midYieldThreshold: MID_YIELD * 100,
        buybackHeavyThreshold: BUYBACK_HEAVY * 100,
        dividendYieldBelowLowThreshold: dividendYield < LOW_YIELD,
        dividendYieldInMidRange: dividendYield >= LOW_YIELD && dividendYield < MID_YIELD,
        dividendYieldAboveMidThreshold: dividendYield >= MID_YIELD,
        shareChangeAvailable: shareChange5y !== null,
        shareChangeBelowBuybackThreshold: shareChange5y !== null && shareChange5y <= BUYBACK_HEAVY,
        classificationPath: !hasEnoughData
          ? 'missing_data'
          : dividendYield < LOW_YIELD
            ? (shareChange5y !== null && shareChange5y <= BUYBACK_HEAVY ? 'low_yield_buybacks' : 'low_yield_reinvestment')
            : dividendYield >= LOW_YIELD && dividendYield < MID_YIELD
              ? 'mid_yield_dcf_ddm'
              : (shareChange5y !== null && shareChange5y <= BUYBACK_HEAVY ? 'high_yield_buybacks' : 'high_yield_ddm')
      },
      driverBuckets,
      recommendedModel,
      explain,
      hasMissingData,
      missingDataFields: missingData
    });

  } catch (error: any) {
    console.error('Error classifying value driver:', error);
    return NextResponse.json(
      { error: 'Failed to classify value driver', details: error.message },
      { status: 500 }
    );
  }
}
