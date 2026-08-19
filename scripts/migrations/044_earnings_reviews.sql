-- Earnings Reviews (Earnings Intelligence v1)
-- Additive only: new tables/indexes. No drops of existing app tables.
-- Company identity reuses stock_valuations (ticker = stock). Do not duplicate companies.

-- Configurable numeric scores behind letter grades (algorithm can change later).
CREATE TABLE IF NOT EXISTS public.earnings_grade_scale (
  grade TEXT PRIMARY KEY,
  score NUMERIC(6, 2) NOT NULL,
  sort_order INTEGER NOT NULL UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.earnings_grade_scale (grade, score, sort_order) VALUES
  ('A*', 100, 1),
  ('A+', 95, 2),
  ('A', 90, 3),
  ('A-', 85, 4),
  ('B+', 80, 5),
  ('B', 75, 6),
  ('B-', 70, 7),
  ('C+', 65, 8),
  ('C', 60, 9),
  ('C-', 55, 10),
  ('D', 40, 11),
  ('E', 20, 12)
ON CONFLICT (grade) DO NOTHING;

-- Future automated Earnings Score weights. Valuation is intentionally omitted
-- so earnings quality and stock price are never auto-combined.
CREATE TABLE IF NOT EXISTS public.earnings_score_weights (
  category TEXT PRIMARY KEY,
  weight NUMERIC(6, 3) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.earnings_score_weights (category, weight) VALUES
  ('revenue', 1),
  ('profitability', 1),
  ('costs', 1),
  ('balance_sheet', 1),
  ('outlook', 1),
  ('earnings_quality', 1)
ON CONFLICT (category) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.earnings_reviews (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES public.stock_valuations(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT NULL,
  industry TEXT NULL,
  sector TEXT NULL,
  schema_version TEXT NOT NULL,
  fiscal_year INTEGER NOT NULL CHECK (fiscal_year >= 1900 AND fiscal_year <= 2100),
  fiscal_quarter INTEGER NOT NULL CHECK (fiscal_quarter >= 1 AND fiscal_quarter <= 4),
  period_end DATE NULL,
  report_date DATE NULL,
  currency TEXT NULL,
  overall_grade TEXT NULL REFERENCES public.earnings_grade_scale(grade),
  previous_grade TEXT NULL REFERENCES public.earnings_grade_scale(grade),
  grade_direction TEXT NULL CHECK (grade_direction IN ('improving', 'flat', 'declining')),
  business_direction TEXT NULL CHECK (business_direction IN ('improving', 'flat', 'declining', 'stable')),
  earnings_thesis TEXT NULL,
  key_positive TEXT NULL,
  key_negative TEXT NULL,
  key_risk TEXT NULL,
  valuation_grade TEXT NULL REFERENCES public.earnings_grade_scale(grade),
  source_document_type TEXT NULL,
  source_url TEXT NULL,
  source_reviewed_at DATE NULL,
  original_filename TEXT NULL,
  raw_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, fiscal_year, fiscal_quarter)
);

CREATE INDEX IF NOT EXISTS idx_earnings_reviews_ticker_period
  ON public.earnings_reviews (ticker, fiscal_year DESC, fiscal_quarter DESC);

CREATE INDEX IF NOT EXISTS idx_earnings_reviews_industry
  ON public.earnings_reviews (industry);

CREATE INDEX IF NOT EXISTS idx_earnings_reviews_overall_grade
  ON public.earnings_reviews (overall_grade);

CREATE INDEX IF NOT EXISTS idx_earnings_reviews_company_id
  ON public.earnings_reviews (company_id);

COMMENT ON TABLE public.earnings_reviews IS
  'One structured earnings review per company fiscal quarter. Valuation grade is stored separately from overall earnings grade.';

CREATE TABLE IF NOT EXISTS public.earnings_financials (
  id BIGSERIAL PRIMARY KEY,
  earnings_review_id BIGINT NOT NULL UNIQUE REFERENCES public.earnings_reviews(id) ON DELETE CASCADE,
  revenue NUMERIC(20, 4) NULL,
  revenue_yoy_growth_pct NUMERIC(12, 4) NULL,
  revenue_qoq_growth_pct NUMERIC(12, 4) NULL,
  revenue_estimate NUMERIC(20, 4) NULL,
  revenue_surprise_pct NUMERIC(12, 4) NULL,
  eps NUMERIC(16, 6) NULL,
  eps_estimate NUMERIC(16, 6) NULL,
  eps_surprise_pct NUMERIC(12, 4) NULL,
  gross_profit NUMERIC(20, 4) NULL,
  gross_margin_pct NUMERIC(12, 4) NULL,
  gross_margin_prior_pct NUMERIC(12, 4) NULL,
  operating_income NUMERIC(20, 4) NULL,
  operating_margin_pct NUMERIC(12, 4) NULL,
  net_income NUMERIC(20, 4) NULL,
  operating_expenses NUMERIC(20, 4) NULL,
  operating_expenses_yoy_pct NUMERIC(12, 4) NULL,
  cost_of_revenue NUMERIC(20, 4) NULL,
  cost_of_revenue_yoy_pct NUMERIC(12, 4) NULL,
  cash NUMERIC(20, 4) NULL,
  short_term_investments NUMERIC(20, 4) NULL,
  debt NUMERIC(20, 4) NULL,
  net_cash NUMERIC(20, 4) NULL,
  free_cash_flow NUMERIC(20, 4) NULL,
  operating_cash_flow NUMERIC(20, 4) NULL,
  shares_outstanding NUMERIC(20, 4) NULL,
  share_count_yoy_growth_pct NUMERIC(12, 4) NULL
);

CREATE INDEX IF NOT EXISTS idx_earnings_financials_review
  ON public.earnings_financials (earnings_review_id);

COMMENT ON TABLE public.earnings_financials IS
  'Searchable/chartable metrics for an earnings review. Nulls are allowed when a metric does not apply to the industry.';

CREATE TABLE IF NOT EXISTS public.earnings_grades (
  id BIGSERIAL PRIMARY KEY,
  earnings_review_id BIGINT NOT NULL REFERENCES public.earnings_reviews(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (
    category IN (
      'revenue',
      'profitability',
      'costs',
      'balance_sheet',
      'outlook',
      'earnings_quality',
      'valuation',
      'overall'
    )
  ),
  grade TEXT NULL REFERENCES public.earnings_grade_scale(grade),
  score NUMERIC(6, 2) NULL,
  UNIQUE (earnings_review_id, category)
);

CREATE INDEX IF NOT EXISTS idx_earnings_grades_category_grade
  ON public.earnings_grades (category, grade);

COMMENT ON TABLE public.earnings_grades IS
  'Per-category letter grades plus numeric scores from earnings_grade_scale. Valuation is stored but not mixed into earnings score.';

CREATE OR REPLACE FUNCTION public.set_earnings_reviews_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_earnings_reviews_updated_at ON public.earnings_reviews;
CREATE TRIGGER trg_earnings_reviews_updated_at
  BEFORE UPDATE ON public.earnings_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_earnings_reviews_updated_at();
