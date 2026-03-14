import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { query } from '../../../utils/db';
import { fmpSymbol, computeAnnualDpsFromFmpResponse } from '../../../utils/fmpDividend';

const FMP_API_KEY = process.env.FMP_API_KEY;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// GET - Test one symbol (e.g. ?symbol=NKE): fetch from FMP, return response shape + computed DPS, and update DB if found
export async function GET(request: NextRequest) {
  const symbol = (request.nextUrl.searchParams.get('symbol') || 'NKE').trim().toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: 'symbol query param required' }, { status: 400 });
  }
  if (!FMP_API_KEY) {
    return NextResponse.json({ error: 'FMP_API_KEY is not configured' }, { status: 500 });
  }

  try {
    const forFmp = fmpSymbol(symbol);
    const urls = [
      `https://financialmodelingprep.com/stable/dividends?symbol=${forFmp}&apikey=${FMP_API_KEY}`,
      `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${forFmp}&apikey=${FMP_API_KEY}`,
      `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${forFmp}?apikey=${FMP_API_KEY}`
    ];

    let annualDps = 0;
    let usedUrl = '';
    let rawData: any = null;
    let firstResponseStatus: number | null = null;
    let firstResponseKeys: string[] = [];

    for (const url of urls) {
      const res = await axios.get(url, { timeout: 10000, validateStatus: () => true });
      if (firstResponseStatus === null) {
        firstResponseStatus = res.status;
        if (res.data && typeof res.data === 'object') firstResponseKeys = Object.keys(res.data);
      }
      if (res.status !== 200 || !res.data) continue;
      if (res.data && typeof res.data === 'object' && res.data['Error Message']) continue;

      rawData = res.data;
      usedUrl = url.replace(FMP_API_KEY, '***');
      annualDps = computeAnnualDpsFromFmpResponse(res.data);
      if (annualDps > 0) break;
    }

    let listLength = 0;
    let firstItem: any = null;
    if (Array.isArray(rawData)) {
      listLength = rawData.length;
      firstItem = rawData[0];
    } else if (rawData?.historical) {
      listLength = rawData.historical.length;
      firstItem = rawData.historical[0];
    } else if (rawData?.dividends) {
      listLength = rawData.dividends.length;
      firstItem = rawData.dividends[0];
    } else if (rawData?.data) {
      listLength = rawData.data.length;
      firstItem = rawData.data[0];
    } else if (rawData && typeof rawData === 'object') {
      const keys = Object.keys(rawData);
      if (keys.length > 0 && keys.every((k) => /^\d+$/.test(k))) {
        const arr = Object.values(rawData);
        listLength = arr.length;
        firstItem = arr[0];
      } else {
        for (const key of keys) {
          if (Array.isArray(rawData[key]) && rawData[key].length > 0) {
            listLength = rawData[key].length;
            firstItem = rawData[key][0];
            break;
          }
        }
      }
    }

    let dbUpdated = false;
    let instrumentId: number | null = null;
    if (annualDps > 0) {
      const rowResult = await query(
        `SELECT instrument_id FROM stock_ticker_cache WHERE UPPER(TRIM(symbol_full)) = $1 LIMIT 1`,
        [symbol]
      );
      if (rowResult.rows?.length > 0) {
        instrumentId = rowResult.rows[0].instrument_id;
        await query(
          `UPDATE stock_ticker_cache SET dividend_per_share = $1, updated_at = CURRENT_TIMESTAMP WHERE instrument_id = $2`,
          [annualDps, instrumentId]
        );
        dbUpdated = true;
      }
    }

    return NextResponse.json({
      symbol,
      fmpSymbolUsed: forFmp,
      annualDps,
      dbUpdated,
      instrumentId,
      usedUrl,
      firstResponseStatus: firstResponseStatus ?? undefined,
      firstResponseKeys: firstResponseKeys.length > 0 ? firstResponseKeys.slice(0, 20) : undefined,
      responseShape: {
        topLevelKeys: rawData && typeof rawData === 'object' ? Object.keys(rawData).slice(0, 20) : [],
        listLength,
        firstItemKeys: firstItem && typeof firstItem === 'object' ? Object.keys(firstItem) : [],
        firstItemSample: firstItem && typeof firstItem === 'object' ? firstItem : null
      },
      message: annualDps > 0
        ? `Dividend per share: $${annualDps}${dbUpdated ? ', saved to stock_ticker_cache' : ', symbol not in cache'}.`
        : `No dividend data parsed.${firstResponseStatus ? ` First FMP response: ${firstResponseStatus}. Keys: ${firstResponseKeys.slice(0, 10).join(', ')}` : ''}`
    });
  } catch (err: any) {
    console.error('GET dividend-per-share test:', err);
    return NextResponse.json(
      { error: err.message || 'Test failed', symbol },
      { status: 500 }
    );
  }
}

// POST - Fetch dividend per share from FMP for each row in stock_ticker_cache and update dividend_per_share
export async function POST(_request: NextRequest) {
  try {
    if (!FMP_API_KEY) {
      return NextResponse.json(
        { error: 'FMP_API_KEY is not configured' },
        { status: 500 }
      );
    }

    const rowsResult = await query(
      `SELECT instrument_id, symbol_full
       FROM stock_ticker_cache
       WHERE symbol_full IS NOT NULL
         AND TRIM(symbol_full) != ''
         AND symbol_full NOT LIKE 'INSTRUMENT_%'
       ORDER BY instrument_id ASC`
    );

    const rows = rowsResult.rows || [];
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        total: 0,
        updated: 0,
        message: 'No rows in stock_ticker_cache with a valid symbol_full. Run "Get Stock Symbols" first.',
        errors: []
      });
    }

    let updated = 0;
    const errors: string[] = [];
    let firstSymbolDebug: { symbol: string; status: number; topLevelKeys?: string[]; firstItemKeys?: string[]; listLength?: number } | null = null;

    for (const row of rows) {
      const instrumentId = row.instrument_id;
      const symbol = String(row.symbol_full || '').trim();
      if (!symbol) continue;

      try {
        await sleep(400);
        const forFmp = fmpSymbol(symbol);
        const urlsToTry = [
          `https://financialmodelingprep.com/stable/dividends?symbol=${encodeURIComponent(forFmp)}&apikey=${FMP_API_KEY}`,
          `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${encodeURIComponent(forFmp)}&apikey=${FMP_API_KEY}`,
          `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${encodeURIComponent(forFmp)}?apikey=${FMP_API_KEY}`
        ];
        let divRes: any = null;
        for (const url of urlsToTry) {
          const res = await axios.get(url, { timeout: 10000, validateStatus: () => true });
          if (res.status === 200 && res.data && !res.data['Error Message']) {
            divRes = res;
            break;
          }
          await sleep(200);
        }

        if (!divRes) {
          errors.push(`${symbol}: no data from FMP`);
          continue;
        }
        if (divRes.status === 429) {
          errors.push(`${symbol}: FMP rate limit (429)`);
          continue;
        }

        let annualDps = computeAnnualDpsFromFmpResponse(divRes.data);

        if (updated === 0 && annualDps <= 0 && !firstSymbolDebug) {
          const data = divRes.data;
          let listLength = 0;
          let firstItem: any = null;
          if (Array.isArray(data)) {
            listLength = data.length;
            firstItem = data[0];
          } else if (data?.historical && Array.isArray(data.historical)) {
            listLength = data.historical.length;
            firstItem = data.historical[0];
          } else if (data?.dividends && Array.isArray(data.dividends)) {
            listLength = data.dividends.length;
            firstItem = data.dividends[0];
          } else if (data?.data && Array.isArray(data.data)) {
            listLength = data.data.length;
            firstItem = data.data[0];
          } else if (data && typeof data === 'object' && Object.keys(data).every((k) => /^\d+$/.test(k))) {
            const arr = Object.values(data);
            listLength = arr.length;
            firstItem = arr[0];
          }
          firstSymbolDebug = {
            symbol,
            status: divRes.status,
            topLevelKeys: data && typeof data === 'object' ? Object.keys(data).slice(0, 5) : undefined,
            firstItemKeys: firstItem && typeof firstItem === 'object' ? Object.keys(firstItem) : undefined,
            listLength
          };
        }

        if (annualDps <= 0) continue;

        await query(
          `UPDATE stock_ticker_cache
           SET dividend_per_share = $1, updated_at = CURRENT_TIMESTAMP
           WHERE instrument_id = $2`,
          [annualDps, instrumentId]
        );
        updated += 1;
      } catch (err: any) {
        errors.push(`${symbol}: ${err.message || 'Unknown error'}`);
      }
    }

    return NextResponse.json({
      success: true,
      total: rows.length,
      updated,
      message: `Updated dividend per share for ${updated} of ${rows.length} symbols in stock_ticker_cache.`,
      errors: errors.length > 0 ? errors : undefined,
      debug: updated === 0 && firstSymbolDebug ? { firstSymbolResponse: firstSymbolDebug, hint: 'Check topLevelKeys and firstItemKeys to see FMP response shape.' } : undefined
    });
  } catch (error: any) {
    console.error('Error updating dividend per share:', error);
    return NextResponse.json(
      { error: 'Failed to update dividend per share', details: error.message },
      { status: 500 }
    );
  }
}
