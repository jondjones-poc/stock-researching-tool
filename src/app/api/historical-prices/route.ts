import { NextResponse } from 'next/server';
import axios from 'axios';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FRED_API_KEY = process.env.FRED_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const dataSource = searchParams.get('dataSource'); // 'FMP' or 'FRED'
  const fredSeriesId = searchParams.get('fredSeriesId'); // FRED series ID

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  try {
    // Use FRED API if specified
    if (dataSource === 'FRED' && fredSeriesId) {
      let fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${fredSeriesId}&api_key=${FRED_API_KEY}&file_type=json`;
      
      if (from) {
        fredUrl += `&observation_start=${from}`;
      }
      
      if (to) {
        fredUrl += `&observation_end=${to}`;
      }

      console.log('Fetching FRED data for:', fredSeriesId);
      console.log('FRED URL (full):', fredUrl);

      const response = await axios.get(fredUrl);
      const data = response.data;

      console.log('FRED response status:', response.status);
      console.log('FRED response data keys:', Object.keys(data));

      if (!data || !data.observations) {
        console.error('No observations in FRED response:', data);
        return NextResponse.json({ error: 'No data available from FRED' }, { status: 404 });
      }

      // Transform FRED data to our format
      const historicalData = data.observations
        .filter((item: any) => item && item.value && item.value !== '.' && !isNaN(parseFloat(item.value)))  // Filter out missing data points
        .map((item: any) => {
          const value = parseFloat(item.value);
          return {
            date: item.date,
            close: value,
            // FRED doesn't provide OHLCV, only closing values
            open: value,
            high: value,
            low: value,
            volume: 0, // No volume data for FRED indices
            change: 0,
            changePercent: 0
          };
        });

      console.log(`Fetched ${historicalData.length} observations for ${fredSeriesId} from FRED`);

      return NextResponse.json({
        symbol: symbol,
        historical: historicalData,
        count: historicalData.length
      });
    }

    // Otherwise use FMP API (default)
    if (!FMP_API_KEY) {
      return NextResponse.json({ error: 'FMP_API_KEY is not configured' }, { status: 500 });
    }

    // Try multiple FMP endpoints - some may work better than others
    // Endpoint 1: historical-price-eod/full (used in graphs API)
    let url = `https://financialmodelingprep.com/stable/historical-price-eod/full?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    
    if (from && to) {
      url += `&from=${from}&to=${to}`;
    }

    console.log('Fetching historical prices from FMP for:', symbol);
    console.log('FMP URL:', url.replace(FMP_API_KEY, 'API_KEY_HIDDEN'));

    let response;
    let data;
    let status;
    
    try {
      response = await axios.get(url, { 
        timeout: 15000,
        validateStatus: () => true // Don't throw for any status, we'll handle them all
      });
      data = response.data;
      status = response.status;
      
      // Log the actual response for debugging
      console.log(`FMP API response for ${symbol}:`, {
        status: status,
        dataType: typeof data,
        isArray: Array.isArray(data),
        dataLength: Array.isArray(data) ? data.length : (data?.historical?.length || 'N/A'),
        hasError: data && typeof data === 'object' && 'Error Message' in data,
        errorMessage: data?.['Error Message'] || null
      });
    } catch (axiosError: any) {
      // Handle network errors or timeouts (shouldn't happen with validateStatus: true, but just in case)
      if (axiosError.code === 'ECONNABORTED') {
        console.error('FMP API timeout for:', symbol);
        return NextResponse.json({ error: 'Request timeout - FMP API took too long to respond' }, { status: 504 });
      }
      
      // If axios still threw, try to extract response
      if (axiosError.response) {
        status = axiosError.response.status;
        data = axiosError.response.data;
      } else {
        // Network error or other issue
        console.error('Network error fetching from FMP:', axiosError.message);
        return NextResponse.json({ 
          error: `Network error: ${axiosError.message}`,
          details: 'Unable to connect to FMP API'
        }, { status: 503 });
      }
    }

    // Handle non-200 status codes
    if (status !== 200) {
      console.error(`FMP API returned status ${status} for ${symbol}:`, data);
      
      // If 404, try without date range as fallback
      if (status === 404 && (from || to)) {
        console.log(`Trying FMP without date range for ${symbol}...`);
        try {
          const fallbackUrl = `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}`;
          const fallbackResponse = await axios.get(fallbackUrl, {
            timeout: 15000,
            validateStatus: () => true
          });
          
          if (fallbackResponse.status === 200) {
            const fallbackData = fallbackResponse.data;
            // Process fallback data (same logic as below)
            if (Array.isArray(fallbackData) && fallbackData.length > 0) {
              const historicalData = fallbackData
                .filter((item: any) => item && item.date && item.close !== undefined && item.close !== null)
                .map((item: any) => ({
                  date: item.date,
                  open: item.open ?? item.close ?? 0,
                  high: item.high ?? item.close ?? 0,
                  low: item.low ?? item.close ?? 0,
                  close: item.close ?? 0,
                  volume: item.volume ?? 0,
                  change: item.change ?? 0,
                  changePercent: item.changePercent ?? 0
                }));
              
              // Apply date filtering
              let filteredData = historicalData;
              if (from || to) {
                filteredData = historicalData.filter((item: any) => {
                  const itemDate = new Date(item.date).toISOString().split('T')[0];
                  if (from && itemDate < from) return false;
                  if (to && itemDate > to) return false;
                  return true;
                });
              }
              
              filteredData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              if (filteredData.length > 0) {
                console.log(`Fallback request returned ${filteredData.length} data points for ${symbol}`);
                return NextResponse.json({
                  symbol: symbol,
                  historical: filteredData,
                  count: filteredData.length
                });
              }
            } else if (fallbackData && fallbackData.historical && Array.isArray(fallbackData.historical) && fallbackData.historical.length > 0) {
              // Handle object with historical property
              const historicalData = fallbackData.historical
                .filter((item: any) => item && item.date && item.close !== undefined && item.close !== null)
                .map((item: any) => ({
                  date: item.date,
                  open: item.open ?? item.close ?? 0,
                  high: item.high ?? item.close ?? 0,
                  low: item.low ?? item.close ?? 0,
                  close: item.close ?? 0,
                  volume: item.volume ?? 0,
                  change: item.change ?? 0,
                  changePercent: item.changePercent ?? 0
                }));
              
              let filteredData = historicalData;
              if (from || to) {
                filteredData = historicalData.filter((item: any) => {
                  const itemDate = new Date(item.date).toISOString().split('T')[0];
                  if (from && itemDate < from) return false;
                  if (to && itemDate > to) return false;
                  return true;
                });
              }
              
              filteredData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              if (filteredData.length > 0) {
                console.log(`Fallback request returned ${filteredData.length} data points for ${symbol}`);
                return NextResponse.json({
                  symbol: symbol,
                  historical: filteredData,
                  count: filteredData.length
                });
              }
            }
          }
        } catch (fallbackError) {
          console.error('Fallback request failed:', fallbackError);
        }
      }
      
      return NextResponse.json({ 
        error: data?.['Error Message'] || `FMP API returned status ${status}`,
        details: data,
        symbol: symbol
      }, { status: status === 404 ? 404 : 500 });
    }

    // Check if the response is an error object (sometimes FMP returns 200 with error message)
    if (data && typeof data === 'object' && 'Error Message' in data) {
      console.error('FMP API error message in response:', data['Error Message']);
      
      // If using eod endpoint and it fails, try the original endpoint as fallback
      if (url.includes('historical-price-eod')) {
        console.log('EOD endpoint failed, trying historical-price-full endpoint...');
        try {
          const fallbackUrl = `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}${from && to ? `&from=${from}&to=${to}` : ''}`;
          const fallbackResponse = await axios.get(fallbackUrl, {
            timeout: 15000,
            validateStatus: () => true
          });
          
          if (fallbackResponse.status === 200 && !fallbackResponse.data?.['Error Message']) {
            const fallbackData = fallbackResponse.data;
            // Process fallback data (will be handled by array/object checks below)
            data = fallbackData;
            status = 200;
          }
        } catch (fallbackError) {
          console.error('Fallback endpoint also failed:', fallbackError);
        }
      }
      
      // If still an error after fallback, return error
      if (data && typeof data === 'object' && 'Error Message' in data) {
        return NextResponse.json({ 
          error: data['Error Message'] || 'FMP API returned an error',
          details: data
        }, { status: 404 });
      }
    }

    // Check if data is an array (FMP sometimes returns array directly)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.warn(`FMP returned empty array for ${symbol}, trying without date range...`);
        
        // Try without date range - sometimes FMP needs the full dataset
        try {
          const altUrl = `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}`;
          console.log('Trying FMP without date range:', altUrl.replace(FMP_API_KEY, 'API_KEY_HIDDEN'));
          
          const altResponse = await axios.get(altUrl, {
            timeout: 15000,
            validateStatus: () => true
          });
          
          if (altResponse.status === 200) {
            const altData = altResponse.data;
            
            // Check if we got data this time
            let historicalArray: any[] = [];
            if (Array.isArray(altData) && altData.length > 0) {
              historicalArray = altData;
            } else if (altData && altData.historical && Array.isArray(altData.historical) && altData.historical.length > 0) {
              historicalArray = altData.historical;
            }
            
            if (historicalArray.length > 0) {
              console.log(`FMP returned ${historicalArray.length} data points without date range`);
              const historicalData = historicalArray
                .filter((item: any) => item && item.date && item.close !== undefined && item.close !== null)
                .map((item: any) => ({
                  date: item.date,
                  open: item.open ?? item.close ?? 0,
                  high: item.high ?? item.close ?? 0,
                  low: item.low ?? item.close ?? 0,
                  close: item.close ?? 0,
                  volume: item.volume ?? 0,
                  change: item.change ?? 0,
                  changePercent: item.changePercent ?? 0
                }));
              
              // Apply date filtering if provided
              let filteredData = historicalData;
              if (from || to) {
                filteredData = historicalData.filter((item: any) => {
                  const itemDate = new Date(item.date).toISOString().split('T')[0];
                  if (from && itemDate < from) return false;
                  if (to && itemDate > to) return false;
                  return true;
                });
              }
              
              filteredData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              if (filteredData.length > 0) {
                return NextResponse.json({
                  symbol: symbol,
                  historical: filteredData,
                  count: filteredData.length
                });
              }
            }
          }
        } catch (altError: any) {
          console.error('Alternative request also failed:', altError.message);
        }
        
        // If all attempts fail, return error
        return NextResponse.json({ 
          error: `No historical data available for symbol "${symbol}"`,
          details: 'FMP API returned empty results. The symbol may not exist in FMP database or your API key may not have access to this data.',
          symbol: symbol
        }, { status: 404 });
      }
      // If it's an array with data, wrap it in historical property
      const historicalData = data.map((item: any) => ({
        date: item.date,
        open: item.open ?? item.close ?? 0,
        high: item.high ?? item.close ?? 0,
        low: item.low ?? item.close ?? 0,
        close: item.close ?? 0,
        volume: item.volume ?? 0,
        change: item.change ?? 0,
        changePercent: item.changePercent ?? 0
      }));
      
      historicalData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return NextResponse.json({
        symbol: symbol,
        historical: historicalData,
        count: historicalData.length
      });
    }

    // FMP API can return data in different structures:
    // 1. { historical: [...] }
    // 2. { historicalStockList: [...] }
    // 3. Direct array (handled above)
    let historicalArray: any[] | null = null;
    
    if (data && typeof data === 'object') {
      if (Array.isArray(data.historical)) {
        historicalArray = data.historical;
      } else if (Array.isArray(data.historicalStockList)) {
        historicalArray = data.historicalStockList;
      } else if (data.symbol && Array.isArray(data[data.symbol])) {
        // Sometimes FMP returns { symbol: [...] }
        historicalArray = data[data.symbol];
      }
    }

    if (!historicalArray || historicalArray.length === 0) {
      console.error('Invalid FMP response structure for', symbol, ':', {
        hasData: !!data,
        dataType: typeof data,
        isArray: Array.isArray(data),
        keys: data && typeof data === 'object' ? Object.keys(data) : [],
        hasHistorical: !!(data && data.historical),
        hasHistoricalStockList: !!(data && data.historicalStockList)
      });
      return NextResponse.json({ 
        error: `No historical data available for symbol "${symbol}" or invalid response format`,
        details: 'Response structure does not contain historical array',
        debug: {
          responseType: typeof data,
          isArray: Array.isArray(data),
          keys: data && typeof data === 'object' ? Object.keys(data).slice(0, 10) : []
        }
      }, { status: 404 });
    }

    // Transform the data to our format with null checks
    const historicalData = historicalArray
      .filter((item: any) => item && item.date && item.close !== undefined && item.close !== null)
      .map((item: any) => ({
        date: item.date,
        open: item.open ?? item.close ?? 0,
        high: item.high ?? item.close ?? 0,
        low: item.low ?? item.close ?? 0,
        close: item.close ?? 0,
        volume: item.volume ?? 0,
        change: item.change ?? 0,
        changePercent: item.changePercent ?? 0
      }));

    // Sort by date ascending (oldest first)
    historicalData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Apply date filtering if from/to parameters are provided
    let filteredData = historicalData;
    if (from || to) {
      filteredData = historicalData.filter((item: any) => {
        const itemDate = new Date(item.date).toISOString().split('T')[0];
        if (from && itemDate < from) return false;
        if (to && itemDate > to) return false;
        return true;
      });
    }

    console.log(`Fetched ${historicalData.length} days of historical data for ${symbol} from FMP${filteredData.length !== historicalData.length ? ` (filtered to ${filteredData.length} days)` : ''}`);

    if (filteredData.length === 0) {
      console.warn(`No data available for ${symbol} after date filtering (from: ${from}, to: ${to})`);
      return NextResponse.json({ 
        error: `No historical data available for symbol "${symbol}" in the selected date range`,
        details: `Total data points: ${historicalData.length}, Filtered: ${filteredData.length}`,
        dateRange: { from, to }
      }, { status: 404 });
    }

    return NextResponse.json({
      symbol: data.symbol || symbol,
      historical: filteredData,
      count: filteredData.length
    });

  } catch (error: any) {
    console.error('Error fetching historical prices:', error);
    console.error('Error details:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error message:', error.message);
    console.error('Symbol:', symbol);
    console.error('DataSource:', dataSource);
    
    // Handle axios errors
    if (error.response) {
      const statusCode = error.response.status;
      const errorData = error.response.data;
      
      // Try to extract meaningful error message
      let errorMessage = 'Failed to fetch historical price data';
      
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMessage = errorData;
        } else if (errorData.error) {
          errorMessage = errorData.error;
        } else if (errorData['Error Message']) {
          errorMessage = errorData['Error Message'];
        } else if (errorData.message) {
          errorMessage = errorData.message;
        }
      }
      
      // Special handling for 404 - symbol might not exist
      if (statusCode === 404) {
        errorMessage = `Symbol "${symbol}" not found in FMP database. It may not exist, be delisted, or have no historical data available.`;
      }
      
      return NextResponse.json(
        { 
          error: errorMessage, 
          details: error.message,
          symbol: symbol,
          statusCode: statusCode
        },
        { status: statusCode }
      );
    }
    
    // Handle network/timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return NextResponse.json(
        { 
          error: 'Request timeout - FMP API took too long to respond',
          details: error.message 
        },
        { status: 504 }
      );
    }
    
    // Generic error
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch historical price data',
        details: error.message,
        symbol: symbol
      },
      { status: 500 }
    );
  }
}

