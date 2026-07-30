import { NextRequest, NextResponse } from 'next/server';
import {
  FEAR_GREED_MIGRATION_HINT,
  getFearGreedCached,
} from '@/app/utils/fearGreedCache';

/**
 * GET /api/fear-greed
 * Returns CNN Fear & Greed history from DB cache (24h TTL).
 * Fetches live and stores when cache is missing/expired.
 *
 * Query: ?period=1Y|1M|5D|YTD|ALL — optional client-side filter hint only
 *        (full series is returned; clients may filter).
 */
export async function GET(_request: NextRequest) {
  try {
    const payload = await getFearGreedCached();
    const historical = payload.points.map((p) => ({
      date: p.date,
      close: p.value,
      volume: 0,
    }));

    return NextResponse.json({
      historical,
      points: payload.points,
      latestValue: payload.latestValue,
      latestDate: payload.latestDate,
      fetchedAt: payload.fetchedAt,
      fromCache: payload.fromCache,
      stale: payload.stale,
      ttlHours: 24,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          historical: [],
          points: [],
          error: 'Fear & Greed cache table missing',
          hint: FEAR_GREED_MIGRATION_HINT,
        },
        { status: 500 }
      );
    }
    console.error('fear-greed GET error:', err.message || e);
    return NextResponse.json(
      {
        historical: [],
        points: [],
        error: err.message || 'Failed to load Fear & Greed Index',
      },
      { status: 200 }
    );
  }
}

/**
 * POST /api/fear-greed
 * Clears DB cache and fetches live from CNN, then stores the new snapshot.
 */
export async function POST(_request: NextRequest) {
  try {
    const payload = await getFearGreedCached({ forceRefresh: true });
    const historical = payload.points.map((p) => ({
      date: p.date,
      close: p.value,
      volume: 0,
    }));

    return NextResponse.json({
      ok: true,
      historical,
      points: payload.points,
      latestValue: payload.latestValue,
      latestDate: payload.latestDate,
      fetchedAt: payload.fetchedAt,
      fromCache: false,
      stale: payload.stale,
      ttlHours: 24,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Fear & Greed cache table missing',
          hint: FEAR_GREED_MIGRATION_HINT,
        },
        { status: 500 }
      );
    }
    console.error('fear-greed POST refresh error:', err.message || e);
    return NextResponse.json(
      { error: err.message || 'Failed to refresh Fear & Greed Index' },
      { status: 502 }
    );
  }
}
