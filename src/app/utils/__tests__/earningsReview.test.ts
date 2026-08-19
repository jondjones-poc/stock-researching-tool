import {
  asDbDate,
  computeGradeDirection,
  DEFAULT_GRADE_SCORES,
  gradeScore,
  parseQuarterNumber,
  periodLabel,
  reviewsConflict,
  validateEarningsReviewJson,
} from '../earningsReview';

function validReview(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: '1.0',
    company: { name: 'Adobe Inc.', ticker: 'ADBE', currency: 'USD', industry: 'Software' },
    earnings_period: {
      fiscal_year: 2026,
      quarter: 'Q2',
      period_end: '2026-05-29',
      report_date: '2026-06-16',
    },
    revenue: {
      value: 5_400_000_000,
      yoy_growth_pct: 11.2,
      qoq_growth_pct: 2.1,
      analyst_estimate: 5_300_000_000,
      surprise_pct: 1.9,
      grade: 'A-',
    },
    profitability: {
      eps: 4.12,
      eps_estimate: 4.05,
      eps_surprise_pct: 1.7,
      gross_profit: 4_800_000_000,
      gross_margin_pct: 88.9,
      gross_margin_prior_pct: 88.1,
      operating_income: 1_800_000_000,
      operating_margin_pct: 33.3,
      net_income: 1_400_000_000,
      free_cash_flow: 2_100_000_000,
      grade: 'A',
    },
    costs: {
      operating_expenses: 3_000_000_000,
      operating_expenses_yoy_pct: 8.4,
      cost_of_revenue: 600_000_000,
      cost_of_revenue_yoy_pct: 4.2,
      sales_marketing: 1_200_000_000,
      sales_marketing_yoy_pct: 6.1,
      research_development: 900_000_000,
      research_development_yoy_pct: 9.0,
      general_admin: 400_000_000,
      general_admin_yoy_pct: 3.0,
      one_off_expenses: [{ name: 'Restructuring', value: 50_000_000, impact: 'negative' }],
      grade: 'B+',
    },
    balance_sheet: {
      cash: 8_000_000_000,
      short_term_investments: 1_000_000_000,
      debt: 4_000_000_000,
      net_cash: 5_000_000_000,
      operating_cash_flow: 2_400_000_000,
      free_cash_flow: 2_100_000_000,
      inventory: null,
      accounts_receivable: 1_500_000_000,
      shares_outstanding: 430_000_000,
      share_count_yoy_growth_pct: -1.2,
      grade: 'A',
    },
    outlook: {
      revenue_guidance_low: 5_500_000_000,
      revenue_guidance_high: 5_700_000_000,
      eps_guidance_low: 4.2,
      eps_guidance_high: 4.4,
      guidance_change: 'Raised',
      management_outlook: 'Positive',
      grade: 'B+',
    },
    earnings_quality: {
      recurring_profit: true,
      one_off_income: null,
      one_off_income_description: null,
      stock_based_compensation: 400_000_000,
      dilution_risk: 'Low',
      grade: 'A-',
    },
    previous_comparison: {
      revenue_trend: 'Accelerating',
      margin_trend: 'Stable',
      cost_trend: 'Improving',
      cash_flow_trend: 'Strong',
      guidance_trend: 'Raised',
    },
    competitor: {
      name: 'Microsoft',
      ticker: 'MSFT',
      revenue_growth_pct: 12.0,
      gross_margin_pct: 69.0,
      operating_margin_pct: 42.0,
      comparison_summary: 'Adobe growing software mix similarly.',
    },
    analyst_sentiment: {
      consensus: 'Buy',
      buy_count: 20,
      hold_count: 8,
      sell_count: 1,
      average_price_target: 480,
      recent_rating_change: null,
      source_name: 'Bloomberg',
      source_date: '2026-06-16',
    },
    assessment: {
      overall_grade: 'A-',
      business_direction: 'Improving',
      investment_view: 'Buy',
      key_positive: 'Revenue beat',
      key_negative: 'OpEx growth',
      key_risk: 'AI competition',
      earnings_thesis: 'High-quality software earnings.',
    },
    valuation: {
      current_price: 420,
      market_cap: 180_000_000_000,
      pe_ratio: 28,
      price_to_sales: 8.2,
      ev_to_sales: 8.0,
      dcf_fair_value: 450,
      valuation_grade: 'B',
    },
    source: {
      source_type: '10-Q',
      source_name: 'SEC',
      source_url: 'https://www.sec.gov/example',
    },
    ...overrides,
  };
}

describe('validateEarningsReviewJson', () => {
  it('accepts a full official schema 1.0 review', () => {
    const result = validateEarningsReviewJson(validReview());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.company.ticker).toBe('ADBE');
    expect(result.value.earnings_period.quarter).toBe('Q2');
    expect(result.value.earnings_period.fiscal_quarter).toBe(2);
    expect(result.value.revenue.value).toBe(5_400_000_000);
    expect(result.value.revenue.analyst_estimate).toBe(5_300_000_000);
    expect(result.value.assessment.business_direction).toBe('Improving');
    expect(result.value.assessment.investment_view).toBe('Buy');
    expect(result.value.valuation.valuation_grade).toBe('B');
    expect(result.value.source.source_type).toBe('10-Q');
  });

  it('allows null metric values', () => {
    const result = validateEarningsReviewJson(
      validReview({
        revenue: {
          value: null,
          yoy_growth_pct: null,
          qoq_growth_pct: null,
          analyst_estimate: null,
          surprise_pct: null,
          grade: null,
        },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.revenue.value).toBeNull();
    expect(result.value.revenue.grade).toBeNull();
  });

  it('rejects the old fiscal_quarter field name', () => {
    const result = validateEarningsReviewJson(
      validReview({
        earnings_period: {
          fiscal_year: 2026,
          fiscal_quarter: 2,
          quarter: 'Q2',
          period_end: '2026-05-29',
          report_date: '2026-06-16',
        },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'earnings_period.fiscal_quarter')).toBe(true);
  });

  it('rejects unknown top-level fields', () => {
    const result = validateEarningsReviewJson(validReview({ extra: true }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'extra')).toBe(true);
  });

  it('rejects an array root', () => {
    const result = validateEarningsReviewJson([validReview()]);
    expect(result.ok).toBe(false);
  });

  it('rejects the wrong schema version', () => {
    const result = validateEarningsReviewJson(validReview({ schema_version: '2.0' }));
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'schema_version')).toBe(true);
  });

  it('requires ticker, year, and quarter to store a review', () => {
    const result = validateEarningsReviewJson(
      validReview({
        company: { name: 'Adobe', ticker: null, currency: 'USD', industry: 'Software' },
        earnings_period: {
          fiscal_year: null,
          quarter: null,
          period_end: null,
          report_date: null,
        },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'company.ticker')).toBe(true);
    expect(result.errors.some((e) => e.path === 'earnings_period.fiscal_year')).toBe(true);
    expect(result.errors.some((e) => e.path === 'earnings_period.quarter')).toBe(true);
  });

  it('rejects unofficial business_direction values', () => {
    const result = validateEarningsReviewJson(
      validReview({
        assessment: {
          overall_grade: 'A-',
          business_direction: 'improving',
          investment_view: 'Buy',
          key_positive: null,
          key_negative: null,
          key_risk: null,
          earnings_thesis: null,
        },
      })
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.path === 'assessment.business_direction')).toBe(true);
  });
});

describe('helpers', () => {
  it('maps grades to scores', () => {
    expect(gradeScore('A*', DEFAULT_GRADE_SCORES)).toBe(100);
    expect(gradeScore('E', DEFAULT_GRADE_SCORES)).toBe(20);
    expect(gradeScore(null)).toBeNull();
  });

  it('computes grade direction from previous overall grade', () => {
    expect(computeGradeDirection('A', 'B')).toBe('improving');
    expect(computeGradeDirection('B', 'A')).toBe('declining');
    expect(computeGradeDirection('A', 'A')).toBe('flat');
  });

  it('builds period labels from quarter strings', () => {
    expect(periodLabel(2026, 2, 'Q2')).toBe('Q2 2026');
    expect(periodLabel(2026, 2)).toBe('Q2 2026');
  });

  it('parses Q1-Q4 from quarter strings', () => {
    expect(parseQuarterNumber('Q2')).toBe(2);
    expect(parseQuarterNumber('q4')).toBe(4);
    expect(parseQuarterNumber('3')).toBe(3);
    expect(parseQuarterNumber('Q9')).toBeNull();
  });

  it('detects duplicate year/quarter rows', () => {
    expect(reviewsConflict([{ fiscal_year: 2026, fiscal_quarter: 2 }], 2026, 2)).toBe(true);
    expect(reviewsConflict([{ fiscal_year: 2026, fiscal_quarter: 2 }], 2026, 3)).toBe(false);
  });

  it('extracts ISO dates for DATE columns', () => {
    expect(asDbDate('2026-05-29')).toBe('2026-05-29');
    expect(asDbDate('2026-05-29T12:00:00Z')).toBe('2026-05-29');
    expect(asDbDate('May 29, 2026')).toBeNull();
  });
});
