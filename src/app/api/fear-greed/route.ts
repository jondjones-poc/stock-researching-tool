import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

interface FearGreedPoint {
  date: string;
  value: number;
}

export async function GET(_request: NextRequest) {
  try {
    const url = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
    const response = await axios.get(url, { timeout: 10000 });

    const data = response.data || {};

    let points: FearGreedPoint[] = [];

    // CNN Fear & Greed API (current structure):
    // "fear_and_greed_historical": {
    //   "timestamp": 1772154000000,
    //   "score": 44.42,
    //   "rating": "fear",
    //   "data": [ { "x": 1740614400000, "y": 12.75, "rating": "extreme fear" }, ... ]
    // }
    const fngHist = data.fear_and_greed_historical;
    if (fngHist && Array.isArray(fngHist.data)) {
      points = fngHist.data
        .filter((p: any) => typeof p?.x !== 'undefined' && typeof p?.y !== 'undefined')
        .map((p: any) => ({
          date: new Date(p.x).toISOString().split('T')[0],
          value: Number(p.y),
        }));
    }

    // Defensive fallbacks for any legacy/alternative shapes
    if (!points.length) {
      // Legacy structure: array of { x, y } or object with x[] / y[]
      const historical = data.historical || data.data;
      if (historical) {
        if (Array.isArray(historical)) {
          points = historical
            .filter((p: any) => typeof p?.x !== 'undefined' && typeof p?.y !== 'undefined')
            .map((p: any) => ({
              date: new Date(p.x).toISOString().split('T')[0],
              value: Number(p.y),
            }));
        } else if (Array.isArray(historical.x) && Array.isArray(historical.y)) {
          points = historical.x.map((x: any, idx: number) => ({
            date: new Date(x).toISOString().split('T')[0],
            value: Number(historical.y[idx]),
          }));
        }
      }
    }

    // Sort by date ascending
    points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

    const historicalData = points.map(p => ({
      date: p.date,
      close: p.value,
      volume: 0,
    }));

    return NextResponse.json({ historical: historicalData }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching Fear & Greed data:', error?.message || error);
    // Return empty historical array but keep 200 so the frontend can degrade gracefully
    return NextResponse.json(
      { historical: [], error: 'Failed to fetch Fear & Greed Index data' },
      { status: 200 }
    );
  }
}

