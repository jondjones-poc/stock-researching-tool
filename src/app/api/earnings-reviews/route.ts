import { NextRequest, NextResponse } from 'next/server';
import { getDbPool, query } from '../../utils/db';
import {
  asDbDate,
  categoryGradesFromPayload,
  computeGradeDirection,
  DEFAULT_GRADE_SCORES,
  gradeScore,
  periodLabel,
  validateEarningsReviewJson,
  type EarningsReviewPayload,
} from '../../utils/earningsReview';

type CompanyRow = { id: number; stock: string };

async function loadGradeScale(): Promise<Record<string, number>> {
  try {
    const result = await query('SELECT grade, score FROM earnings_grade_scale');
    if (!result.rows.length) return { ...DEFAULT_GRADE_SCORES };
    const scale: Record<string, number> = {};
    for (const row of result.rows) {
      scale[String(row.grade)] = Number(row.score);
    }
    return scale;
  } catch {
    return { ...DEFAULT_GRADE_SCORES };
  }
}

async function findCompanyByTicker(ticker: string): Promise<CompanyRow | null> {
  const result = await query(
    `SELECT id, stock
     FROM stock_valuations
     WHERE UPPER(stock) = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [ticker.toUpperCase()]
  );
  return result.rows[0] ?? null;
}

async function findCompanyById(id: number): Promise<CompanyRow | null> {
  const result = await query(
    `SELECT id, stock FROM stock_valuations WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
}

async function createCompany(ticker: string): Promise<CompanyRow> {
  const existing = await findCompanyByTicker(ticker);
  if (existing) return existing;
  const inserted = await query(
    `INSERT INTO stock_valuations (stock) VALUES ($1) RETURNING id, stock`,
    [ticker.toUpperCase()]
  );
  return inserted.rows[0];
}

async function findExistingReview(
  companyId: number,
  fiscalYear: number,
  fiscalQuarter: number
): Promise<{ id: number; overall_grade: string | null } | null> {
  const result = await query(
    `SELECT id, overall_grade
     FROM earnings_reviews
     WHERE company_id = $1 AND fiscal_year = $2 AND fiscal_quarter = $3
     LIMIT 1`,
    [companyId, fiscalYear, fiscalQuarter]
  );
  return result.rows[0] ?? null;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function previousOverallGrade(
  client: { query: (sql: string, params: unknown[]) => Promise<{ rows: Array<{ overall_grade: string | null }> }> },
  companyId: number,
  fiscalYear: number,
  fiscalQuarter: number,
  excludeId?: number
): Promise<string | null> {
  const result = await client.query(
    `SELECT overall_grade
     FROM earnings_reviews
     WHERE company_id = $1
       AND (fiscal_year < $2 OR (fiscal_year = $2 AND fiscal_quarter < $3))
       ${excludeId ? 'AND id <> $4' : ''}
     ORDER BY fiscal_year DESC, fiscal_quarter DESC
     LIMIT 1`,
    excludeId ? [companyId, fiscalYear, fiscalQuarter, excludeId] : [companyId, fiscalYear, fiscalQuarter]
  );
  return result.rows[0]?.overall_grade ?? null;
}

async function writeReview(opts: {
  company: CompanyRow;
  payload: EarningsReviewPayload;
  rawJson: unknown;
  filename: string | null;
  existingId?: number;
  scale: Record<string, number>;
}): Promise<number> {
  const { company, payload, rawJson, filename, existingId, scale } = opts;
  const p = payload;
  const overall = p.assessment.overall_grade;
  const pool = getDbPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await previousOverallGrade(
      client,
      company.id,
      p.earnings_period.fiscal_year,
      p.earnings_period.fiscal_quarter,
      existingId
    );
    const direction = computeGradeDirection(overall, previous, scale);
    const reviewParams = [
      company.id,
      p.company.ticker,
      p.company.name,
      p.company.industry,
      p.schema_version,
      p.earnings_period.fiscal_year,
      p.earnings_period.fiscal_quarter,
      p.earnings_period.quarter,
      asDbDate(p.earnings_period.period_end),
      asDbDate(p.earnings_period.report_date),
      p.company.currency,
      overall,
      previous,
      direction,
      p.assessment.business_direction,
      p.assessment.investment_view,
      p.outlook.management_outlook,
      p.outlook.guidance_change,
      p.earnings_quality.one_off_income_description,
      p.earnings_quality.dilution_risk,
      p.assessment.earnings_thesis,
      p.assessment.key_positive,
      p.assessment.key_negative,
      p.assessment.key_risk,
      p.valuation.valuation_grade,
      p.source.source_type,
      p.source.source_name,
      p.source.source_url,
      asDbDate(p.analyst_sentiment.source_date),
      filename,
      JSON.stringify(rawJson),
      JSON.stringify(p.previous_comparison),
      JSON.stringify(p.competitor),
      JSON.stringify(p.analyst_sentiment),
    ];

    let reviewId = existingId;
    if (existingId) {
      await client.query(
        `UPDATE earnings_reviews SET
          ticker = $2,
          company_name = $3,
          industry = $4,
          schema_version = $5,
          fiscal_year = $6,
          fiscal_quarter = $7,
          period_quarter = $8,
          period_end = $9,
          report_date = $10,
          currency = $11,
          overall_grade = $12,
          previous_grade = $13,
          grade_direction = $14,
          business_direction = $15,
          investment_view = $16,
          management_outlook = $17,
          guidance_change = $18,
          one_off_income_description = $19,
          dilution_risk = $20,
          earnings_thesis = $21,
          key_positive = $22,
          key_negative = $23,
          key_risk = $24,
          valuation_grade = $25,
          source_document_type = $26,
          source_name = $27,
          source_url = $28,
          source_reviewed_at = $29,
          original_filename = $30,
          raw_json = $31::jsonb,
          previous_comparison = $32::jsonb,
          competitor = $33::jsonb,
          analyst_sentiment = $34::jsonb
         WHERE id = $1`,
        [existingId, ...reviewParams.slice(1)]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO earnings_reviews (
          company_id, ticker, company_name, industry, schema_version,
          fiscal_year, fiscal_quarter, period_quarter, period_end, report_date, currency,
          overall_grade, previous_grade, grade_direction, business_direction,
          investment_view, management_outlook, guidance_change, one_off_income_description,
          dilution_risk, earnings_thesis, key_positive, key_negative, key_risk, valuation_grade,
          source_document_type, source_name, source_url, source_reviewed_at, original_filename,
          raw_json, previous_comparison, competitor, analyst_sentiment
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
          $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31::jsonb,$32::jsonb,$33::jsonb,$34::jsonb
        ) RETURNING id`,
        reviewParams
      );
      reviewId = Number(inserted.rows[0].id);
    }

    await client.query('DELETE FROM earnings_financials WHERE earnings_review_id = $1', [reviewId]);
    await client.query(
      `INSERT INTO earnings_financials (
        earnings_review_id, revenue, revenue_yoy_growth_pct, revenue_qoq_growth_pct,
        revenue_estimate, revenue_surprise_pct, eps, eps_estimate, eps_surprise_pct,
        gross_profit, gross_margin_pct, gross_margin_prior_pct, operating_income,
        operating_margin_pct, net_income, operating_expenses, operating_expenses_yoy_pct,
        cost_of_revenue, cost_of_revenue_yoy_pct, sales_marketing, sales_marketing_yoy_pct,
        research_development, research_development_yoy_pct, general_admin, general_admin_yoy_pct,
        one_off_expenses, cash, short_term_investments, debt, net_cash, free_cash_flow,
        operating_cash_flow, inventory, accounts_receivable, shares_outstanding,
        share_count_yoy_growth_pct, revenue_guidance_low, revenue_guidance_high,
        eps_guidance_low, eps_guidance_high, recurring_profit, one_off_income,
        stock_based_compensation, current_price, market_cap, pe_ratio, price_to_sales,
        ev_to_sales, dcf_fair_value, profitability_free_cash_flow
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26::jsonb,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,
        $41,$42,$43,$44,$45,$46,$47,$48,$49,$50
      )`,
      [
        reviewId,
        num(p.revenue.value),
        num(p.revenue.yoy_growth_pct),
        num(p.revenue.qoq_growth_pct),
        num(p.revenue.analyst_estimate),
        num(p.revenue.surprise_pct),
        num(p.profitability.eps),
        num(p.profitability.eps_estimate),
        num(p.profitability.eps_surprise_pct),
        num(p.profitability.gross_profit),
        num(p.profitability.gross_margin_pct),
        num(p.profitability.gross_margin_prior_pct),
        num(p.profitability.operating_income),
        num(p.profitability.operating_margin_pct),
        num(p.profitability.net_income),
        num(p.costs.operating_expenses),
        num(p.costs.operating_expenses_yoy_pct),
        num(p.costs.cost_of_revenue),
        num(p.costs.cost_of_revenue_yoy_pct),
        num(p.costs.sales_marketing),
        num(p.costs.sales_marketing_yoy_pct),
        num(p.costs.research_development),
        num(p.costs.research_development_yoy_pct),
        num(p.costs.general_admin),
        num(p.costs.general_admin_yoy_pct),
        p.costs.one_off_expenses ? JSON.stringify(p.costs.one_off_expenses) : null,
        num(p.balance_sheet.cash),
        num(p.balance_sheet.short_term_investments),
        num(p.balance_sheet.debt),
        num(p.balance_sheet.net_cash),
        num(p.balance_sheet.free_cash_flow),
        num(p.balance_sheet.operating_cash_flow),
        num(p.balance_sheet.inventory),
        num(p.balance_sheet.accounts_receivable),
        num(p.balance_sheet.shares_outstanding),
        num(p.balance_sheet.share_count_yoy_growth_pct),
        num(p.outlook.revenue_guidance_low),
        num(p.outlook.revenue_guidance_high),
        num(p.outlook.eps_guidance_low),
        num(p.outlook.eps_guidance_high),
        p.earnings_quality.recurring_profit,
        num(p.earnings_quality.one_off_income),
        num(p.earnings_quality.stock_based_compensation),
        num(p.valuation.current_price),
        num(p.valuation.market_cap),
        num(p.valuation.pe_ratio),
        num(p.valuation.price_to_sales),
        num(p.valuation.ev_to_sales),
        num(p.valuation.dcf_fair_value),
        num(p.profitability.free_cash_flow),
      ]
    );

    await client.query('DELETE FROM earnings_grades WHERE earnings_review_id = $1', [reviewId]);
    for (const row of categoryGradesFromPayload(p)) {
      await client.query(
        `INSERT INTO earnings_grades (earnings_review_id, category, grade, score)
         VALUES ($1, $2, $3, $4)`,
        [reviewId, row.category, row.grade, gradeScore(row.grade, scale)]
      );
    }

    await client.query('COMMIT');
    return reviewId as number;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function migrationHint(error: unknown): Record<string, unknown> {
  const err = error as { code?: string; message?: string };
  if (err.code === '42P01' || err.code === '42703') {
    return {
      hint: 'Run scripts/migrations/044_earnings_reviews.sql and 045_earnings_reviews_extended_fields.sql in Supabase before using Earnings Reviews.',
    };
  }
  return {};
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol')?.toUpperCase();
    const companyId = searchParams.get('company_id') || searchParams.get('stock_valuations_id');
    const industry = searchParams.get('industry');
    const id = searchParams.get('id');

    const params: Array<string | number> = [];
    const where: string[] = [];
    if (id) {
      params.push(id);
      where.push(`r.id = $${params.length}`);
    }
    if (symbol) {
      params.push(symbol);
      where.push(`UPPER(r.ticker) = $${params.length}`);
    }
    if (companyId) {
      params.push(Number(companyId));
      where.push(`r.company_id = $${params.length}`);
    }
    if (industry) {
      params.push(industry);
      where.push(`LOWER(r.industry) = LOWER($${params.length})`);
    }

    const result = await query(
      `SELECT
         r.*,
         f.revenue, f.revenue_yoy_growth_pct, f.revenue_qoq_growth_pct,
         f.revenue_estimate, f.revenue_surprise_pct, f.eps, f.eps_estimate,
         f.eps_surprise_pct, f.gross_profit, f.gross_margin_pct, f.gross_margin_prior_pct,
         f.operating_income, f.operating_margin_pct, f.net_income,
         f.operating_expenses, f.operating_expenses_yoy_pct, f.cost_of_revenue,
         f.cost_of_revenue_yoy_pct, f.sales_marketing, f.sales_marketing_yoy_pct,
         f.research_development, f.research_development_yoy_pct, f.general_admin,
         f.general_admin_yoy_pct, f.one_off_expenses, f.cash, f.short_term_investments,
         f.debt, f.net_cash, f.free_cash_flow, f.operating_cash_flow, f.inventory,
         f.accounts_receivable, f.shares_outstanding, f.share_count_yoy_growth_pct,
         f.revenue_guidance_low, f.revenue_guidance_high, f.eps_guidance_low,
         f.eps_guidance_high, f.recurring_profit, f.one_off_income,
         f.stock_based_compensation, f.current_price, f.market_cap, f.pe_ratio,
         f.price_to_sales, f.ev_to_sales, f.dcf_fair_value, f.profitability_free_cash_flow
       FROM earnings_reviews r
       LEFT JOIN earnings_financials f ON f.earnings_review_id = r.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY r.fiscal_year DESC, r.fiscal_quarter DESC, r.id DESC`,
      params
    );

    const ids = result.rows.map((row) => row.id);
    const gradesByReview = new Map<number, Record<string, { grade: string | null; score: number | null }>>();
    if (ids.length) {
      const grades = await query(
        `SELECT earnings_review_id, category, grade, score
         FROM earnings_grades
         WHERE earnings_review_id = ANY($1::bigint[])`,
        [ids]
      );
      for (const row of grades.rows) {
        const reviewId = Number(row.earnings_review_id);
        const current = gradesByReview.get(reviewId) || {};
        current[row.category] = {
          grade: row.grade,
          score: row.score != null ? Number(row.score) : null,
        };
        gradesByReview.set(reviewId, current);
      }
    }

    const data = result.rows.map((row) => ({
      id: Number(row.id),
      company_id: Number(row.company_id),
      ticker: row.ticker,
      company_name: row.company_name,
      industry: row.industry,
      schema_version: row.schema_version,
      fiscal_year: Number(row.fiscal_year),
      fiscal_quarter: Number(row.fiscal_quarter),
      period_quarter: row.period_quarter,
      period_label: periodLabel(
        Number(row.fiscal_year),
        Number(row.fiscal_quarter),
        row.period_quarter
      ),
      period_end: row.period_end,
      report_date: row.report_date,
      currency: row.currency,
      overall_grade: row.overall_grade,
      previous_grade: row.previous_grade,
      grade_direction: row.grade_direction,
      business_direction: row.business_direction,
      investment_view: row.investment_view,
      management_outlook: row.management_outlook,
      guidance_change: row.guidance_change,
      one_off_income_description: row.one_off_income_description,
      dilution_risk: row.dilution_risk,
      earnings_thesis: row.earnings_thesis,
      key_positive: row.key_positive,
      key_negative: row.key_negative,
      key_risk: row.key_risk,
      valuation_grade: row.valuation_grade,
      source_type: row.source_document_type,
      source_name: row.source_name,
      source_url: row.source_url,
      previous_comparison: row.previous_comparison,
      competitor: row.competitor,
      analyst_sentiment: row.analyst_sentiment,
      raw_json: row.raw_json ?? null,
      grades: gradesByReview.get(Number(row.id)) || {},
      financials: {
        revenue: num(row.revenue),
        revenue_yoy_growth_pct: num(row.revenue_yoy_growth_pct),
        revenue_qoq_growth_pct: num(row.revenue_qoq_growth_pct),
        revenue_estimate: num(row.revenue_estimate),
        revenue_surprise_pct: num(row.revenue_surprise_pct),
        eps: num(row.eps),
        eps_estimate: num(row.eps_estimate),
        eps_surprise_pct: num(row.eps_surprise_pct),
        gross_profit: num(row.gross_profit),
        gross_margin_pct: num(row.gross_margin_pct),
        gross_margin_prior_pct: num(row.gross_margin_prior_pct),
        operating_income: num(row.operating_income),
        operating_margin_pct: num(row.operating_margin_pct),
        net_income: num(row.net_income),
        profitability_free_cash_flow: num(row.profitability_free_cash_flow),
        operating_expenses: num(row.operating_expenses),
        operating_expenses_yoy_pct: num(row.operating_expenses_yoy_pct),
        cost_of_revenue: num(row.cost_of_revenue),
        cost_of_revenue_yoy_pct: num(row.cost_of_revenue_yoy_pct),
        sales_marketing: num(row.sales_marketing),
        sales_marketing_yoy_pct: num(row.sales_marketing_yoy_pct),
        research_development: num(row.research_development),
        research_development_yoy_pct: num(row.research_development_yoy_pct),
        general_admin: num(row.general_admin),
        general_admin_yoy_pct: num(row.general_admin_yoy_pct),
        one_off_expenses: row.one_off_expenses ?? null,
        cash: num(row.cash),
        short_term_investments: num(row.short_term_investments),
        debt: num(row.debt),
        net_cash: num(row.net_cash),
        free_cash_flow: num(row.free_cash_flow),
        operating_cash_flow: num(row.operating_cash_flow),
        inventory: num(row.inventory),
        accounts_receivable: num(row.accounts_receivable),
        shares_outstanding: num(row.shares_outstanding),
        share_count_yoy_growth_pct: num(row.share_count_yoy_growth_pct),
        revenue_guidance_low: num(row.revenue_guidance_low),
        revenue_guidance_high: num(row.revenue_guidance_high),
        eps_guidance_low: num(row.eps_guidance_low),
        eps_guidance_high: num(row.eps_guidance_high),
        recurring_profit: row.recurring_profit ?? null,
        one_off_income: num(row.one_off_income),
        stock_based_compensation: num(row.stock_based_compensation),
        current_price: num(row.current_price),
        market_cap: num(row.market_cap),
        pe_ratio: num(row.pe_ratio),
        price_to_sales: num(row.price_to_sales),
        ev_to_sales: num(row.ev_to_sales),
        dcf_fair_value: num(row.dcf_fair_value),
      },
    }));

    return NextResponse.json({ data });
  } catch (error: unknown) {
    console.error('earnings-reviews GET failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to load earnings reviews',
        ...migrationHint(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const raw = body.review ?? body.payload ?? body;
    const filename = typeof body.filename === 'string' ? body.filename : null;
    const replace = body.replace === true;
    const createCompanyIfMissing = body.createCompany === true;
    const companyId =
      body.companyId != null && Number.isFinite(Number(body.companyId))
        ? Number(body.companyId)
        : null;
    const dryRun = body.dryRun === true;

    const validated = validateEarningsReviewJson(raw);
    if (!validated.ok) {
      return NextResponse.json(
        {
          error: 'Earnings review JSON failed validation.',
          errors: validated.errors,
        },
        { status: 400 }
      );
    }

    const payload = validated.value;
    const ticker = payload.company.ticker;
    let company = companyId ? await findCompanyById(companyId) : await findCompanyByTicker(ticker);

    if (!company && createCompanyIfMissing) {
      company = await createCompany(ticker);
    }

    if (!company) {
      return NextResponse.json(
        {
          error: `No company found for ticker ${ticker}. Select an existing company or create one.`,
          code: 'COMPANY_NOT_FOUND',
          ticker,
        },
        { status: 409 }
      );
    }

    const existing = await findExistingReview(
      company.id,
      payload.earnings_period.fiscal_year,
      payload.earnings_period.fiscal_quarter
    );

    if (existing && !replace) {
      return NextResponse.json(
        {
          error: `A review already exists for ${ticker} ${periodLabel(
            payload.earnings_period.fiscal_year,
            payload.earnings_period.fiscal_quarter,
            payload.earnings_period.quarter
          )}. Confirm replace to overwrite it.`,
          code: 'DUPLICATE_QUARTER',
          ticker,
          company,
          existing: {
            id: Number(existing.id),
            overall_grade: existing.overall_grade,
            fiscal_year: payload.earnings_period.fiscal_year,
            fiscal_quarter: payload.earnings_period.fiscal_quarter,
            period_label: periodLabel(
              payload.earnings_period.fiscal_year,
              payload.earnings_period.fiscal_quarter,
              payload.earnings_period.quarter
            ),
          },
        },
        { status: 409 }
      );
    }

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        company,
        ticker,
        period_label: periodLabel(
          payload.earnings_period.fiscal_year,
          payload.earnings_period.fiscal_quarter,
          payload.earnings_period.quarter
        ),
        existing: existing
          ? { id: Number(existing.id), overall_grade: existing.overall_grade }
          : null,
      });
    }

    const scale = await loadGradeScale();
    const id = await writeReview({
      company,
      payload,
      rawJson: raw,
      filename,
      existingId: existing ? Number(existing.id) : undefined,
      scale,
    });

    return NextResponse.json({
      ok: true,
      id,
      company,
      replaced: Boolean(existing),
    });
  } catch (error: unknown) {
    console.error('earnings-reviews POST failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to save earnings review',
        ...migrationHint(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    const result = await query(
      'DELETE FROM earnings_reviews WHERE id = $1 RETURNING id',
      [id]
    );
    if (!result.rows.length) {
      return NextResponse.json({ error: 'Earnings review not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, id: Number(result.rows[0].id) });
  } catch (error: unknown) {
    console.error('earnings-reviews DELETE failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete earnings review',
        ...migrationHint(error),
      },
      { status: 500 }
    );
  }
}
