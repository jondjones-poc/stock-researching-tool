import { NextResponse } from 'next/server';

const GEOJSON_URL =
  'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

let cachedGeoJson: unknown = null;
let cachedAt = 0;
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedGeoJson && now - cachedAt < CACHE_MS) {
      return NextResponse.json(cachedGeoJson, {
        headers: { 'Cache-Control': 'public, max-age=86400' },
      });
    }

    const response = await fetch(GEOJSON_URL);
    if (!response.ok) {
      throw new Error(`GeoJSON fetch failed (${response.status})`);
    }

    cachedGeoJson = await response.json();
    cachedAt = now;

    return NextResponse.json(cachedGeoJson, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('World markets GeoJSON error:', message);
    return NextResponse.json({ error: 'Failed to load map data', details: message }, { status: 502 });
  }
}
