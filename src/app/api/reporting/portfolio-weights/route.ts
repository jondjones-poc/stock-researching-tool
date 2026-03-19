import { NextResponse } from 'next/server';
import { query } from '../../../utils/db';

/** eToro portfolio amounts in DB are USD; convert for GBP display via Frankfurter (ECB). */
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
 * Aggregate portfolio_data by ticker and return weight % of total.
 * Includes rows where is_settled is true OR NULL (saved portfolio often leaves is_settled null).
 * Excludes only explicit is_settled = false (pending settlement).
 */
export async function GET() {
  try {
    const sql = `
      SELECT
        UPPER(COALESCE(NULLIF(TRIM(pd.ticker), ''), stc.symbol_full, 'UNKNOWN')) AS symbol,
        SUM(
          CASE
            WHEN pd.current_value IS NOT NULL AND pd.current_value::numeric > 0
              THEN pd.current_value::numeric
            WHEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0)) > 0
              THEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0))
            ELSE COALESCE(pd.amount::numeric, 0)
          END
        )::numeric AS total_value
      FROM portfolio_data pd
      LEFT JOIN stock_ticker_cache stc ON stc.instrument_id = pd.instrument_id
      WHERE (pd.is_settled IS NULL OR pd.is_settled = true)
        AND pd.shares_owned > 0
      GROUP BY 1
      HAVING SUM(
        CASE
          WHEN pd.current_value IS NOT NULL AND pd.current_value::numeric > 0
            THEN pd.current_value::numeric
          WHEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0)) > 0
            THEN (pd.shares_owned::numeric * COALESCE(pd.current_price::numeric, 0))
          ELSE COALESCE(pd.amount::numeric, 0)
        END
      ) > 0
      ORDER BY total_value DESC
    `;

    const result = await query(sql, []);
    const rows = result.rows as { symbol: string; total_value: string }[];

    const total = rows.reduce((s, r) => s + parseFloat(r.total_value) || 0, 0);

    const dataUsd = rows.map((r) => {
      const v = parseFloat(r.total_value) || 0;
      return {
        symbol: r.symbol,
        value: Math.round(v * 100) / 100,
        weightPercent: total > 0 ? Math.round((v / total) * 10000) / 100 : 0,
      };
    });

    const totalUsd = Math.round(total * 100) / 100;
    const rate = await fetchUsdToGbpRate();

    if (rate != null) {
      const data = dataUsd.map((d) => ({
        ...d,
        value: Math.round(d.value * rate * 100) / 100,
      }));
      const totalValue = Math.round(totalUsd * rate * 100) / 100;
      return NextResponse.json({
        data,
        totalValue,
        count: data.length,
        currency: 'GBP' as const,
        usdToGbpRate: rate,
        valueNote:
          'Holdings are stored in USD (eToro). Totals converted to GBP using ECB reference rates (Frankfurter).',
      });
    }

    return NextResponse.json({
      data: dataUsd,
      totalValue: totalUsd,
      count: dataUsd.length,
      currency: 'USD' as const,
      conversionFailed: true,
      valueNote:
        'Could not load USD→GBP rate; amounts are shown in USD. Weights (%) are unchanged.',
    });
  } catch (error: any) {
    console.error('portfolio-weights:', error);
    return NextResponse.json(
      { error: 'Failed to load portfolio weights', details: error.message },
      { status: 500 }
    );
  }
}
