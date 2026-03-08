import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '../../utils/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const queryParam = searchParams.get('query') || '*';
  const mode = searchParams.get('mode') || 'GeoJSON';
  const format = searchParams.get('format') || 'json';

  // Create cache key from query parameters
  const cacheKey = `gdelt_${queryParam}_${mode}_${format}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  try {
    // Check cache first
    try {
      const cacheResult = await query(
        `SELECT news_data, cached_at, expires_at 
         FROM news_cache 
         WHERE symbol = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [cacheKey]
      );

      if (cacheResult.rows.length > 0) {
        const cachedData = cacheResult.rows[0];
        const cachedLocations = typeof cachedData.news_data === 'string' 
          ? JSON.parse(cachedData.news_data) 
          : cachedData.news_data;
        
        console.log(`[GDELT Cache] Returning cached data for "${queryParam}" (cached at: ${cachedData.cached_at})`);
        return NextResponse.json({ 
          query: queryParam,
          locations: cachedLocations.locations || cachedLocations,
          count: cachedLocations.locations?.length || cachedLocations.length || 0,
          cached: true,
          cached_at: cachedData.cached_at
        });
      }
    } catch (dbError: any) {
      // If table doesn't exist yet, log and continue to fetch from API
      if (dbError.message?.includes('does not exist')) {
        console.log(`[GDELT Cache] Cache table doesn't exist yet, fetching from API`);
      } else {
        console.error(`[GDELT Cache] Error checking cache:`, dbError.message);
        // Continue to fetch from API if cache check fails
      }
    }

    // Cache expired or doesn't exist, fetch from API
    // GDELT API endpoint for geographic data
    // Try GeoJSON mode first for location data, then fallback to other modes
    let url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(queryParam)}&mode=GeoJSON&format=json`;
    
    console.log('[GDELT API] Fetching data from:', url);

    let response = await axios.get(url, {
      timeout: 15000,
      validateStatus: () => true
    });

    let data = response.data;
    let locations: Array<{
      lat: number;
      lng: number;
      title: string;
      date: string;
      url?: string;
      value?: number;
    }> = [];

    // If GeoJSON mode doesn't return features, try ArtList mode which includes location data
    if (response.status === 200 && (!data.features || data.features.length === 0)) {
      console.log('GeoJSON mode returned no features, trying ArtList mode...');
      url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(queryParam)}&mode=ArtList&format=json&maxrecords=100`;
      response = await axios.get(url, {
        timeout: 15000,
        validateStatus: () => true
      });
      data = response.data;
    }

    // Handle rate limiting (429) and other errors
    if (response.status === 429) {
      console.warn('GDELT API rate limit hit (429). Please wait before making another request.');
      return NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'The GDELT API has rate-limited this request. Please wait a few moments before trying again.',
          locations: []
        },
        { status: 429 }
      );
    }

    if (response.status !== 200) {
      console.error('GDELT API error:', response.status, response.data);
      return NextResponse.json(
        { 
          error: 'Failed to fetch GDELT data',
          message: `GDELT API returned status ${response.status}. ${response.status === 404 ? 'Query may not have returned results.' : 'Please try again later.'}`,
          details: response.data,
          locations: []
        },
        { status: response.status }
      );
    }

    // Transform GDELT data to include geographic coordinates
    if (data.features && Array.isArray(data.features)) {
      // GeoJSON format with features
      locations = data.features
        .filter((feature: any) => feature.geometry && feature.geometry.coordinates)
        .map((feature: any) => {
          const coords = feature.geometry.coordinates;
          // GeoJSON uses [lng, lat] format for Point geometry
          const lng = Array.isArray(coords) ? coords[0] : coords.longitude || 0;
          const lat = Array.isArray(coords) ? coords[1] : coords.latitude || 0;
          return {
            lng: typeof lng === 'number' ? lng : 0,
            lat: typeof lat === 'number' ? lat : 0,
            title: feature.properties?.title || feature.properties?.name || feature.properties?.snippet || 'Event',
            date: feature.properties?.date || feature.properties?.datetime || new Date().toISOString(),
            url: feature.properties?.url || feature.properties?.sourceurl || feature.properties?.url_mobile,
            value: feature.properties?.value || feature.properties?.intensity || feature.properties?.tone
          };
        });
    } else if (data.articles && Array.isArray(data.articles)) {
      // ArtList mode returns articles - may have lat/lng or just sourcecountry
      // Country center coordinates (approximate)
      const countryCenters: { [key: string]: { lat: number; lng: number } } = {
        'China': { lat: 35.8617, lng: 104.1954 },
        'Indonesia': { lat: -0.7893, lng: 113.9213 },
        'Egypt': { lat: 26.0975, lng: 31.2357 },
        'Turkey': { lat: 38.9637, lng: 35.2433 },
        'India': { lat: 20.5937, lng: 78.9629 },
        'Bangladesh': { lat: 23.6850, lng: 90.3563 },
        'Thailand': { lat: 15.8700, lng: 100.9925 },
        'Hungary': { lat: 47.1625, lng: 19.5033 },
        'United States': { lat: 37.0902, lng: -95.7129 },
        'USA': { lat: 37.0902, lng: -95.7129 }
      };

      locations = data.articles
        .map((article: any) => {
          // Try to get coordinates from article
          let lat = article.latitude ? parseFloat(article.latitude) : null;
          let lng = article.longitude ? parseFloat(article.longitude) : null;

          // If no coordinates but we have sourcecountry, use country center
          if ((!lat || !lng) && article.sourcecountry) {
            const countryCoords = countryCenters[article.sourcecountry];
            if (countryCoords) {
              lat = countryCoords.lat;
              lng = countryCoords.lng;
            }
          }

          // Only include if we have valid coordinates
          if (lat && lng && lat !== 0 && lng !== 0) {
            return {
              lat: lat,
              lng: lng,
              title: article.title || article.snippet || 'Event',
              date: article.datetime || article.seendate || article.date || new Date().toISOString(),
              url: article.url || article.url_mobile,
              value: article.tone || article.avg_tone,
              country: article.sourcecountry || article.language
            };
          }
          return null;
        })
        .filter((loc: any) => loc !== null);
    } else if (data.points && Array.isArray(data.points)) {
      // Alternative format with points array
      locations = data.points
        .filter((point: any) => point.latitude && point.longitude)
        .map((point: any) => ({
          lat: parseFloat(point.latitude) || parseFloat(point.lat) || 0,
          lng: parseFloat(point.longitude) || parseFloat(point.lng) || 0,
          title: point.title || point.name || 'Event',
          date: point.date || new Date().toISOString(),
          url: point.url || point.sourceurl,
          value: point.value || point.intensity
        }));
    } else if (data.timeline && data.timeline.length > 0) {
      // Timeline data doesn't have geographic coordinates
      // Return empty with helpful message
      console.warn('GDELT returned timeline data but no geographic coordinates.');
      return NextResponse.json({
        query: queryParam,
        locations: [],
        count: 0,
        message: 'Timeline data returned but no geographic coordinates available. Try a different query or check GDELT API documentation for geographic data modes.',
        raw: data
      });
    }

    const result = {
      query: queryParam,
      locations: locations,
      count: locations.length
    };

    // Store in cache (24 hour expiration)
    try {
      await query(
        `INSERT INTO news_cache (symbol, news_data, cached_at, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '24 hours')
         ON CONFLICT (symbol) 
         DO UPDATE SET 
           news_data = EXCLUDED.news_data,
           cached_at = CURRENT_TIMESTAMP,
           expires_at = CURRENT_TIMESTAMP + INTERVAL '24 hours'`,
        [cacheKey, JSON.stringify(result)]
      );
      console.log(`[GDELT Cache] Cached data for "${queryParam}" (expires in 24 hours)`);
    } catch (cacheError: any) {
      // If table doesn't exist yet, log but don't fail the request
      if (cacheError.message?.includes('does not exist')) {
        console.log(`[GDELT Cache] Cache table doesn't exist yet. Please run create_news_cache_table.sql`);
      } else {
        console.error(`[GDELT Cache] Error caching data:`, cacheError.message);
        // Don't fail the request if caching fails
      }
    }

    return NextResponse.json({
      ...result,
      cached: false
    });

  } catch (error: any) {
    console.error('Error fetching GDELT data:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch GDELT data',
        details: error.message,
        locations: []
      },
      { status: 500 }
    );
  }
}
