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

    // Get current price for manual calculations
    let currentPrice = null;
    if (quoteResponse.status === 'fulfilled' && quoteResponse.value.data) {
      currentPrice = quoteResponse.value.data.c;
    }

    // Process Finnhub Profile for forward PE estimates and Next Year EPS Growth
    if (profileResponse.status === 'fulfilled' && profileResponse.value.data) {
      const profile = profileResponse.value.data;
      
      if (currentPrice && profile.estimates && profile.estimates.length > 0) {
        const currentYear = new Date().getFullYear();
        console.log(`Finnhub estimates for ${symbol}:`, JSON.stringify(profile.estimates.map((e: any) => ({ period: e.period, epsAvg: e.epsAvg })), null, 2));
        
        // Try multiple period formats: "2025", "FY2025", "2025-12-31", etc.
        const epsCurrentYear = profile.estimates.find((est: any) => {
          if (!est.period) return false;
          const period = String(est.period);
          return period.includes(String(currentYear)) || period.includes(`FY${currentYear}`);
        })?.epsAvg;
        const epsNextYear = profile.estimates.find((est: any) => {
          if (!est.period) return false;
          const period = String(est.period);
          return period.includes(String(currentYear + 1)) || period.includes(`FY${currentYear + 1}`);
        })?.epsAvg;
        const epsTwoYears = profile.estimates.find((est: any) => {
          if (!est.period) return false;
          const period = String(est.period);
          return period.includes(String(currentYear + 2)) || period.includes(`FY${currentYear + 2}`);
        })?.epsAvg;
        
        if (epsCurrentYear && currentPrice) {
          result.forwardPE = currentPrice / epsCurrentYear;
        }
        if (epsNextYear && currentPrice) {
          result.twoYearPE = currentPrice / epsNextYear;
        }
        
        // Calculate Next Year EPS Growth: (EPS_FY+1 / EPS_FY) - 1
        if (epsCurrentYear && epsNextYear && epsCurrentYear > 0) {
          result.nextYearEPSGrowth = ((epsNextYear / epsCurrentYear) - 1) * 100; // Convert to percentage
          console.log(`Calculated Next Year EPS Growth from Finnhub: ${result.nextYearEPSGrowth}% (FY: ${epsCurrentYear}, FY+1: ${epsNextYear})`);
        } else {
          // Fallback: If we can't find by year, try using first two estimates sorted by period
          const sortedEstimates = [...profile.estimates].sort((a: any, b: any) => {
            const periodA = String(a.period || '').replace(/[^0-9]/g, '');
            const periodB = String(b.period || '').replace(/[^0-9]/g, '');
            return periodA.localeCompare(periodB);
          });
          
          if (sortedEstimates.length >= 2 && sortedEstimates[0].epsAvg && sortedEstimates[1].epsAvg && sortedEstimates[0].epsAvg > 0) {
            result.nextYearEPSGrowth = ((sortedEstimates[1].epsAvg / sortedEstimates[0].epsAvg) - 1) * 100;
            console.log(`Calculated Next Year EPS Growth from Finnhub (fallback): ${result.nextYearEPSGrowth}% (Est1: ${sortedEstimates[0].epsAvg}, Est2: ${sortedEstimates[1].epsAvg})`);
          }
        }
        
        // Also calculate Current Year Expected EPS Growth if we have previous year
        if (epsNextYear && epsTwoYears && epsNextYear > 0) {
          result.currentYearExpectedEPSGrowth = ((epsTwoYears / epsNextYear) - 1) * 100; // Convert to percentage
          console.log(`Calculated Current Year Expected EPS Growth from Finnhub: ${result.currentYearExpectedEPSGrowth}% (FY+1: ${epsNextYear}, FY+2: ${epsTwoYears})`);
        }
      }
    }
    
    // Fallback: Calculate Next Year EPS Growth from FMP Analyst Estimates
    if (!result.nextYearEPSGrowth && analystEstimatesResponse.status === 'fulfilled' && analystEstimatesResponse.value.data) {
      let estimates = analystEstimatesResponse.value.data;
      
      // Handle different response structures
      if (estimates && !Array.isArray(estimates) && estimates.data) {
        estimates = estimates.data;
      }
      
      if (estimates && Array.isArray(estimates) && estimates.length > 0) {
        console.log(`FMP Analyst Estimates for ${symbol}:`, JSON.stringify(estimates.slice(0, 3), null, 2));
        const currentYear = new Date().getFullYear();
        // FMP returns dates in format like "2025-12-31" or fiscal year in "date" or "fiscalDateEnding" field
        // Also check if it's an object with date properties
        const currentYearEst = estimates.find((est: any) => {
          if (!est) return false;
          const estDate = est.date || est.fiscalDateEnding || est.period || '';
          if (!estDate) return false;
          try {
            const estYear = new Date(estDate).getFullYear();
            return estYear === currentYear;
          } catch {
            return estDate.includes(String(currentYear));
          }
        });
        const nextYearEst = estimates.find((est: any) => {
          if (!est) return false;
          const estDate = est.date || est.fiscalDateEnding || est.period || '';
          if (!estDate) return false;
          try {
            const estYear = new Date(estDate).getFullYear();
            return estYear === currentYear + 1;
          } catch {
            return estDate.includes(String(currentYear + 1));
          }
        });
        
        // Also try sorting by date and taking first two if we can't find by year
        let sortedEstimates = estimates;
        try {
          sortedEstimates = [...estimates].sort((a: any, b: any) => {
            const dateA = a.date || a.fiscalDateEnding || a.period || '';
            const dateB = b.date || b.fiscalDateEnding || b.period || '';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          });
        } catch (e) {
          // If sorting fails, use original array
        }
        
        // If we found estimates, use them; otherwise try first two sorted by date
        const fyEst = currentYearEst || sortedEstimates[0];
        const fyPlus1Est = nextYearEst || sortedEstimates[1];
        
        if (fyEst && fyPlus1Est && fyEst.epsAvg && fyEst.epsAvg > 0 && fyPlus1Est.epsAvg) {
          result.nextYearEPSGrowth = ((fyPlus1Est.epsAvg / fyEst.epsAvg) - 1) * 100; // Convert to percentage
          console.log(`Calculated Next Year EPS Growth from FMP: ${result.nextYearEPSGrowth}% (FY: ${fyEst.epsAvg}, FY+1: ${fyPlus1Est.epsAvg})`);
        }
      }
    }

    // Fallback: Manually calculate forward PE and 2-year PE from EPS and growth rate
    if (currentPrice && incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      if (Array.isArray(incomeData) && incomeData.length > 0) {
        const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latestEPS = sortedData[sortedData.length - 1].eps;
        
        if (latestEPS && latestEPS > 0) {
          // Try to get EPS growth rate from metrics
          let epsGrowthRate = null;
          if (metricsResponse.status === 'fulfilled' && metricsResponse.value.data) {
            const metrics = metricsResponse.value.data;
            if (metrics.metric) {
              // Prefer 3-year growth rate, fallback to 1-year or 2-year
              epsGrowthRate = metrics.metric.epsGrowth3Y || metrics.metric.epsGrowth2Y || metrics.metric.epsGrowth1Y;
              if (epsGrowthRate) {
                epsGrowthRate = epsGrowthRate / 100; // Convert percentage to decimal
              }
            }
          }
          
          // If no growth rate from metrics, calculate from historical EPS
          if (!epsGrowthRate && sortedData.length >= 2) {
            const previousEPS = sortedData[sortedData.length - 2].eps;
            if (previousEPS && previousEPS > 0) {
              epsGrowthRate = (latestEPS - previousEPS) / previousEPS;
            }
          }
          
          // Calculate forward PE (1 year) if not already set
          if (!result.forwardPE && epsGrowthRate !== null) {
            const projectedEPS1Year = latestEPS * (1 + epsGrowthRate);
            if (projectedEPS1Year > 0) {
              result.forwardPE = currentPrice / projectedEPS1Year;
              console.log(`Calculated Forward PE manually: ${result.forwardPE} (EPS: ${latestEPS}, Growth: ${epsGrowthRate * 100}%, Projected EPS: ${projectedEPS1Year})`);
            }
          }
          
          // Calculate 2-year PE if not already set
          if (!result.twoYearPE && epsGrowthRate !== null) {
            const projectedEPS2Year = latestEPS * Math.pow(1 + epsGrowthRate, 2);
            if (projectedEPS2Year > 0) {
              result.twoYearPE = currentPrice / projectedEPS2Year;
              console.log(`Calculated 2-Year PE manually: ${result.twoYearPE} (EPS: ${latestEPS}, Growth: ${epsGrowthRate * 100}%, Projected EPS: ${projectedEPS2Year})`);
            }
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
            console.log(`Calculated Gross Margin from Finnhub: ${result.grossMargin}%`);
          }
        }
      }
    }
    
    // Fallback: Calculate Gross Margin from FMP Income Statement
    if (!result.grossMargin && incomeStatementResponse.status === 'fulfilled' && incomeStatementResponse.value.data) {
      const incomeData = incomeStatementResponse.value.data;
      if (Array.isArray(incomeData) && incomeData.length > 0) {
        const sortedData = incomeData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const latest = sortedData[sortedData.length - 1];
        
        const revenue = latest.revenue || latest.revenues;
        const costOfRevenue = latest.costOfRevenue || latest.costOfGoodsSold || latest.costOfSales;
        const grossProfit = latest.grossProfit;
        
        // Calculate from revenue and cost of revenue
        if (revenue && costOfRevenue && revenue > 0) {
          const calculatedGrossProfit = revenue - costOfRevenue;
          result.grossMargin = (calculatedGrossProfit / revenue) * 100;
          console.log(`Calculated Gross Margin from FMP Income Statement: ${result.grossMargin}% (Revenue: ${revenue}, COGS: ${costOfRevenue})`);
        }
        // Or use gross profit directly if available
        else if (revenue && grossProfit && revenue > 0) {
          result.grossMargin = (grossProfit / revenue) * 100;
          console.log(`Calculated Gross Margin from FMP (using grossProfit): ${result.grossMargin}% (Revenue: ${revenue}, Gross Profit: ${grossProfit})`);
        }
      }
    }
    
    // Additional fallback: Try FMP key metrics for gross margin
    if (!result.grossMargin && keyMetricsResponse.status === 'fulfilled' && keyMetricsResponse.value.data) {
      const keyMetricsData = keyMetricsResponse.value.data;
      if (Array.isArray(keyMetricsData) && keyMetricsData.length > 0) {
        const latestMetrics = keyMetricsData[0];
        // FMP key metrics might have grossProfitMargin or similar
        if (latestMetrics.grossProfitMargin) {
          result.grossMargin = latestMetrics.grossProfitMargin * 100; // Convert to percentage
          console.log(`Got Gross Margin from FMP Key Metrics: ${result.grossMargin}%`);
        }
      }
    }

    // Process Analyst Estimates for revenue growth
    if (analystEstimatesResponse.status === 'fulfilled' && analystEstimatesResponse.value.data) {
      let estimates = analystEstimatesResponse.value.data;
      
      // Handle different response structures
      if (estimates && !Array.isArray(estimates) && estimates.data) {
        estimates = estimates.data;
      }
      
      if (estimates && Array.isArray(estimates) && estimates.length > 0) {
        console.log(`FMP Revenue Estimates for ${symbol}:`, JSON.stringify(estimates.slice(0, 3), null, 2));
        const currentYear = new Date().getFullYear();
        // FMP returns dates in format like "2025-12-31" or fiscal year in "date" or "fiscalDateEnding" field
        const currentYearEst = estimates.find((est: any) => {
          if (!est) return false;
          const estDate = est.date || est.fiscalDateEnding || est.period || '';
          if (!estDate) return false;
          try {
            const estYear = new Date(estDate).getFullYear();
            return estYear === currentYear;
          } catch {
            return estDate.includes(String(currentYear));
          }
        });
        const previousYearEst = estimates.find((est: any) => {
          if (!est) return false;
          const estDate = est.date || est.fiscalDateEnding || est.period || '';
          if (!estDate) return false;
          try {
            const estYear = new Date(estDate).getFullYear();
            return estYear === currentYear - 1;
          } catch {
            return estDate.includes(String(currentYear - 1));
          }
        });
        const nextYearEst = estimates.find((est: any) => {
          if (!est) return false;
          const estDate = est.date || est.fiscalDateEnding || est.period || '';
          if (!estDate) return false;
          try {
            const estYear = new Date(estDate).getFullYear();
            return estYear === currentYear + 1;
          } catch {
            return estDate.includes(String(currentYear + 1));
          }
        });
        
        // Also try sorting by date and taking consecutive years if we can't find by year
        let sortedEstimates = estimates;
        try {
          sortedEstimates = [...estimates].sort((a: any, b: any) => {
            const dateA = a.date || a.fiscalDateEnding || a.period || '';
            const dateB = b.date || b.fiscalDateEnding || b.period || '';
            return new Date(dateA).getTime() - new Date(dateB).getTime();
          });
        } catch (e) {
          // If sorting fails, use original array
        }
        
        // If we found estimates, use them; otherwise try sorted estimates
        const fyMinus1Est = previousYearEst || sortedEstimates[0];
        const fyEst = currentYearEst || sortedEstimates[1];
        const fyPlus1Est = nextYearEst || sortedEstimates[2];
        
        // Calculate Current Year Expected Revenue Growth: (Revenue_FY / Revenue_FY-1) - 1
        if (fyEst && fyMinus1Est && fyEst.revenueAvg && fyMinus1Est.revenueAvg && fyMinus1Est.revenueAvg > 0) {
          result.currentYearExpectedRevenueGrowth = ((fyEst.revenueAvg / fyMinus1Est.revenueAvg) - 1) * 100;
          console.log(`Calculated Current Year Expected Revenue Growth from FMP: ${result.currentYearExpectedRevenueGrowth}% (FY-1: ${fyMinus1Est.revenueAvg}, FY: ${fyEst.revenueAvg})`);
        }
        
        // Calculate Next Year Revenue Growth: (Revenue_FY+1 / Revenue_FY) - 1
        if (fyPlus1Est && fyEst && fyEst.revenueAvg && fyEst.revenueAvg > 0 && fyPlus1Est.revenueAvg) {
          result.nextYearRevenueGrowth = ((fyPlus1Est.revenueAvg / fyEst.revenueAvg) - 1) * 100;
          console.log(`Calculated Next Year Revenue Growth from FMP: ${result.nextYearRevenueGrowth}% (FY: ${fyEst.revenueAvg}, FY+1: ${fyPlus1Est.revenueAvg})`);
        }
      }
    }
    
    // Fallback: Try to get revenue estimates from Finnhub (if they have a revenue estimates endpoint)
    // Note: Finnhub may not have a direct revenue estimates endpoint, but we can try profile2 estimates
    if (!result.currentYearExpectedRevenueGrowth && profileResponse.status === 'fulfilled' && profileResponse.value.data) {
      const profile = profileResponse.value.data;
      if (profile.estimates && profile.estimates.length > 0) {
        const currentYear = new Date().getFullYear();
        const currentYearEst = profile.estimates.find((est: any) => est.period && est.period.includes(String(currentYear)));
        const previousYearEst = profile.estimates.find((est: any) => est.period && est.period.includes(String(currentYear - 1)));
        
        // Some estimates might have revenue fields
        if (currentYearEst && previousYearEst && currentYearEst.revenueAvg && previousYearEst.revenueAvg && previousYearEst.revenueAvg > 0) {
          result.currentYearExpectedRevenueGrowth = ((currentYearEst.revenueAvg / previousYearEst.revenueAvg) - 1) * 100;
          console.log(`Calculated Current Year Expected Revenue Growth from Finnhub: ${result.currentYearExpectedRevenueGrowth}%`);
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
