export interface Env {
  KEEPALIVE_URL: string;
  /** Same value as KEEPALIVE_SECRET on the Next.js app (Bearer / x-cron-secret). */
  KEEPALIVE_SECRET: string;
  /**
   * Full URL to POST /api/company-finder/refresh on the Next.js host.
   * e.g. https://your-app.onrender.com/api/company-finder/refresh
   */
  COMPANY_FINDER_REFRESH_URL?: string;
}

async function pingKeepalive(env: Env): Promise<Response> {
  const { KEEPALIVE_URL, KEEPALIVE_SECRET } = env;
  if (!KEEPALIVE_URL || !KEEPALIVE_SECRET) {
    return new Response(
      JSON.stringify({ ok: false, error: 'KEEPALIVE_URL and KEEPALIVE_SECRET must be set' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const res = await fetch(KEEPALIVE_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${KEEPALIVE_SECRET}`,
    },
  });

  const bodyText = await res.text();
  return new Response(
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      body: bodyText.slice(0, 2000),
    }),
    { status: res.ok ? 200 : 502, headers: { 'content-type': 'application/json' } }
  );
}

/** Fire-and-forget scrape against the Next.js refresh route (uses cron secret). */
async function runCompanyFinderScrape(env: Env): Promise<Response> {
  const url = env.COMPANY_FINDER_REFRESH_URL?.trim();
  const secret = env.KEEPALIVE_SECRET?.trim();
  if (!url || !secret) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: 'COMPANY_FINDER_REFRESH_URL and KEEPALIVE_SECRET must be set',
      }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': secret,
      'x-keepalive-secret': secret,
    },
    body: JSON.stringify({ batchSize: 75 }),
  });

  const bodyText = await res.text();
  return new Response(
    JSON.stringify({
      ok: res.ok,
      status: res.status,
      body: bodyText.slice(0, 4000),
    }),
    { status: res.ok ? 200 : 502, headers: { 'content-type': 'application/json' } }
  );
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const keepalive = await pingKeepalive(env);
    if (!keepalive.ok) {
      console.error('keepalive ping failed', await keepalive.text());
    }

    if (env.COMPANY_FINDER_REFRESH_URL) {
      ctx.waitUntil(
        runCompanyFinderScrape(env).then(async (out) => {
          if (!out.ok) console.error('company-finder scrape failed', await out.text());
        })
      );
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const path = new URL(request.url).pathname.replace(/\/+$/, '') || '/';

    // Manual / button trigger: /company-finder
    if (path === '/company-finder' || path.endsWith('/company-finder')) {
      // Return quickly; scrape continues on the Next.js host (may take minutes).
      const scrapePromise = runCompanyFinderScrape(env);
      ctx.waitUntil(
        scrapePromise.then(async (out) => {
          if (!out.ok) console.error('company-finder scrape failed', await out.text());
        })
      );
      return json({
        ok: true,
        accepted: true,
        job: 'company-finder',
        message: 'Scrape batch accepted; running on app host via /api/company-finder/refresh',
      });
    }

    // Default: Supabase keepalive ping
    return pingKeepalive(env);
  },
};
