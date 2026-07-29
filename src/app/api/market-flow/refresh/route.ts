import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAdmin } from '@/lib/auth/require-auth';
import { runMarketFlowUpdate } from '@/app/utils/marketFlowUpdate';

/**
 * POST — admin manual refresh (imports/updates prices, recomputes returns).
 * Optional body: { forceFullHistory?: boolean }
 * Optional header: x-keepalive-secret matching KEEPALIVE_SECRET for cron without admin cookie.
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.KEEPALIVE_SECRET?.trim() || process.env.MARKET_FLOW_CRON_SECRET?.trim();
    const provided = request.headers.get('x-keepalive-secret') || request.headers.get('x-cron-secret');
    const isCron = Boolean(cronSecret && provided && provided === cronSecret);

    if (!isCron) {
      const auth = await requireAuthAdmin(request);
      if (auth.response) return auth.response;
    }

    let forceFullHistory = false;
    try {
      const body = await request.json();
      forceFullHistory = body?.forceFullHistory === true;
    } catch {
      // empty body ok
    }

    const result = await runMarketFlowUpdate({ forceFullHistory });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Market Flow tables missing',
          hint: 'Run scripts/migrations/026_market_flow_tracker.sql or node scripts/apply-market-flow-tracker.mjs',
        },
        { status: 500 }
      );
    }
    console.error('market-flow refresh error:', e);
    return NextResponse.json(
      { error: 'Refresh failed', details: err.message },
      { status: 500 }
    );
  }
}
