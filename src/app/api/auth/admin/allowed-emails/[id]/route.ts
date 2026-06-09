import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/utils/db';
import { applyCorsHeaders } from '@/lib/auth/cors';
import { noStoreHeaders } from '@/lib/auth/cookies';
import { requireAuthAdmin } from '@/lib/auth/require-auth';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthAdmin(request);
  if (auth.response) return applyCorsHeaders(request, auth.response);

  const { id: idParam } = await context.params;
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const res = NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  }

  try {
    const body = (await request.json()) as { role?: string };
    if (body.role !== 'admin' && body.role !== 'user') {
      const res = NextResponse.json({ error: 'role must be admin or user' }, { status: 400, headers: noStoreHeaders() });
      return applyCorsHeaders(request, res);
    }

    const result = await query(
      `UPDATE auth_allowed_email
       SET role = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, email, role, created_at, updated_at`,
      [body.role, id]
    );

    if (result.rows.length === 0) {
      const res = NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() });
      return applyCorsHeaders(request, res);
    }

    const res = NextResponse.json({ data: result.rows[0] }, { headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  } catch (err) {
    console.error('allowed-emails PATCH:', err);
    const res = NextResponse.json({ error: 'Failed to update allowed email' }, { status: 500, headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuthAdmin(request);
  if (auth.response) return applyCorsHeaders(request, auth.response);

  const { id: idParam } = await context.params;
  const id = parseInt(idParam, 10);
  if (!Number.isInteger(id) || id <= 0) {
    const res = NextResponse.json({ error: 'Invalid id' }, { status: 400, headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  }

  try {
    const result = await query(`DELETE FROM auth_allowed_email WHERE id = $1 RETURNING id`, [id]);
    if (result.rows.length === 0) {
      const res = NextResponse.json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() });
      return applyCorsHeaders(request, res);
    }

    const res = NextResponse.json({ success: true }, { headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  } catch (err) {
    console.error('allowed-emails DELETE:', err);
    const res = NextResponse.json({ error: 'Failed to delete allowed email' }, { status: 500, headers: noStoreHeaders() });
    return applyCorsHeaders(request, res);
  }
}
