import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.ALPHA_VANTAGE;
    if (!apiKey) {
      return NextResponse.json({ error: 'Alpha Vantage API key not configured' }, { status: 500 });
    }

    // Use Alpha Vantage News & Sentiments API
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&limit=5&apikey=${apiKey}`;
    
    console.log(`Fetching news for ${symbol} from Alpha Vantage`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error(`Alpha Vantage API error for ${symbol}:`, response.status);
      return NextResponse.json({ error: 'Failed to fetch news data' }, { status: response.status });
    }

    const rawData = await response.json();
    
    // Check for API errors
    if (rawData['Error Message'] || rawData['Note']) {
      console.error(`Alpha Vantage API error:`, rawData);
      return NextResponse.json({ error: rawData['Error Message'] || rawData['Note'] }, { status: 429 });
    }
    
    // Filter and transform the data to only include news items that mention the ticker
    const allNews = rawData.feed || [];
    
    const filteredNews = allNews
      .map((item: any) => {
        // Find sentiment for the specific ticker
        const tickerSentiment = item.ticker_sentiment?.find((t: any) => 
          t.ticker.toLowerCase() === symbol.toLowerCase()
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
    
    console.log(`Filtered ${filteredNews.length} relevant news items for ${symbol}`);
    
    return NextResponse.json({ data: filteredNews });
  } catch (error) {
    console.error('Error fetching news data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

