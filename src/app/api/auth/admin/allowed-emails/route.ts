import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/utils/db';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { noStoreHeaders } from '@/lib/auth/cookies';
import { requireAuthAdmin } from '@/lib/auth/require-auth';

export async function GET(request: NextRequest) {
  const auth = await requireAuthAdmin(request);
  if (auth.response) return applyCorsHeaders(request, auth.response);

  try {
    const result = await query(
      `SELECT id, email, role, created_at, updated_at
       FROM auth_allowed_email
       ORDER BY LOWER(email) ASC`
    );
    const res = NextResponse.json({ data: result.rows }, { headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  } catch (err) {
    console.error('allowed-emails GET:', err);
    const res = NextResponse.json(
      { error: 'Failed to load allowed emails' },
      { status: 500, headers: noStoreHeaders() }
    );
    return applyCorsHeaders(request, res);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthAdmin(request);
  if (auth.response) return applyCorsHeaders(request, auth.response);

  try {
    const body = (await request.json()) as { email?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    const role = body.role === 'admin' ? 'admin' : 'user';

    if (!email || !email.includes('@')) {
      const res = NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: noStoreHeaders() }
      );
      return applyCorsHeaders(request, res);
    }

    const result = await query(
      `INSERT INTO auth_allowed_email (email, role)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, role, created_at, updated_at`,
      [email, role]
    );

    const res = NextResponse.json({ data: result.rows[0] }, { headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  } catch (err) {
    console.error('allowed-emails POST:', err);
    const res = NextResponse.json(
      { error: 'Failed to add allowed email' },
      { status: 500, headers: noStoreHeaders() }
    );
    return applyCorsHeaders(request, res);
  }
}
