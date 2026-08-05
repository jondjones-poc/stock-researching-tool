import { NextRequest, NextResponse } from 'next/server';
import { requireAuthAdmin } from '@/lib/auth/require-auth';

/**
 * POST /api/company-finder/trigger-scrape
 * Admin-only: ask the Cloudflare worker to kick off a company-finder batch
 * (worker then POSTs /api/company-finder/refresh with the cron secret).
 *
 * Env: COMPANY_FINDER_WORKER_URL = https://….workers.dev/company-finder
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthAdmin(request);
    if (auth.response) return auth.response;

    const workerUrl = process.env.COMPANY_FINDER_WORKER_URL?.trim();
    if (!workerUrl) {
      return NextResponse.json(
        {
          error: 'COMPANY_FINDER_WORKER_URL is not set',
          hint: 'Set it to your Cloudflare worker …/company-finder URL (e.g. https://share-research-supabase-keepalive.<account>.workers.dev/company-finder)',
        },
        { status: 500 }
      );
    }

    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: 'Cloudflare worker rejected the scrape trigger',
          status: res.status,
          body,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      triggered: true,
      worker: workerUrl,
      workerResponse: body,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('company-finder trigger-scrape error:', e);
    return NextResponse.json(
      { error: err.message || 'Failed to trigger Cloudflare scrape worker' },
      { status: 500 }
    );
  }
}
