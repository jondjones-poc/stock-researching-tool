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

    let url = `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    
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
      return NextResponse.json({ 
        error: data?.['Error Message'] || `FMP API returned status ${status}`,
        details: data
      }, { status: status === 404 ? 404 : 500 });
    }

    // Check if the response is an error object (sometimes FMP returns 200 with error message)
    if (data && typeof data === 'object' && 'Error Message' in data) {
      console.error('FMP API error message in response:', data['Error Message']);
      return NextResponse.json({ 
        error: data['Error Message'] || 'FMP API returned an error',
        details: data
      }, { status: 404 });
    }

    // Check if data is an array (FMP sometimes returns array directly)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        console.warn(`FMP returned empty array for ${symbol}`);
        return NextResponse.json({ 
          error: `No historical data available for symbol "${symbol}"`,
          details: 'FMP API returned empty results'
        }, { status: 404 });
      }
      // If it's an array, wrap it in historical property
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

    if (!data || !data.historical || !Array.isArray(data.historical)) {
      console.error('Invalid FMP response structure for', symbol, ':', data);
      return NextResponse.json({ 
        error: `No historical data available for symbol "${symbol}" or invalid response format`,
        details: 'Response structure does not contain historical array'
      }, { status: 404 });
    }

    // Transform the data to our format with null checks
    const historicalData = data.historical
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

    console.log(`Fetched ${historicalData.length} days of historical data for ${symbol} from FMP`);

    return NextResponse.json({
      symbol: data.symbol || symbol,
      historical: historicalData,
      count: historicalData.length
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

