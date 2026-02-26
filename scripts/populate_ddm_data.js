/**
 * Script to populate ddm_data table from Alpha Vantage API
 * This script fetches dividend data and stores it with DDM inputs in the database
 * 
 * Usage: node scripts/populate_ddm_data.js [symbol1] [symbol2] ...
 * Example: node scripts/populate_ddm_data.js NKE AAPL MSFT
 * 
 * Optional flags:
 *   --wacc=8.5          Set WACC (default: 8.5)
 *   --margin=20.0       Set margin of safety (default: 20.0)
 *   --years=5           Set high growth years (default: 5)
 *   --growth=3.0        Set stable growth rate (default: 3.0)
 *   --price=100.00      Set current price (optional)
 */

const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if it exists
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE;
const SUPABASE_DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;

if (!ALPHA_VANTAGE_API_KEY) {
  console.error('❌ ALPHA_VANTAGE_API_KEY or ALPHA_VANTAGE not found in .env.local');
  process.exit(1);
}

if (!SUPABASE_DB_PASSWORD) {
  console.error('❌ SUPABASE_DB_PASSWORD not found in .env.local');
  process.exit(1);
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const symbols = [];
  const options = {
    wacc: 8.5,
    marginOfSafety: 20.0,
    highGrowthYears: 5,
    stableGrowthRate: 3.0,
    currentPrice: null
  };

  args.forEach(arg => {
    if (arg.startsWith('--wacc=')) {
      options.wacc = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--margin=')) {
      options.marginOfSafety = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--years=')) {
      options.highGrowthYears = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--growth=')) {
      options.stableGrowthRate = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--price=')) {
      options.currentPrice = parseFloat(arg.split('=')[1]);
    } else if (!arg.startsWith('--')) {
      symbols.push(arg.toUpperCase());
    }
  });

  return { symbols, options };
}

// Database connection
const encodedPassword = encodeURIComponent(SUPABASE_DB_PASSWORD);
const projectRef = 'wnazcizhbqjxvbyffyhp';
const connectionString = `postgresql://postgres.${projectRef}:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres`;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
});

/**
 * Fetch dividend data from Alpha Vantage API
 */
async function fetchDividendData(symbol) {
  try {
    console.log(`\n📡 Fetching dividend data for ${symbol}...`);
    
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=DIVIDENDS&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`,
      { timeout: 10000 }
    );

    const data = response.data;
    
    // Check for errors
    const errorMsg = data['Error Message'] || data['Note'] || data['Information'];
    const isRateLimit = errorMsg && typeof errorMsg === 'string' && (
      errorMsg.toLowerCase().includes('rate limit') ||
      errorMsg.toLowerCase().includes('spreading out') ||
      errorMsg.toLowerCase().includes('25 requests per day')
    );

    if (isRateLimit) {
      throw new Error(`Rate limit exceeded: ${errorMsg}`);
    }

    if (errorMsg) {
      throw new Error(`API error: ${errorMsg}`);
    }

    // Parse dividend data
    let allDividends = [];
    
    if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      allDividends = data.data.map((div) => ({
        date: div.ex_dividend_date || div.date,
        dividend: parseFloat(div.amount || div.dividend || 0),
        adjustedDividend: parseFloat(div.amount || div.dividend || 0)
      })).filter((div) => div.date && div.dividend > 0);
    } else if (data.dividends && Array.isArray(data.dividends) && data.dividends.length > 0) {
      allDividends = data.dividends.map((div) => ({
        date: div.date,
        dividend: parseFloat(div.dividend || 0),
        adjustedDividend: parseFloat(div.dividend || 0)
      })).filter((div) => div.date && div.dividend > 0);
    }

    if (allDividends.length === 0) {
      throw new Error('No dividend data found in API response');
    }

    // Sort by date descending (most recent first)
    allDividends.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Filter to last 6 years
    const today = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setFullYear(today.getFullYear() - 6);
    cutoffDate.setMonth(0, 1);
    
    const historicalDividends = allDividends.filter((dividend) => {
      const dividendDate = new Date(dividend.date);
      return dividendDate >= cutoffDate;
    });

    // Aggregate by year
    const dividendsByYear = {};
    historicalDividends.forEach((div) => {
      const year = new Date(div.date).getFullYear().toString();
      if (!dividendsByYear[year]) {
        dividendsByYear[year] = 0;
      }
      dividendsByYear[year] += div.dividend;
    });

    // Fill in missing years with 0
    if (Object.keys(dividendsByYear).length > 0) {
      const years = Object.keys(dividendsByYear).map(y => parseInt(y)).sort((a, b) => a - b);
      const oldestYear = years[0];
      const newestYear = years[years.length - 1];
      
      for (let year = oldestYear; year <= newestYear; year++) {
        const yearStr = year.toString();
        if (!dividendsByYear[yearStr]) {
          dividendsByYear[yearStr] = 0;
        }
      }
    }

    // Calculate dividend growth rate
    const years = Object.keys(dividendsByYear).sort();
    let dividendGrowthRate = null;
    if (years.length >= 2) {
      const oldestYear = years[0];
      const latestYear = years[years.length - 1];
      const oldestAnnualDividend = dividendsByYear[oldestYear];
      const latestAnnualDividend = dividendsByYear[latestYear];
      const yearsDiff = parseInt(latestYear) - parseInt(oldestYear);
      
      if (yearsDiff > 0 && oldestAnnualDividend > 0) {
        dividendGrowthRate = Math.pow(latestAnnualDividend / oldestAnnualDividend, 1 / yearsDiff) - 1;
      }
    }

    // Project current year if needed
    const currentYear = new Date().getFullYear().toString();
    let currentYearProjected = false;
    if (years.includes(currentYear) && years.length >= 6) {
      const completeYears = years.filter(y => y !== currentYear).slice(-5);
      if (completeYears.length === 5) {
        let totalGrowthRate = 0;
        let growthCount = 0;
        
        for (let i = 1; i < completeYears.length; i++) {
          const prevYear = completeYears[i - 1];
          const currYear = completeYears[i];
          const prevDividend = dividendsByYear[prevYear];
          const currDividend = dividendsByYear[currYear];
          
          if (prevDividend > 0) {
            totalGrowthRate += (currDividend - prevDividend) / prevDividend;
            growthCount++;
          }
        }
        
        const avgGrowthRate = growthCount > 0 ? totalGrowthRate / growthCount : 0;
        const lastCompleteYear = completeYears[completeYears.length - 1];
        const lastYearDividend = dividendsByYear[lastCompleteYear];
        dividendsByYear[currentYear] = lastYearDividend * (1 + avgGrowthRate);
        currentYearProjected = true;
      }
    }

    // Create dividend projections for DDM (from 2020 to current year)
    const startYear = 2020;
    const currentYearNum = new Date().getFullYear();
    const sortedYears = Object.keys(dividendsByYear)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .filter(year => parseInt(year) >= startYear && parseInt(year) <= currentYearNum);
    
    const dividendProjections = sortedYears.map((year, index) => {
      const dividend = dividendsByYear[year];
      let growthRate = 0;
      
      if (index > 0) {
        const previousYear = sortedYears[index - 1];
        const previousDividend = dividendsByYear[previousYear];
        if (previousDividend > 0) {
          growthRate = ((dividend - previousDividend) / previousDividend) * 100;
        }
      }
      
      return {
        year,
        dividend,
        growthRate
      };
    });

    const latestDividend = historicalDividends[0]?.dividend || null;

    return {
      symbol: symbol.toUpperCase(),
      dividendsByYear,
      currentYearProjected,
      dividendGrowthRate,
      latestDividend,
      historicalDividends,
      dividendProjections
    };

  } catch (error) {
    console.error(`❌ Error fetching data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Save DDM data to database
 */
async function saveDdmData(symbol, dividendData, options) {
  try {
    const { 
      dividendsByYear, 
      currentYearProjected, 
      dividendGrowthRate, 
      latestDividend, 
      historicalDividends,
      dividendProjections
    } = dividendData;

    const result = await pool.query(
      `INSERT INTO ddm_data (
        symbol, wacc, margin_of_safety, high_growth_years, stable_growth_rate, current_price,
        dividends_by_year, current_year_projected, dividend_growth_rate, latest_dividend,
        historical_dividends, dividend_projections
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (symbol) 
      DO UPDATE SET
        wacc = EXCLUDED.wacc,
        margin_of_safety = EXCLUDED.margin_of_safety,
        high_growth_years = EXCLUDED.high_growth_years,
        stable_growth_rate = EXCLUDED.stable_growth_rate,
        current_price = COALESCE(EXCLUDED.current_price, ddm_data.current_price),
        dividends_by_year = EXCLUDED.dividends_by_year,
        current_year_projected = EXCLUDED.current_year_projected,
        dividend_growth_rate = EXCLUDED.dividend_growth_rate,
        latest_dividend = EXCLUDED.latest_dividend,
        historical_dividends = EXCLUDED.historical_dividends,
        dividend_projections = EXCLUDED.dividend_projections,
        last_updated = NOW()
      RETURNING id, symbol, last_updated`,
      [
        symbol,
        options.wacc,
        options.marginOfSafety,
        options.highGrowthYears,
        options.stableGrowthRate,
        options.currentPrice,
        JSON.stringify(dividendsByYear),
        currentYearProjected,
        dividendGrowthRate,
        latestDividend,
        JSON.stringify(historicalDividends),
        JSON.stringify(dividendProjections)
      ]
    );

    console.log(`✅ Saved DDM data for ${symbol} (ID: ${result.rows[0].id})`);
    console.log(`   WACC: ${options.wacc}%`);
    console.log(`   Margin of Safety: ${options.marginOfSafety}%`);
    console.log(`   High Growth Years: ${options.highGrowthYears}`);
    console.log(`   Stable Growth Rate: ${options.stableGrowthRate}%`);
    if (options.currentPrice) {
      console.log(`   Current Price: £${options.currentPrice.toFixed(2)}`);
    }
    console.log(`   Last updated: ${result.rows[0].last_updated}`);
    console.log(`   Years of data: ${Object.keys(dividendsByYear).length}`);
    console.log(`   Total dividends: ${historicalDividends.length}`);
    
    return result.rows[0];
  } catch (error) {
    console.error(`❌ Error saving data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  const { symbols, options } = parseArgs();

  if (symbols.length === 0) {
    console.error('❌ Please provide at least one stock symbol');
    console.log('\nUsage: node scripts/populate_ddm_data.js [symbol1] [symbol2] ...');
    console.log('\nOptional flags:');
    console.log('  --wacc=8.5          Set WACC (default: 8.5)');
    console.log('  --margin=20.0       Set margin of safety (default: 20.0)');
    console.log('  --years=5           Set high growth years (default: 5)');
    console.log('  --growth=3.0        Set stable growth rate (default: 3.0)');
    console.log('  --price=100.00      Set current price (optional)');
    console.log('\nExample:');
    console.log('  node scripts/populate_ddm_data.js NKE AAPL --wacc=9.0 --margin=25.0');
    process.exit(1);
  }

  console.log(`\n🚀 Starting DDM data population for ${symbols.length} symbol(s)...`);
  console.log(`   Symbols: ${symbols.join(', ')}`);
  console.log(`   WACC: ${options.wacc}%`);
  console.log(`   Margin of Safety: ${options.marginOfSafety}%`);
  console.log(`   High Growth Years: ${options.highGrowthYears}`);
  console.log(`   Stable Growth Rate: ${options.stableGrowthRate}%`);
  if (options.currentPrice) {
    console.log(`   Current Price: £${options.currentPrice.toFixed(2)}`);
  }
  console.log(`   Rate limit: 1 request/second, 25 requests/day\n`);

  const results = {
    success: [],
    failed: []
  };

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i].toUpperCase();
    
    try {
      // Wait 1 second between requests to respect rate limit
      if (i > 0) {
        console.log('⏳ Waiting 1 second to respect rate limit...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const dividendData = await fetchDividendData(symbol);
      await saveDdmData(symbol, dividendData, options);
      results.success.push(symbol);
    } catch (error) {
      console.error(`❌ Failed to process ${symbol}:`, error.message);
      results.failed.push({ symbol, error: error.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${results.success.length} symbol(s)`);
  console.log(`   ❌ Failed: ${results.failed.length} symbol(s)`);
  
  if (results.success.length > 0) {
    console.log(`\n   Successful: ${results.success.join(', ')}`);
  }
  
  if (results.failed.length > 0) {
    console.log(`\n   Failed:`);
    results.failed.forEach(({ symbol, error }) => {
      console.log(`      - ${symbol}: ${error}`);
    });
  }

  await pool.end();
  console.log('\n✅ Done!\n');
}

// Run the script
main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
