import { NextRequest, NextResponse } from 'next/server';
import { requireAuthUser } from '@/lib/auth/require-auth';
import { refreshDashboardStockQuotes } from '@/app/utils/dashboardStockQuotes';

/**
 * POST /api/dashboard-watchlist/refresh
 * Warm homepage stock quotes from Finnhub into dashboard_stock_quotes.
 * Auth: logged-in user OR x-cron-secret / x-keepalive-secret.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret =
      process.env.KEEPALIVE_SECRET?.trim() ||
      process.env.DASHBOARD_STOCK_QUOTES_CRON_SECRET?.trim();
    const provided =
      request.headers.get('x-keepalive-secret') || request.headers.get('x-cron-secret');
    const isCron = Boolean(cronSecret && provided && provided === cronSecret);

    if (!isCron) {
      const auth = await requireAuthUser(request);
      if (auth.response) return auth.response;
    }

    const result = await refreshDashboardStockQuotes();

    return NextResponse.json({
      ok: result.ok,
      mode: isCron ? 'cron' : 'user',
      symbolCount: result.symbolCount,
      refreshedCount: result.refreshedCount,
      failed: result.failed,
      warning: result.warning,
      cacheUpdatedAt: result.cacheUpdatedAt,
      source: 'FINNHUB',
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    console.error('dashboard-watchlist refresh failed:', err.message || e);
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          ok: false,
          error: 'Table dashboard_stock_quotes does not exist',
          hint: 'Run: node scripts/apply-dashboard-stock-quotes.mjs',
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { ok: false, error: err.message || 'Refresh failed' },
      { status: 500 }
    );
  }
}
