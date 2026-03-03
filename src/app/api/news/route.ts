import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const symbolUpper = symbol.toUpperCase();

    // Check cache first
    try {
      const cacheResult = await query(
        `SELECT news_data, cached_at, expires_at 
         FROM news_cache 
         WHERE symbol = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [symbolUpper]
      );

      if (cacheResult.rows.length > 0) {
        const cachedData = cacheResult.rows[0];
        console.log(`[News Cache] Returning cached news for ${symbolUpper} (cached at: ${cachedData.cached_at})`);
        return NextResponse.json({ 
          data: cachedData.news_data,
          cached: true,
          cached_at: cachedData.cached_at
        });
      }
    } catch (dbError: any) {
      // If table doesn't exist yet, log and continue to fetch from API
      if (dbError.message?.includes('does not exist')) {
        console.log(`[News Cache] Cache table doesn't exist yet, fetching from API`);
      } else {
        console.error(`[News Cache] Error checking cache:`, dbError.message);
        // Continue to fetch from API if cache check fails
      }
    }

    // Cache expired or doesn't exist, fetch from API
    const apiKey = process.env.ALPHA_VANTAGE;
    if (!apiKey) {
      return NextResponse.json({ error: 'Alpha Vantage API key not configured' }, { status: 500 });
    }

    // Use Alpha Vantage News & Sentiments API
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbolUpper}&limit=5&apikey=${apiKey}`;
    
    console.log(`[News API] Fetching news for ${symbolUpper} from Alpha Vantage`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`[News API] Alpha Vantage API error for ${symbolUpper}:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch news data' }, { status: response.status });
    }

    const rawData = await response.json();
    
    // Check for API errors
    if (rawData['Error Message'] || rawData['Note']) {
      console.error(`[News API] Alpha Vantage API error:`, rawData);
      return NextResponse.json({ error: rawData['Error Message'] || rawData['Note'] }, { status: 429 });
    }
    
    // Filter and transform the data to only include news items that mention the ticker
    const allNews = rawData.feed || [];
    
    const filteredNews = allNews
      .map((item: any) => {
        // Find sentiment for the specific ticker
        const tickerSentiment = item.ticker_sentiment?.find((t: any) => 
          t.ticker.toLowerCase() === symbolUpper.toLowerCase()
        );
        
        // Only include if this ticker is mentioned
        if (!tickerSentiment) {
          return null;
        }
        
        return {
          title: item.title,
          url: item.url,
          time_published: item.time_published,
          authors: item.authors || [],
          summary: item.summary,
          source: item.source,
          sentiment_label: tickerSentiment.ticker_sentiment_label,
          sentiment_score: parseFloat(tickerSentiment.ticker_sentiment_score),
          relevance_score: parseFloat(tickerSentiment.relevance_score)
        };
      })
      .filter((item: any) => item !== null) // Remove null items
      .sort((a: any, b: any) => b.relevance_score - a.relevance_score) // Sort by relevance
      .slice(0, 5); // Take top 5
    
    console.log(`[News API] Filtered ${filteredNews.length} relevant news items for ${symbolUpper}`);
    
    // Store in cache (upsert - insert or update if exists)
    try {
      await query(
        `INSERT INTO news_cache (symbol, news_data, cached_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (symbol) 
         DO UPDATE SET 
           news_data = EXCLUDED.news_data,
           cached_at = CURRENT_TIMESTAMP`,
        [symbolUpper, JSON.stringify(filteredNews)]
      );
      console.log(`[News Cache] Cached news for ${symbolUpper} (expires in 24 hours)`);
    } catch (cacheError: any) {
      // If table doesn't exist yet, log but don't fail the request
      if (cacheError.message?.includes('does not exist')) {
        console.log(`[News Cache] Cache table doesn't exist yet. Please run create_news_cache_table.sql`);
      } else {
        console.error(`[News Cache] Error caching news:`, cacheError.message);
        // Don't fail the request if caching fails
      }
    }
    
    return NextResponse.json({ 
      data: filteredNews,
      cached: false
    });
  } catch (error: any) {
    console.error('[News API] Error fetching news data:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

