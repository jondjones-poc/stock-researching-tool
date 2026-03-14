import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { query } from '../../../utils/db';

const ETORO_PUBLIC_KEY = process.env.ETORO_PUBLIC_KEY;
const ETORO_PRIVATE_KEY = process.env.ETORO_PRIVATE_KEY;
const FMP_API_KEY = process.env.FMP_API_KEY;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST - Fetch missing stock symbols from eToro API and cache them
export async function POST(request: NextRequest) {
  try {
    if (!ETORO_PUBLIC_KEY || !ETORO_PRIVATE_KEY) {
      return NextResponse.json(
        { error: 'eToro API keys are not configured' },
        { status: 500 }
      );
    }

    // Get all unique instrument IDs from portfolio_data table
    // First, check if table exists and has data
    let tableStats: any = {};
    try {
      const tableCheck = await query(
        `SELECT COUNT(*) as total_rows, 
                COUNT(DISTINCT instrument_id) as unique_ids,
                COUNT(CASE WHEN instrument_id IS NOT NULL THEN 1 END) as non_null_ids
         FROM portfolio_data`
      );
      
      tableStats = tableCheck.rows[0] || {};
      console.log('Portfolio data table check:', tableStats);
    } catch (dbErr: any) {
      console.error('Error checking portfolio_data table:', dbErr);
      return NextResponse.json(
        { 
          error: 'Database error', 
          details: dbErr.message,
          hint: 'Make sure portfolio_data table exists'
        },
        { status: 500 }
      );
    }
    
    // Get all unique instrument IDs
    let portfolioResult;
    try {
      portfolioResult = await query(
        `SELECT DISTINCT instrument_id 
         FROM portfolio_data 
         WHERE instrument_id IS NOT NULL
         ORDER BY instrument_id ASC`
      );
    } catch (dbErr: any) {
      console.error('Error querying portfolio_data:', dbErr);
      return NextResponse.json(
        { 
          error: 'Database query error', 
          details: dbErr.message
        },
        { status: 500 }
      );
    }

    if (!portfolioResult || !portfolioResult.rows) {
      return NextResponse.json(
        { 
          error: 'Database query returned invalid result',
          details: 'portfolioResult is null or undefined'
        },
        { status: 500 }
      );
    }

    console.log(`Query returned ${portfolioResult.rows.length} rows`);
    console.log('Raw query result rows:', portfolioResult.rows.slice(0, 5));
    
    if (portfolioResult.rows.length > 0) {
      console.log('Sample instrument IDs:', portfolioResult.rows.slice(0, 5).map((r: any) => ({
        instrument_id: r.instrument_id,
        type: typeof r.instrument_id,
        value: r.instrument_id
      })));
    }

    if (portfolioResult.rows.length === 0) {
      return NextResponse.json({
        message: 'No instrument IDs found in portfolio_data table',
        debug: {
          totalRows: tableStats?.total_rows || 0,
          uniqueIds: tableStats?.unique_ids || 0,
          nonNullIds: tableStats?.non_null_ids || 0,
          queryResultCount: portfolioResult.rows.length
        },
        fetched: 0,
        cached: 0,
        errors: []
      });
    }

    // Extract instrument IDs - handle both string and number types
    const instrumentIds = portfolioResult.rows.map((row: any) => {
      const id = row.instrument_id;
      // Convert to number if it's a string
      return typeof id === 'string' ? parseInt(id) : id;
    }).filter((id: any) => id && !isNaN(id));
    
    console.log(`Found ${instrumentIds.length} unique instrument IDs in portfolio_data:`, instrumentIds.slice(0, 10));

    // Check which instrument IDs are already in stock_ticker_cache
    let cacheResult;
    if (instrumentIds.length === 0) {
      // Return empty result if no instrument IDs
      cacheResult = { rows: [] };
    } else {
      const cachePlaceholders = instrumentIds.map((_, i) => `$${i + 1}`).join(',');
      cacheResult = await query(
        `SELECT instrument_id 
         FROM stock_ticker_cache 
         WHERE instrument_id IN (${cachePlaceholders})`,
        instrumentIds
      );
    }

    const cachedIds = new Set(cacheResult.rows.map((row: any) => row.instrument_id));
    const missingIds = instrumentIds.filter((id: number) => !cachedIds.has(id));

    console.log(`${cachedIds.size} already cached, ${missingIds.length} need to be fetched`);

    const fetched: number[] = [];
    const errors: string[] = [];

    // Use eToro Market Data API: GET /api/v1/market-data/instruments?instrumentIds=id1,id2,...
    // https://api-portal.etoro.com/api-reference/market-data/retrieves-metadata-for-specified-instruments-including-display-names-exchange-ids-and-classification
    const BATCH_SIZE = 50;
    const baseUrl = 'https://public-api.etoro.com/api/v1/market-data/instruments';

    for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
      const batch = missingIds.slice(i, i + BATCH_SIZE);
      const instrumentIdsParam = batch.join(',');
      const apiUrl = `${baseUrl}?instrumentIds=${instrumentIdsParam}`;

      try {
        const instrumentRequestId = randomUUID();
        const instrumentResponse = await axios.get(apiUrl, {
          headers: {
            'x-request-id': instrumentRequestId,
            'x-api-key': ETORO_PUBLIC_KEY,
            'x-user-key': ETORO_PRIVATE_KEY,
            'Content-Type': 'application/json'
          },
          timeout: 10000,
          validateStatus: () => true
        });

        if (instrumentResponse.status !== 200) {
          const errMsg = instrumentResponse.data?.errorMessage || instrumentResponse.data?.error || `HTTP ${instrumentResponse.status}`;
          batch.forEach(id => errors.push(`Instrument ${id}: ${errMsg}`));
          console.warn(`Market-data instruments batch returned ${instrumentResponse.status}:`, instrumentResponse.data);
          continue;
        }

        const items = instrumentResponse.data?.instrumentDisplayDatas;
        if (!Array.isArray(items)) {
          batch.forEach(id => errors.push(`Instrument ${id}: Invalid response (no instrumentDisplayDatas)`));
          continue;
        }

        for (const item of items) {
          const instrumentId = item.instrumentID ?? item.instrumentId;
          const symbolFull = item.symbolFull || item.symbol || null;
          const displayName = item.instrumentDisplayName || item.displayName || item.name || null;

          if (!instrumentId) continue;
          if (!symbolFull || symbolFull.startsWith('INSTRUMENT_')) {
            errors.push(`Instrument ${instrumentId}: No symbol in response`);
            continue;
          }

          try {
            await query(
              `INSERT INTO stock_ticker_cache (
                instrument_id, symbol_full, display_name, exchange, type, updated_at
              ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
              ON CONFLICT (instrument_id) 
              DO UPDATE SET
                symbol_full = EXCLUDED.symbol_full,
                display_name = EXCLUDED.display_name,
                exchange = EXCLUDED.exchange,
                type = EXCLUDED.type,
                updated_at = CURRENT_TIMESTAMP
              RETURNING instrument_id, symbol_full`,
              [instrumentId, symbolFull.toUpperCase(), displayName, null, null]
            );
            fetched.push(instrumentId);
            console.log(`✓ Fetched and cached instrument ${instrumentId} -> ${symbolFull}`);
          } catch (dbErr: any) {
            errors.push(`Instrument ${instrumentId}: DB error - ${dbErr.message}`);
          }
        }

        // Any IDs in this batch not returned by the API
        const returnedIds = new Set(items.map((it: any) => it.instrumentID ?? it.instrumentId));
        batch.filter(id => !returnedIds.has(id)).forEach(id => {
          errors.push(`Instrument ${id}: Not returned by API`);
        });
      } catch (err: any) {
        const msg = err.response?.data?.errorMessage || err.message || 'Unknown error';
        batch.forEach(id => errors.push(`Instrument ${id}: ${msg}`));
        console.error(`Error fetching batch:`, err.message);
      }
    }

    // --- Dividend per share: go through dividend table symbols and update portfolio_data.dividend_per_share (free FMP API) ---
    let dividendPerShareUpdated = 0;
    const dividendErrors: string[] = [];
    if (FMP_API_KEY && instrumentIds.length > 0) {
      const symbolResult = await query(
        `SELECT DISTINCT ON (pd.instrument_id) pd.instrument_id,
          COALESCE(NULLIF(TRIM(pd.ticker), ''), stc.symbol_full) AS symbol
         FROM portfolio_data pd
         LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id
         WHERE pd.instrument_id IS NOT NULL
         ORDER BY pd.instrument_id`
      );
      const rows = symbolResult.rows || [];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      for (const row of rows) {
        const instrumentId = row.instrument_id;
        const symbol = (row.symbol || '').toString().trim();
        if (!symbol || symbol.toUpperCase().startsWith('INSTRUMENT_')) continue;

        try {
          await sleep(350); // avoid FMP rate limit (free tier)
          const fmpUrl = `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${encodeURIComponent(symbol)}&apikey=${FMP_API_KEY}`;
          const divRes = await axios.get(fmpUrl, { timeout: 8000, validateStatus: () => true });

          let annualDps = 0;
          if (divRes.status === 200 && divRes.data) {
            let list: any[] = [];
            if (Array.isArray(divRes.data)) list = divRes.data;
            else if (divRes.data?.historical && Array.isArray(divRes.data.historical)) list = divRes.data.historical;
            else if (divRes.data?.dividends && Array.isArray(divRes.data.dividends)) list = divRes.data.dividends;

            const parseAmount = (d: any): number => {
              const v = d.dividend ?? d.adjustedDividend ?? d.adjDividend ?? d.amount ?? d.dividendAmount ?? 0;
              return parseFloat(String(v)) || 0;
            };
            const parseDate = (d: any): Date => {
              const raw = d.date ?? d.recordDate ?? d.paymentDate ?? d.declarationDate ?? d.exDividendDate ?? d.exDate;
              return new Date(raw);
            };

            const withDate = list
              .filter((d: any) => d && (d.date || d.recordDate || d.paymentDate || d.declarationDate || d.exDividendDate || d.exDate))
              .map((d: any) => ({
                date: parseDate(d),
                amount: parseAmount(d)
              }))
              .filter((d: any) => !isNaN(d.date.getTime()) && d.amount > 0)
              .sort((a: any, b: any) => b.date.getTime() - a.date.getTime()); // newest first

            // Sum dividends in last 12 months
            for (const d of withDate) {
              if (d.date >= oneYearAgo) annualDps += d.amount;
            }

            // Fallback: if we have dividends but none in last 12 months (e.g. date boundary or annual payer), use last 4 payments (quarterly) or last 2 years
            if (annualDps === 0 && withDate.length > 0) {
              const twoYearsAgo = new Date(oneYearAgo);
              twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 1);
              let twoYearSum = 0;
              for (const d of withDate) {
                if (d.date >= twoYearsAgo) twoYearSum += d.amount;
              }
              if (twoYearSum > 0) {
                annualDps = twoYearSum / 2; // approximate annual
              } else {
                // Use most recent 4 dividends (quarterly) or 2 (semi-annual) or 1 (annual)
                const recent = withDate.slice(0, 4);
                const sum = recent.reduce((s, d) => s + d.amount, 0);
                if (recent.length >= 4) annualDps = sum; // 4 quarters
                else if (recent.length >= 2) annualDps = sum * (4 / recent.length); // extrapolate to annual
                else if (recent.length === 1) annualDps = recent[0].amount * 4; // assume quarterly
              }
            }
          } else if (divRes.status === 429) {
            dividendErrors.push(`${symbol}: FMP rate limit (429)`);
            continue;
          } else if (divRes.status !== 404 && divRes.data?.['Error Message']) {
            dividendErrors.push(`${symbol}: ${divRes.data['Error Message']}`);
            continue;
          }

          if (annualDps > 0) {
            await query(
              `UPDATE portfolio_data SET dividend_per_share = $1 WHERE instrument_id = $2`,
              [Math.round(annualDps * 100) / 100, instrumentId]
            );
            try {
              await query(
                `UPDATE stock_ticker_cache SET dividend_per_share = $1, updated_at = CURRENT_TIMESTAMP WHERE instrument_id = $2`,
                [Math.round(annualDps * 100) / 100, instrumentId]
              );
            } catch (cacheErr: any) {
              if (!cacheErr.message?.includes('dividend_per_share')) throw cacheErr;
            }
            dividendPerShareUpdated += 1;
            console.log(`✓ Dividend per share ${symbol} (instrument ${instrumentId}): $${annualDps.toFixed(2)}`);
          }
        } catch (err: any) {
          dividendErrors.push(`${symbol}: ${err.message || 'Unknown error'}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      total: instrumentIds.length,
      cached: cachedIds.size,
      fetched: fetched.length,
      fetchedIds: fetched,
      dividendPerShareUpdated: FMP_API_KEY ? dividendPerShareUpdated : undefined,
      dividendErrors: dividendErrors.length > 0 ? dividendErrors : undefined,
      errors: errors.length > 0 ? errors : undefined,
      errorDetails: errors.length > 0 ? errors.slice(0, 10) : undefined, // Show first 10 errors in detail
      debug: {
        totalInstrumentIds: instrumentIds.length,
        missingIdsCount: missingIds.length,
        sampleMissingIds: missingIds.slice(0, 5)
      },
      message: fetched.length > 0 
        ? `Fetched ${fetched.length} new symbols. ${cachedIds.size} were already cached.` + (dividendPerShareUpdated > 0 ? ` Updated dividend per share for ${dividendPerShareUpdated} stocks.` : '')
        : errors.length > 0
          ? `Failed to fetch symbols. All ${errors.length} API calls returned errors. Check error details.`
          : `No new symbols to fetch. ${cachedIds.size} were already cached.` + (dividendPerShareUpdated > 0 ? ` Updated dividend per share for ${dividendPerShareUpdated} stocks.` : '')
    });

  } catch (error: any) {
    console.error('Error fetching stock symbols:', error);
    console.error('Error stack:', error.stack);
    return NextResponse.json(
      { 
        error: 'Failed to fetch stock symbols', 
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        type: error.constructor?.name
      },
      { status: 500 }
    );
  }
}
