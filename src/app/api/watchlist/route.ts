import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getAllWatchlistSymbols } from '../../config/dashboard';

const FMP_API_KEY = process.env.FMP_API_KEY;
const FRED_API_KEY = process.env.FRED_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbols = searchParams.get('symbols');
    
    if (!symbols) {
      return NextResponse.json({ error: 'Symbols parameter is required' }, { status: 400 });
    }

    const symbolList = symbols.split(',');
    const allSymbols = getAllWatchlistSymbols();
    
    if (!FMP_API_KEY) {
      return NextResponse.json({ error: 'FMP API key not configured' }, { status: 500 });
    }

    // Separate FMP and FRED symbols
    const fmpSymbols: string[] = [];
    const fredSymbols: { symbol: string; seriesId: string }[] = [];
    
    symbolList.forEach(symbol => {
      const config = allSymbols.find(s => s.symbol === symbol);
      if (config?.dataSource === 'FRED' && config.fredSeriesId) {
        fredSymbols.push({ symbol, seriesId: config.fredSeriesId });
      } else {
        fmpSymbols.push(symbol);
      }
    });

    const watchlistData: any[] = [];

    // Fetch FMP quotes
    if (fmpSymbols.length > 0) {
      const response = await axios.get(
        `https://financialmodelingprep.com/api/v3/quote/${fmpSymbols.join(',')}?apikey=${FMP_API_KEY}`,
        { timeout: 10000 }
      );

      if (response.data && Array.isArray(response.data)) {
        response.data.forEach((quote: any) => {
          const change = quote.change || 0;
          const changePercent = quote.changesPercentage || 0;
          
          watchlistData.push({
            symbol: quote.symbol,
            name: quote.name,
            last: quote.price || 0,
            change: change,
            changePercent: changePercent,
            volume: quote.volume || 0,
            marketCap: quote.marketCap || 0,
            isPositive: change >= 0
          });
        });
      }
    }

    // Fetch FRED data (latest value for each series)
    if (fredSymbols.length > 0 && FRED_API_KEY) {
      for (const fredSymbol of fredSymbols) {
        try {
          const fredUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=${fredSymbol.seriesId}&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`;
          
          const fredResponse = await axios.get(fredUrl, { timeout: 10000 });
          
          if (fredResponse.data?.observations) {
            const observations = fredResponse.data.observations.filter((obs: any) => obs.value !== '.');
            
            if (observations.length >= 1) {
              const latest = observations[0];
              const previous = observations.length >= 2 ? observations[1] : latest;
              
              const latestValue = parseFloat(latest.value);
              const previousValue = parseFloat(previous.value);
              const change = latestValue - previousValue;
              const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;
              
              watchlistData.push({
                symbol: fredSymbol.symbol,
                name: allSymbols.find(s => s.symbol === fredSymbol.symbol)?.name || fredSymbol.symbol,
                last: latestValue,
                change: change,
                changePercent: changePercent,
                volume: 0, // FRED doesn't provide volume
                marketCap: 0, // Not applicable for indices
                isPositive: change >= 0
              });
            }
          }
        } catch (fredError) {
          console.error(`Error fetching FRED data for ${fredSymbol.symbol}:`, fredError);
          // Continue with other symbols even if one fails
        }
      }
    }

    return NextResponse.json({
      data: watchlistData,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Watchlist API error:', error.message);
    
    if (error.response?.status === 429) {
      return NextResponse.json({ error: 'API rate limit exceeded' }, { status: 429 });
    }
    
    if (error.code === 'ECONNABORTED') {
      return NextResponse.json({ error: 'Request timeout' }, { status: 408 });
    }
    
    return NextResponse.json({ error: 'Failed to fetch watchlist data' }, { status: 500 });
  }
}
