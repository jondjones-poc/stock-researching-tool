import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../../utils/db';

interface PortfolioStock {
  positionId: number;
  instrumentId: number;
  ticker: string;
  sharesOwned: number;
  buyCost: number;
  currentPrice: number;
  currentValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  dividendPerShare: number;
  annualDividend?: number;
  dividendYield?: number;
  dividendGrowthRate?: number | null;
  pnl?: number;
  openDateTime?: string;
  settlementTypeId?: number;
  isBuy?: boolean;
  leverage?: number;
  amount?: number;
  initialAmountInDollars?: number;
  isSettled?: boolean;
  isDetached?: boolean;
}

// POST - Save portfolio data to database
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stocks } = body;

    if (!stocks || !Array.isArray(stocks)) {
      return NextResponse.json(
        { error: 'stocks array is required' },
        { status: 400 }
      );
    }

    if (stocks.length === 0) {
      return NextResponse.json(
        { error: 'No stocks to save' },
        { status: 400 }
      );
    }

    const savedPositions: number[] = [];
    const errors: string[] = [];

    // Save each stock position
    for (const stock of stocks) {
      try {
        // Calculate derived values if not provided
        const currentValue = stock.currentValue ?? (stock.currentPrice * stock.sharesOwned);
        const totalCost = stock.buyCost * stock.sharesOwned;
        const gainLoss = stock.gainLoss ?? (currentValue - totalCost);
        const gainLossPercent = stock.gainLossPercent ?? (totalCost > 0 ? ((gainLoss / totalCost) * 100) : 0);
        const annualDividend = stock.annualDividend ?? (stock.dividendPerShare * stock.sharesOwned);
        const dividendYield = stock.dividendYield ?? (stock.currentPrice > 0 ? ((stock.dividendPerShare / stock.currentPrice) * 100) : 0);

        // Get position ID - use instrumentId as fallback if positionId not provided
        const positionId = stock.positionId ?? stock.instrumentId ?? null;
        
        if (!positionId) {
          errors.push(`Missing positionId for ticker ${stock.ticker}`);
          continue;
        }

        const result = await query(
          `INSERT INTO portfolio_data (
            position_id, instrument_id, ticker, shares_owned, buy_cost, current_price,
            current_value, gain_loss, gain_loss_percent,
            dividend_per_share, annual_dividend, dividend_yield, dividend_growth_rate,
            pnl, open_date_time, settlement_type_id, is_buy, leverage, amount,
            initial_amount_in_dollars, is_settled, is_detached, last_updated
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, CURRENT_TIMESTAMP
          )
          ON CONFLICT (position_id) 
          DO UPDATE SET
            instrument_id = EXCLUDED.instrument_id,
            ticker = EXCLUDED.ticker,
            shares_owned = EXCLUDED.shares_owned,
            buy_cost = EXCLUDED.buy_cost,
            current_price = EXCLUDED.current_price,
            current_value = EXCLUDED.current_value,
            gain_loss = EXCLUDED.gain_loss,
            gain_loss_percent = EXCLUDED.gain_loss_percent,
            dividend_per_share = EXCLUDED.dividend_per_share,
            annual_dividend = EXCLUDED.annual_dividend,
            dividend_yield = EXCLUDED.dividend_yield,
            dividend_growth_rate = EXCLUDED.dividend_growth_rate,
            pnl = EXCLUDED.pnl,
            open_date_time = EXCLUDED.open_date_time,
            settlement_type_id = EXCLUDED.settlement_type_id,
            is_buy = EXCLUDED.is_buy,
            leverage = EXCLUDED.leverage,
            amount = EXCLUDED.amount,
            initial_amount_in_dollars = EXCLUDED.initial_amount_in_dollars,
            is_settled = EXCLUDED.is_settled,
            is_detached = EXCLUDED.is_detached,
            last_updated = CURRENT_TIMESTAMP
          RETURNING position_id, ticker`,
          [
            positionId,
            stock.instrumentId ?? null,
            stock.ticker || null,
            stock.sharesOwned || 0,
            stock.buyCost || 0,
            stock.currentPrice || 0,
            currentValue,
            gainLoss,
            gainLossPercent,
            stock.dividendPerShare || 0,
            annualDividend,
            dividendYield,
            stock.dividendGrowthRate ?? null,
            stock.pnl ?? null,
            stock.openDateTime ? new Date(stock.openDateTime).toISOString() : null,
            stock.settlementTypeId ?? null,
            stock.isBuy ?? null,
            stock.leverage ?? null,
            stock.amount ?? null,
            stock.initialAmountInDollars ?? null,
            stock.isSettled ?? null,
            stock.isDetached ?? null
          ]
        );

        savedPositions.push(positionId);
      } catch (err: any) {
        console.error(`Error saving position ${stock.ticker}:`, err);
        errors.push(`${stock.ticker}: ${err.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      saved: savedPositions.length,
      total: stocks.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Saved ${savedPositions.length} of ${stocks.length} positions`
    });

  } catch (error: any) {
    console.error('Error saving portfolio data:', error);
    return NextResponse.json(
      { error: 'Failed to save portfolio data', details: error.message },
      { status: 500 }
    );
  }
}
