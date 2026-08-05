import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAdmin } from '@/lib/auth/require-auth';
import { runCompanyFinderUpdate } from '@/app/utils/companyFinderUpdate';

/**
 * POST /api/company-finder/refresh
 * Daily batch scrape (SEC facts + quotes). Continues cursor across runs.
 * Auth: admin cookie OR x-cron-secret / x-keepalive-secret.
 * Body/query: { batchSize?, resetCursor?, cursorOffset? }
 */
export async function POST(request: NextRequest) {
  try {
    const cronSecret =
      process.env.KEEPALIVE_SECRET?.trim() || process.env.COMPANY_FINDER_CRON_SECRET?.trim();
    const provided =
      request.headers.get('x-keepalive-secret') || request.headers.get('x-cron-secret');
    const isCron = Boolean(cronSecret && provided && provided === cronSecret);

    if (!isCron) {
      const auth = await requireAuthAdmin(request);
      if (auth.response) return auth.response;
    }

    let batchSize: number | undefined;
    let resetCursor = false;
    let cursorOffset: number | undefined;
    try {
      const body = await request.json();
      if (body?.batchSize != null) batchSize = Number(body.batchSize);
      if (body?.resetCursor === true) resetCursor = true;
      if (body?.cursorOffset != null) cursorOffset = Number(body.cursorOffset);
    } catch {
      // empty body ok
    }

    const qs = request.nextUrl.searchParams;
    if (qs.get('batchSize')) batchSize = Number(qs.get('batchSize'));
    if (qs.get('resetCursor') === '1') resetCursor = true;
    if (qs.get('cursorOffset')) cursorOffset = Number(qs.get('cursorOffset'));

    const result = await runCompanyFinderUpdate({
      batchSize: Number.isFinite(batchSize) ? batchSize : 75,
      resetCursor,
      cursorOffset: Number.isFinite(cursorOffset as number) ? cursorOffset : undefined,
      mode: isCron ? 'cron' : 'admin',
    });

    return NextResponse.json({ ok: result.status !== 'error', ...result });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Company Finder tables missing',
          hint: 'Run scripts/migrations/030_company_finder.sql or node scripts/apply-company-finder.mjs',
        },
        { status: 500 }
      );
    }
    console.error('company-finder refresh error:', e);
    return NextResponse.json(
      { error: err.message || 'Company Finder refresh failed' },
      { status: 500 }
    );
  }
}
