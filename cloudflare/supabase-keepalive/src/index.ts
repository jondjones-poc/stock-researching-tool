export interface Env {
  KEEPALIVE_URL: string;
  /** Same value as KEEPALIVE_SECRET on the Next.js app (Bearer token). */
  KEEPALIVE_SECRET: string;
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

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const out = await pingKeepalive(env);
    if (!out.ok) {
      console.error('keepalive ping failed', await out.text());
    }
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    return pingKeepalive(env);
  },
};
