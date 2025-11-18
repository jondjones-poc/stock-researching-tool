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
        .filter((item: any) => item.value !== '.')  // Filter out missing data points
        .map((item: any) => ({
          date: item.date,
          close: parseFloat(item.value),
          // FRED doesn't provide OHLCV, only closing values
          open: parseFloat(item.value),
          high: parseFloat(item.value),
          low: parseFloat(item.value),
          volume: 0, // No volume data for FRED indices
          change: 0,
          changePercent: 0
        }));

      console.log(`Fetched ${historicalData.length} observations for ${fredSeriesId} from FRED`);

      return NextResponse.json({
        symbol: symbol,
        historical: historicalData,
        count: historicalData.length
      });
    }

    // Otherwise use FMP API (default)
    let url = `https://financialmodelingprep.com/stable/historical-price-full?symbol=${symbol}&apikey=${FMP_API_KEY}`;
    
    if (from && to) {
      url += `&from=${from}&to=${to}`;
    }

    console.log('Fetching historical prices from FMP for:', symbol);

    const response = await axios.get(url);
    const data = response.data;

    if (!data || !data.historical) {
      return NextResponse.json({ error: 'No historical data available' }, { status: 404 });
    }

    // Transform the data to our format
    const historicalData = data.historical.map((item: any) => ({
      date: item.date,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close,
      volume: item.volume,
      change: item.change,
      changePercent: item.changePercent
    }));

    // Sort by date ascending (oldest first)
    historicalData.sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    console.log(`Fetched ${historicalData.length} days of historical data for ${symbol} from FMP`);

    return NextResponse.json({
      symbol: data.symbol,
      historical: historicalData,
      count: historicalData.length
    });

  } catch (error: any) {
    console.error('Error fetching historical prices:', error);
    console.error('Error details:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error message:', error.message);
    return NextResponse.json(
      { error: 'Failed to fetch historical price data', details: error.message },
      { status: 500 }
    );
  }
}

