import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { randomUUID } from 'crypto';
import { query } from '../../../utils/db';
import { fmpSymbol, computeAnnualDpsFromFmpResponse } from '../../../utils/fmpDividend';

const ETORO_PUBLIC_KEY = process.env.ETORO_PUBLIC_KEY;
const ETORO_PRIVATE_KEY = process.env.ETORO_PRIVATE_KEY;
const ETORO_ACCOUNT_TYPE = process.env.ETORO_ACCOUNT_TYPE || 'real'; // 'real' or 'demo'
const FMP_API_KEY = process.env.FMP_API_KEY;

interface DividendStock {
  positionId?: number;
  instrumentId?: number;
  ticker: string;
  sharesOwned: number;
  buyCost: number;
  currentPrice: number;
  dividendPerShare: number;
  dividendGrowthRate: number | null;
}

interface EToroPosition {
  positionID?: number;
  positionId?: number;
  instrumentID?: number;
  instrumentId?: number;
  units: number;
  openRate: number;
  amount: number;
  initialAmountInDollars: number;
  isBuy: boolean;
  settlementTypeID?: number;
  settlementTypeId?: number; // 1 = Real Asset (stocks)
  pnL?: number;
  closeRate?: number;
  closeConversionRate?: number;
  timestamp?: string;
  isSettled?: boolean;
  isDetached?: boolean;
  unrealizedPnL?: {
    pnL?: number;
    closeRate?: number;
    closeConversionRate?: number;
    timestamp?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check if eToro keys are configured
    if (!ETORO_PUBLIC_KEY || !ETORO_PRIVATE_KEY) {
      return NextResponse.json(
        { 
          error: 'eToro API keys are not configured. Please set ETORO_PUBLIC_KEY and ETORO_PRIVATE_KEY in your environment variables.',
          stocks: []
        },
        { status: 500 }
      );
    }

    // Generate UUID for x-request-id header
    const requestId = randomUUID();

    // Call eToro API to get portfolio information with PnL details
    // This endpoint provides more detailed position data including current prices
    // Support both 'real' and 'demo' account types
    const accountType = ETORO_ACCOUNT_TYPE.toLowerCase() === 'demo' ? 'demo' : 'real';
    const portfolioResponse = await axios.get(
      `https://public-api.etoro.com/api/v1/trading/info/${accountType}/pnl`,
      {
        headers: {
          'x-request-id': requestId,
          'x-api-key': ETORO_PUBLIC_KEY,
          'x-user-key': ETORO_PRIVATE_KEY,
          'Content-Type': 'application/json'
        },
        timeout: 15000,
        validateStatus: () => true // Don't throw on non-2xx status
      }
    );

    if (portfolioResponse.status !== 200) {
      console.error('eToro API error:', portfolioResponse.status);
      console.error('Response data:', JSON.stringify(portfolioResponse.data, null, 2));
      console.error('Response headers:', portfolioResponse.headers);
      
      const errorMessage = portfolioResponse.data?.message || 
                           portfolioResponse.data?.error || 
                           portfolioResponse.data?.errorMessage ||
                           'Unknown error';
      
      return NextResponse.json(
        { 
          error: `eToro API returned status ${portfolioResponse.status}`,
          details: errorMessage,
          responseData: portfolioResponse.data,
          stocks: []
        },
        { status: portfolioResponse.status }
      );
    }

    console.log('eToro API response received, status:', portfolioResponse.status);
    console.log('Response structure:', Object.keys(portfolioResponse.data || {}));
    
    // Log the full response for debugging (truncated for large responses)
    const responseStr = JSON.stringify(portfolioResponse.data, null, 2);
    console.log('Full API response (first 3000 chars):', responseStr.substring(0, 3000));
    if (responseStr.length > 3000) {
      console.log('... (response truncated, total length:', responseStr.length, 'chars)');
    }
    
    const portfolio = portfolioResponse.data?.clientPortfolio;
    if (!portfolio) {
      console.error('No clientPortfolio in response:', portfolioResponse.data);
      return NextResponse.json(
        { 
          error: 'Invalid response format from eToro API - missing clientPortfolio',
          responseData: portfolioResponse.data,
          stocks: []
        },
        { status: 500 }
      );
    }
    
    console.log('Portfolio keys:', Object.keys(portfolio));
    console.log('Portfolio structure:', {
      hasPositions: !!portfolio.positions,
      positionsType: Array.isArray(portfolio.positions) ? 'array' : typeof portfolio.positions,
      positionsLength: Array.isArray(portfolio.positions) ? portfolio.positions.length : 'N/A',
      hasMirrors: !!portfolio.mirrors,
      mirrorsType: Array.isArray(portfolio.mirrors) ? 'array' : typeof portfolio.mirrors,
      mirrorsLength: Array.isArray(portfolio.mirrors) ? portfolio.mirrors.length : 'N/A',
      credit: portfolio.credit,
      unrealizedPnL: portfolio.unrealizedPnL
    });
    
    // Check if positions exist (could be empty array or undefined)
    if (!portfolio.positions) {
      console.warn('portfolio.positions is undefined or null');
    } else if (!Array.isArray(portfolio.positions)) {
      console.error('portfolio.positions is not an array:', typeof portfolio.positions, portfolio.positions);
      return NextResponse.json(
        { 
          error: 'Invalid response format from eToro API - positions is not an array',
          portfolioKeys: Object.keys(portfolio),
          positionsType: typeof portfolio.positions,
          stocks: []
        },
        { status: 500 }
      );
    }
    
    console.log(`Found ${portfolio.positions?.length || 0} direct positions`);
    
    // Log first position if it exists - check for any symbol/name fields
    if (portfolio.positions && portfolio.positions.length > 0) {
      const samplePos = portfolio.positions[0];
      console.log('Sample position keys:', Object.keys(samplePos));
      console.log('Sample position (full):', JSON.stringify(samplePos, null, 2));
      
      // Check if position has any symbol-related fields
      const symbolFields = ['symbol', 'name', 'displayName', 'instrumentName', 'instrumentSymbol', 'instrumentDisplayName'];
      symbolFields.forEach(field => {
        if (samplePos[field]) {
          console.log(`Found symbol field "${field}":`, samplePos[field]);
        }
      });
    }
    
    // Collect all positions: direct positions + positions from mirrors
    const allPositions: EToroPosition[] = [];
    
    // Add direct positions
    if (portfolio.positions && Array.isArray(portfolio.positions)) {
      allPositions.push(...portfolio.positions);
    }
    
    // Add positions from mirrors
    if (portfolio.mirrors && Array.isArray(portfolio.mirrors)) {
      console.log(`Found ${portfolio.mirrors.length} mirrors`);
      portfolio.mirrors.forEach((mirror: any) => {
        if (mirror.positions && Array.isArray(mirror.positions)) {
          console.log(`Mirror ${mirror.mirrorId || mirror.mirrorID} has ${mirror.positions.length} positions`);
          allPositions.push(...mirror.positions);
        }
      });
    }
    
    console.log(`Total positions collected: ${allPositions.length}`);

    // Filter for active real asset positions (stocks) - settlementTypeId = 1
    // Only include positions that are:
    // 1. Real assets (stocks) - settlementTypeId = 1
    // 2. Buy positions (not short)
    // 3. Active/open positions - units > 0
    // Note: isSettled in eToro API means the trade has been executed/settled, not that position is closed
    // All active positions will have isSettled=true, so we don't filter on it
    const stockPositions = allPositions.filter(
      (pos: EToroPosition) => {
        const settlementType = pos.settlementTypeID ?? pos.settlementTypeId;
        const isStock = settlementType === 1;
        const isBuyPosition = pos.isBuy === true;
        const hasUnits = (pos.units || 0) > 0;
        
        // Only filter on: is stock, is buy, has units
        const shouldInclude = isStock && isBuyPosition && hasUnits;
        
        if (!shouldInclude) {
          console.log(`Skipping position ${pos.positionID ?? pos.positionId}: settlementType=${settlementType}, isBuy=${isBuyPosition}, units=${pos.units}`);
        }
        
        return shouldInclude;
      }
    );

    console.log(`Found ${stockPositions.length} stock positions after filtering`);

    if (stockPositions.length === 0) {
      // Create detailed debug info
      const debugInfo: any = {
        totalPositions: allPositions.length,
        positionsBySettlementType: allPositions.reduce((acc: any, pos: EToroPosition) => {
          const st = pos.settlementTypeID ?? pos.settlementTypeId;
          const key = st !== undefined ? String(st) : 'undefined';
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
        positionsByIsBuy: allPositions.reduce((acc: any, pos: EToroPosition) => {
          const key = String(pos.isBuy);
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {}),
        samplePosition: allPositions[0] || null,
        portfolioStructure: {
          hasDirectPositions: !!portfolio.positions,
          directPositionsCount: portfolio.positions?.length || 0,
          hasMirrors: !!portfolio.mirrors,
          mirrorsCount: portfolio.mirrors?.length || 0
        }
      };
      
      console.log('Debug info:', JSON.stringify(debugInfo, null, 2));
      
      return NextResponse.json({
        stocks: [],
        message: 'No stock positions found in portfolio',
        debug: debugInfo,
        rawResponse: {
          portfolioKeys: Object.keys(portfolio),
          hasPositions: !!portfolio.positions,
          positionsLength: portfolio.positions?.length || 0,
          hasMirrors: !!portfolio.mirrors,
          mirrorsLength: portfolio.mirrors?.length || 0
        }
      });
    }

    // Get unique instrument IDs from stock positions
    // NOTE: eToro API returns only numeric instrumentID (e.g., 6681), NOT "INSTRUMENT_6681"
    // We create "INSTRUMENT_XXX" as a fallback when we can't find a mapping
    const uniqueInstrumentIds = [...new Set(stockPositions.map(p => p.instrumentID ?? p.instrumentId).filter(id => id))];
    console.log(`Need to fetch symbols for ${uniqueInstrumentIds.length} unique instruments:`, uniqueInstrumentIds);
    
    const instrumentMap: Record<number | string, string> = {};
    const instrumentErrors: string[] = [];
    
    // Lookup order for instrument ID -> ticker symbol:
    // 1. etoro_instruments table (dedicated mapping table)
    // 2. portfolio_data table (previously saved data with ticker symbols)
    // 3. Fallback hardcoded mappings (common stocks)
    // 4. eToro API GET /instruments/{instrumentId} (query each missing ID)
    // 5. "INSTRUMENT_XXX" as last resort (should rarely happen if API works)
    try {
      if (uniqueInstrumentIds.length > 0) {
        const placeholders = uniqueInstrumentIds.map((_, i) => `$${i + 1}`).join(',');
        
        // 1. Check etoro_instruments table (dedicated mapping table)
        const instrumentsResult = await query(
          `SELECT instrument_id, symbol 
           FROM etoro_instruments 
           WHERE instrument_id IN (${placeholders})`,
          uniqueInstrumentIds
        );
        
        instrumentsResult.rows.forEach((row: any) => {
          if (row.symbol && !row.symbol.startsWith('INSTRUMENT_')) {
            instrumentMap[row.instrument_id] = row.symbol;
          }
        });
        
        console.log(`Found ${instrumentsResult.rows.length} instrument mappings in etoro_instruments table`);
        
        // 2. Also check portfolio_data table for any previously saved ticker symbols
        // This helps if we saved data before but didn't have the mapping table
        const missingFromInstruments = uniqueInstrumentIds.filter(id => id !== undefined && id !== null && !instrumentMap[id]);
        if (missingFromInstruments.length > 0) {
          const portfolioPlaceholders = missingFromInstruments.map((_, i) => `$${i + 1}`).join(',');
          const portfolioResult = await query(
            `SELECT DISTINCT instrument_id, ticker 
             FROM portfolio_data 
             WHERE instrument_id IN (${portfolioPlaceholders})
               AND ticker IS NOT NULL 
               AND ticker != ''
               AND NOT ticker LIKE 'INSTRUMENT_%'`,
            missingFromInstruments
          );
          
          portfolioResult.rows.forEach((row: any) => {
            if (row.ticker && !row.ticker.startsWith('INSTRUMENT_')) {
              instrumentMap[row.instrument_id] = row.ticker;
              console.log(`✓ Found ticker ${row.ticker} for instrument ${row.instrument_id} from portfolio_data`);
            }
          });
          
          console.log(`Found ${portfolioResult.rows.length} additional ticker mappings from portfolio_data table`);
        }
        
        console.log(`Total database mappings found: ${Object.keys(instrumentMap).length}`);
      }
    } catch (dbErr: any) {
      console.warn('Error fetching from database (table may not exist yet):', dbErr.message);
      // Continue - table might not exist yet, we'll try fallback mappings
    }
    
    // Fallback: Common eToro instrument ID mappings (manually maintained)
    // These are common stocks - you can add more via POST /api/etoro/instruments
    // Note: eToro instrument IDs can vary, so these are common mappings
    // If a stock shows as INSTRUMENT_XXX, you need to identify it and add the mapping
    const fallbackMappings: { [key: number]: string } = {
      1001: 'AAPL',   1041: 'AAPL',  1042: 'AAPL',  // Apple (multiple IDs possible)
      1002: 'MSFT',   // Microsoft
      1003: 'GOOGL',  // Google
      1004: 'AMZN',   // Amazon
      1005: 'TSLA',   // Tesla
      1006: 'META',   // Meta
      1007: 'NVDA',   // NVIDIA
      1008: 'JPM',    // JPMorgan
      1009: 'V',      // Visa
      1010: 'JNJ',    // Johnson & Johnson
      1011: 'WMT',    // Walmart
      1012: 'PG',     // Procter & Gamble
      1013: 'MA',     // Mastercard
      1014: 'UNH',    // UnitedHealth
      1015: 'HD',     // Home Depot
      1016: 'DIS',    // Disney
      1017: 'BAC',    // Bank of America
      1018: 'VZ',     // Verizon
      1019: 'ADBE',   // Adobe
      1020: 'NFLX',   // Netflix
      1021: 'NKE',    // Nike
      1022: 'KO',     // Coca-Cola
      1023: 'PEP',    // PepsiCo
      1024: 'T',      // AT&T
      1025: 'XOM',    // Exxon Mobil
      1026: 'CVX',    // Chevron
      1027: 'ABBV',   // AbbVie
      1028: 'MRK',    // Merck
      1029: 'ABT',    // Abbott
      1030: 'TMO',    // Thermo Fisher
      1137: 'UNKNOWN', // Need to identify - check price/buy cost
      1484: 'UNKNOWN', // Need to identify - check price/buy cost
      // Add more mappings as you identify them
      // To add: POST /api/etoro/instruments with { "instrumentId": XXX, "symbol": "SYMBOL" }
    };
    
    // Apply fallback mappings for missing instruments
    // Handle both string and number IDs
    console.log('Applying fallback mappings. Current map size:', Object.keys(instrumentMap).length);
    uniqueInstrumentIds.forEach(id => {
      if (id === undefined || id === null) {
        console.warn(`Invalid instrument ID: ${id}`);
        return;
      }
      
      const idNum = typeof id === 'string' ? parseInt(id) : id;
      if (!idNum || isNaN(idNum)) {
        console.warn(`Invalid instrument ID: ${id}`);
        return;
      }
      
      // Check if already mapped
      if ((id !== undefined && instrumentMap[id]) || instrumentMap[idNum]) {
        return; // Already mapped
      }
      
      // Check fallback
      if (fallbackMappings[idNum]) {
        const symbol = fallbackMappings[idNum];
        instrumentMap[id] = symbol;
        instrumentMap[idNum] = symbol; // Store both string and number keys
        console.log(`✓ Applied fallback mapping: instrument ${id} (${idNum}) -> ${symbol}`);
        
        // Try to save to database for future use (async, don't wait)
        query(
          `INSERT INTO etoro_instruments (instrument_id, symbol, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)
           ON CONFLICT (instrument_id) DO NOTHING`,
          [idNum, symbol]
        ).catch(() => {
          // Ignore errors - table might not exist or connection issue
        });
      } else {
        console.warn(`⚠ No fallback mapping for instrument ID: ${id} (${idNum})`);
      }
    });
    console.log('After fallback, map size:', Object.keys(instrumentMap).length);
    console.log('Map contents:', Object.entries(instrumentMap).slice(0, 10));
    
    // Get missing instrument IDs (ones not found in database or fallback)
    const missingIds = uniqueInstrumentIds.filter(id => id !== undefined && id !== null && !instrumentMap[id]);
    
    // Fetch missing instruments via eToro Market Data API (batch)
    // GET /api/v1/market-data/instruments?instrumentIds=id1,id2,...
    // https://api-portal.etoro.com/api-reference/market-data/retrieves-metadata-for-specified-instruments-including-display-names-exchange-ids-and-classification
    if (missingIds.length > 0) {
      console.log(`Fetching ${missingIds.length} missing instruments from eToro market-data API...`);
      const BATCH_SIZE = 50;
      const baseUrl = 'https://public-api.etoro.com/api/v1/market-data/instruments';

      for (let i = 0; i < missingIds.length; i += BATCH_SIZE) {
        const batch = missingIds.slice(i, i + BATCH_SIZE).filter(id => id != null);
        const idNums = batch.map(id => typeof id === 'string' ? parseInt(id) : id).filter(n => !isNaN(n));
        if (idNums.length === 0) continue;

        const instrumentIdsParam = idNums.join(',');
        const apiUrl = `${baseUrl}?instrumentIds=${instrumentIdsParam}`;

        try {
          const instrumentResponse = await axios.get(apiUrl, {
            headers: {
              'x-request-id': randomUUID(),
              'x-api-key': ETORO_PUBLIC_KEY,
              'x-user-key': ETORO_PRIVATE_KEY,
              'Content-Type': 'application/json'
            },
            timeout: 10000,
            validateStatus: () => true
          });

          if (instrumentResponse.status !== 200) {
            console.warn(`Market-data instruments batch returned ${instrumentResponse.status}`);
            idNums.forEach(id => instrumentErrors.push(`Instrument ${id}: API returned ${instrumentResponse.status}`));
            continue;
          }

          const items = instrumentResponse.data?.instrumentDisplayDatas;
          if (!Array.isArray(items)) {
            idNums.forEach(id => instrumentErrors.push(`Instrument ${id}: Invalid response`));
            continue;
          }

          for (const item of items) {
            const idNum = item.instrumentID ?? item.instrumentId;
            const symbol = item.symbolFull || item.symbol || null;
            const displayName = item.instrumentDisplayName || item.displayName || item.name || null;

            if (!idNum) continue;
            if (symbol && !symbol.startsWith('INSTRUMENT_')) {
              instrumentMap[idNum] = symbol;
              instrumentMap[String(idNum)] = symbol;
              console.log(`✓ Fetched from eToro API: instrument ${idNum} -> ${symbol}`);
              try {
                await query(
                  `INSERT INTO etoro_instruments (instrument_id, symbol, name, updated_at)
                   VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
                   ON CONFLICT (instrument_id) 
                   DO UPDATE SET symbol = EXCLUDED.symbol, name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP`,
                  [idNum, symbol.toUpperCase(), displayName]
                );
              } catch (saveErr: any) {
                console.warn(`Failed to save instrument ${idNum} to database:`, saveErr.message);
              }
            } else {
              instrumentErrors.push(`Instrument ${idNum}: Invalid symbol from API - ${symbol}`);
            }
          }
        } catch (err: any) {
          console.warn(`Error fetching instruments batch:`, err.message);
          idNums.forEach(id => instrumentErrors.push(`Instrument ${id}: ${err.message}`));
        }
      }
    }
    
    // Log final mapping status
    const stillMissing = uniqueInstrumentIds.filter(id => id !== undefined && id !== null && !instrumentMap[id]);
    if (stillMissing.length > 0) {
      console.warn(`⚠ ${stillMissing.length} instruments still missing symbols: ${stillMissing.join(', ')}`);
      console.warn('These need to be manually mapped. You can use POST /api/etoro/instruments to add them.');
    }
    
    console.log(`Successfully mapped ${Object.keys(instrumentMap).length} out of ${uniqueInstrumentIds.length} instruments`);
    if (instrumentErrors.length > 0) {
      console.warn('Instrument fetch errors:', instrumentErrors);
    }

    // Dividend per share: prefer stock_ticker_cache (canonical source)
    const dpsFromCache: Record<number, number> = {};
    try {
      const hasDpsCol = await query(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'dividend_per_share'`
      );
      if (hasDpsCol.rows?.length > 0) {
        const idList = uniqueInstrumentIds
          .filter((id): id is number => id != null && !isNaN(typeof id === 'string' ? parseInt(id) : id))
          .map(id => typeof id === 'string' ? parseInt(id) : id);
        if (idList.length > 0) {
          const placeholders = idList.map((_, i) => `$${i + 1}`).join(',');
          const stcResult = await query(
            `SELECT instrument_id, dividend_per_share FROM stock_ticker_cache WHERE instrument_id IN (${placeholders})`,
            idList
          );
          stcResult.rows.forEach((row: any) => {
            const dps = parseFloat(row.dividend_per_share);
            const instId = Number(row.instrument_id);
            if (Number.isFinite(dps) && dps > 0 && !isNaN(instId)) {
              dpsFromCache[instId] = dps;
            }
          });
          console.log(`Loaded dividend_per_share from stock_ticker_cache for ${Object.keys(dpsFromCache).length} instruments`);
        }
      } else {
        console.warn('stock_ticker_cache.dividend_per_share column missing — run migration 004 to enable');
      }
    } catch (stcErr: any) {
      console.warn('Could not load dividend_per_share from stock_ticker_cache:', stcErr.message);
    }

    // Fallback: fill from portfolio_data where cache had no value
    try {
      const idList = uniqueInstrumentIds
        .filter((id): id is number => id != null && !isNaN(typeof id === 'string' ? parseInt(id) : id))
        .map(id => typeof id === 'string' ? parseInt(id) : id);
      if (idList.length > 0) {
        const placeholders = idList.map((_, i) => `$${i + 1}`).join(',');
        const pdResult = await query(
          `SELECT instrument_id, dividend_per_share FROM portfolio_data WHERE instrument_id IN (${placeholders}) AND dividend_per_share IS NOT NULL AND dividend_per_share > 0`,
          idList
        );
        pdResult.rows.forEach((row: any) => {
          const instId = Number(row.instrument_id);
          const dps = parseFloat(row.dividend_per_share);
          if (!isNaN(instId) && Number.isFinite(dps) && dps > 0 && (dpsFromCache[instId] == null || dpsFromCache[instId] === 0)) {
            dpsFromCache[instId] = dps;
          }
        });
      }
    } catch (_) {
      // ignore
    }
    
    // Build stocks: use dividend_per_share from cache (stc + pd); only call FMP when still no value
    const stocks: DividendStock[] = [];
    const debug: any = {
      stocksWithoutSymbols: []
    };
    
    for (const position of stockPositions) {
      try {
        // Get instrument ID (handle both naming conventions)
        const instrumentId = position.instrumentID ?? position.instrumentId ?? 0;
        const positionId = position.positionID ?? position.positionId ?? 0;
        
        // Get current price from PnL endpoint data
        const currentPrice = position.closeRate ?? 
                             position.unrealizedPnL?.closeRate ?? 
                             position.openRate ?? 
                             0;
        
        const buyCost = position.openRate || 0;
        const sharesOwned = position.units || 0;

        // Get ticker symbol from instrument map (try both string and number keys)
        const idNum = typeof instrumentId === 'string' ? parseInt(instrumentId) : instrumentId;
        const ticker = instrumentMap[instrumentId] || 
                     instrumentMap[idNum] || 
                     `INSTRUMENT_${instrumentId}`;
        // Dividend per share: from stock_ticker_cache first (idNum is number for lookup)
        let dividendPerShare = (Number.isFinite(idNum) ? dpsFromCache[idNum] : undefined) ?? 0;
        const dividendGrowthRate: number | null = null;
        
        if (ticker.startsWith('INSTRUMENT_')) {
          console.warn(`⚠ Instrument ${instrumentId} (${idNum}) missing symbol.`);
          console.warn(`   Position ID: ${positionId}, Units: ${sharesOwned}, Current: $${currentPrice}, Buy: $${buyCost}`);
          console.warn(`   To identify: Check eToro website or use price matching`);
          console.warn(`   To fix: POST /api/etoro/instruments with { "instrumentId": ${idNum}, "symbol": "SYMBOL" }`);
          
          debug.stocksWithoutSymbols.push({
            instrumentId: idNum,
            positionId: positionId,
            units: sharesOwned,
            currentPrice: currentPrice,
            buyCost: buyCost,
            suggestion: `Check eToro for instrument ${idNum} - Price: $${currentPrice}, Buy: $${buyCost}`
          });
        } else {
          console.log(`✓ Using symbol ${ticker} for instrument ${instrumentId} (${idNum})`);
        }

        // Only call FMP when cache has no dividend per share; use same URLs/parsing as dividend-per-share API
        if (dividendPerShare === 0 && FMP_API_KEY && ticker && !ticker.startsWith('INSTRUMENT_')) {
          try {
            const forFmp = fmpSymbol(ticker);
            const urls = [
              `https://financialmodelingprep.com/stable/dividends?symbol=${forFmp}&apikey=${FMP_API_KEY}`,
              `https://financialmodelingprep.com/stable/historical-price-full/stock_dividend?symbol=${forFmp}&apikey=${FMP_API_KEY}`,
              `https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${forFmp}?apikey=${FMP_API_KEY}`
            ];
            for (const url of urls) {
              const res = await axios.get(url, { timeout: 8000, validateStatus: () => true });
              if (res.status === 200 && res.data && !res.data['Error Message']) {
                const dps = computeAnnualDpsFromFmpResponse(res.data);
                if (dps > 0) {
                  dividendPerShare = dps;
                  break;
                }
              }
            }
          } catch (fmpErr: any) {
            console.warn(`Failed to fetch dividend data for ${ticker}:`, fmpErr.message);
          }
        }
        
        stocks.push({
          positionId: positionId || undefined,
          instrumentId: idNum || undefined,
          ticker,
          sharesOwned,
          buyCost,
          currentPrice,
          dividendPerShare,
          dividendGrowthRate
        });
      } catch (err: any) {
        const positionId = position.positionID ?? position.positionId ?? 'unknown';
        console.error(`Error processing position ${positionId}:`, err);
        // Continue with other positions
      }
    }

    // Return debug info in response for client-side inspection
    const missingInstrumentIds = uniqueInstrumentIds.filter(id => id !== undefined && id !== null && !instrumentMap[id]);
    const debugInfo = {
      totalPositions: allPositions.length,
      stockPositionsCount: stockPositions.length,
      activePositionsFiltered: stockPositions.length,
      uniqueInstrumentIds: uniqueInstrumentIds,
      instrumentMapSize: Object.keys(instrumentMap).length,
      instrumentMap: instrumentMap,
      missingInstrumentIds: missingInstrumentIds,
      instrumentErrors: instrumentErrors,
      samplePosition: stockPositions[0] || null,
      samplePositionKeys: stockPositions[0] ? Object.keys(stockPositions[0]) : null,
      stocksWithSymbols: stocks.filter(s => !s.ticker.startsWith('INSTRUMENT_')).length,
      stocksWithoutSymbols: stocks.filter(s => s.ticker.startsWith('INSTRUMENT_')).length,
      stocksWithoutSymbolsList: stocks.filter(s => s.ticker.startsWith('INSTRUMENT_')).map(s => {
        const id = s.ticker.replace('INSTRUMENT_', '');
        const stock = stocks.find(st => st.ticker === s.ticker);
        return { 
          instrumentId: id, 
          ticker: s.ticker, 
          currentPrice: stock?.currentPrice,
          buyCost: stock?.buyCost,
          sharesOwned: stock?.sharesOwned
        };
      }),
      stocksWithoutSymbolsDetails: debug.stocksWithoutSymbols,
      instructions: missingInstrumentIds.length > 0 
        ? `To fix missing symbols, use: POST /api/etoro/instruments with body: { "instrumentId": ${missingInstrumentIds[0]}, "symbol": "SYMBOL" }`
        : null
    };
    
    return NextResponse.json({ 
      stocks,
      message: stocks.length > 0 
        ? `Found ${stocks.length} stock positions. ${stocks.filter(s => !s.ticker.startsWith('INSTRUMENT_')).length} have symbols, ${stocks.filter(s => s.ticker.startsWith('INSTRUMENT_')).length} missing symbols.`
        : 'No stock positions found',
      debug: debugInfo
    });

  } catch (error: any) {
    console.error('Error fetching eToro dividend data:', error);
    
    // Provide more detailed error information
    let errorMessage = 'Failed to fetch dividend data from eToro';
    let errorDetails = error.message;

    if (error.response) {
      errorMessage = `eToro API error: ${error.response.status}`;
      errorDetails = error.response.data?.message || error.response.data?.error || error.message;
    } else if (error.request) {
      errorMessage = 'No response from eToro API';
      errorDetails = 'The request was made but no response was received';
    }

    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        stocks: []
      },
      { status: 500 }
    );
  }
}
