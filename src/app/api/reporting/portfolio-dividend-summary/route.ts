import { NextResponse } from 'next/server';
import { query } from '../../../utils/db';

/** USD→GBP via Frankfurter (ECB). */
async function fetchUsdToGbpRate(): Promise<number | null> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=GBP', {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { rates?: { GBP?: number } };
    const r = j?.rates?.GBP;
    return typeof r === 'number' && r > 0 ? r : null;
  } catch {
    return null;
  }
}

/**
 * Projected dividend from portfolio_data (saved eToro portfolio).
 * Uses annual_dividend when set, else dividend_per_share * shares_owned.
 * Returns yearly/monthly in GBP and portfolio dividend yield %.
 */
export async function GET() {
  try {
    const sql = `
      SELECT
        SUM(
          CASE
            WHEN pd.annual_dividend IS NOT NULL AND pd.annual_dividend::numeric > 0
              THEN pd.annual_dividend::numeric
            ELSE (pd.shares_owned::numeric * COALESCE(pd.dividend_per_share::numeric, 0))
          END
        )::numeric AS total_annual_dividend_usd,
        SUM(
          CASE
            WHEN pd.current_value IS NOT NULL AND pd.current_value::numeric > 0
              THEN pd.current_value::numeric
            WHEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0)) > 0
              THEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0))
            ELSE COALESCE(pd.amount::numeric, 0)
          END
        )::numeric AS total_value_usd
      FROM portfolio_data pd
      WHERE (pd.is_settled IS NULL OR pd.is_settled = true)
        AND pd.shares_owned > 0
    `;

    const result = await query(sql, []);
    const row = result.rows?.[0] as
      | { total_annual_dividend_usd: string; total_value_usd: string }
      | undefined;

    const yearlyUsd = parseFloat(row?.total_annual_dividend_usd ?? '0') || 0;
    const totalValueUsd = parseFloat(row?.total_value_usd ?? '0') || 0;
    const yieldPct = totalValueUsd > 0 ? (yearlyUsd / totalValueUsd) * 100 : 0;

    const rate = await fetchUsdToGbpRate();
    const yearlyGbp = rate != null ? Math.round(yearlyUsd * rate * 100) / 100 : yearlyUsd;
    const monthlyGbp = Math.round((yearlyGbp / 12) * 100) / 100;

    return NextResponse.json({
      yearlyGbp,
      monthlyGbp,
      yieldPct: Math.round(yieldPct * 100) / 100,
      source: 'portfolio',
      currency: rate != null ? 'GBP' : 'USD',
    });
  } catch (error: unknown) {
    console.error('portfolio-dividend-summary:', error);
    return NextResponse.json(
      {
        error: 'Failed to load portfolio dividend summary',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
