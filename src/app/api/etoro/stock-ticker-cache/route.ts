import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/utils/db';

/** GET - List all rows from stock_ticker_cache */
export async function GET() {
  try {
    let hasIsDividend = false;
    try {
      const col = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'is_dividend'`
      );
      hasIsDividend = col.rows.length > 0;
    } catch {
      // ignore
    }
    const cols = hasIsDividend
      ? 'instrument_id, symbol_full, display_name, exchange, type, updated_at, dividend_per_share, is_dividend'
      : 'instrument_id, symbol_full, display_name, exchange, type, updated_at, dividend_per_share';
    const sql = `SELECT ${cols} FROM stock_ticker_cache ORDER BY COALESCE(symbol_full, '') ASC, instrument_id ASC`;
    const result = await query(sql);
    const rows = result.rows.map((r: Record<string, unknown>) => ({
      instrumentId: r.instrument_id,
      symbolFull: r.symbol_full ?? '',
      displayName: r.display_name ?? '',
      exchange: r.exchange ?? '',
      type: r.type ?? '',
      updatedAt: r.updated_at,
      dividendPerShare: r.dividend_per_share != null ? Number(r.dividend_per_share) : null,
      ...(hasIsDividend ? { isDividend: r.is_dividend === true || r.is_dividend === 't' || r.is_dividend === 1 } : {}),
    }));
    return NextResponse.json({ rows });
  } catch (e: unknown) {
    console.error('stock-ticker-cache GET error:', e);
    return NextResponse.json(
      { error: 'Failed to fetch stock ticker cache', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** PATCH - Update one row by instrument_id. Body: { instrumentId, ...fields } */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const instrumentId = body?.instrumentId ?? body?.instrument_id;
    if (instrumentId == null || Number.isNaN(Number(instrumentId))) {
      return NextResponse.json({ error: 'instrumentId required' }, { status: 400 });
    }
    const id = Number(instrumentId);

    const allowed: Record<string, string> = {
      symbolFull: 'symbol_full',
      displayName: 'display_name',
      exchange: 'exchange',
      type: 'type',
      dividendPerShare: 'dividend_per_share',
      isDividend: 'is_dividend',
    };

    let hasIsDividend = false;
    try {
      const col = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'is_dividend'`
      );
      hasIsDividend = col.rows.length > 0;
    } catch {
      // ignore
    }

    const setParts: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [];
    let idx = 1;
    for (const [key, col] of Object.entries(allowed)) {
      if (key === 'isDividend' && !hasIsDividend) continue;
      if (!(key in body)) continue;
      const val = body[key];
      if (key === 'isDividend') {
        setParts.push(`${col} = $${idx}`);
        params.push(val === true || val === 'true' || val === 1);
      } else if (key === 'dividendPerShare') {
        setParts.push(`${col} = $${idx}`);
        params.push(val === '' || val === null || val === undefined ? null : Number(val));
      } else {
        setParts.push(`${col} = $${idx}`);
        params.push(val === null || val === undefined ? '' : String(val));
      }
      idx++;
    }
    if (params.length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }
    params.push(id);
    const sql = `UPDATE stock_ticker_cache SET ${setParts.join(', ')} WHERE instrument_id = $${idx} RETURNING instrument_id`;
    await query(sql, params);
    return NextResponse.json({ ok: true, instrumentId: id });
  } catch (e: unknown) {
    console.error('stock-ticker-cache PATCH error:', e);
    return NextResponse.json(
      { error: 'Failed to update row', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
