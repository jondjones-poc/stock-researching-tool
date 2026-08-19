-- Align storage with earnings-review-v1.schema.json. Additive / constraint updates only.

UPDATE public.earnings_reviews
SET business_direction = CASE
  WHEN business_direction = 'improving' THEN 'Improving'
  WHEN business_direction IN ('flat', 'stable') THEN 'Stable'
  WHEN business_direction = 'declining' THEN 'Weakening'
  ELSE business_direction
END
WHERE business_direction IN ('improving', 'flat', 'declining', 'stable');

ALTER TABLE public.earnings_reviews
  DROP CONSTRAINT IF EXISTS earnings_reviews_business_direction_check;

ALTER TABLE public.earnings_reviews
  ADD CONSTRAINT earnings_reviews_business_direction_check
  CHECK (
    business_direction IS NULL OR business_direction IN (
      'Strongly Improving',
      'Improving',
      'Stable',
      'Weakening',
      'In Trouble'
    )
  );

ALTER TABLE public.earnings_reviews
  ADD COLUMN IF NOT EXISTS period_quarter TEXT NULL,
  ADD COLUMN IF NOT EXISTS investment_view TEXT NULL,
  ADD COLUMN IF NOT EXISTS management_outlook TEXT NULL,
  ADD COLUMN IF NOT EXISTS guidance_change TEXT NULL,
  ADD COLUMN IF NOT EXISTS one_off_income_description TEXT NULL,
  ADD COLUMN IF NOT EXISTS dilution_risk TEXT NULL,
  ADD COLUMN IF NOT EXISTS source_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS previous_comparison JSONB NULL,
  ADD COLUMN IF NOT EXISTS competitor JSONB NULL,
  ADD COLUMN IF NOT EXISTS analyst_sentiment JSONB NULL;

ALTER TABLE public.earnings_reviews
  DROP CONSTRAINT IF EXISTS earnings_reviews_investment_view_check;

ALTER TABLE public.earnings_reviews
  ADD CONSTRAINT earnings_reviews_investment_view_check
  CHECK (investment_view IS NULL OR investment_view IN ('Buy', 'Hold', 'Sell'));

ALTER TABLE public.earnings_reviews
  DROP CONSTRAINT IF EXISTS earnings_reviews_management_outlook_check;

ALTER TABLE public.earnings_reviews
  ADD CONSTRAINT earnings_reviews_management_outlook_check
  CHECK (
    management_outlook IS NULL OR management_outlook IN (
      'Very Positive',
      'Positive',
      'Neutral',
      'Negative',
      'Very Negative'
    )
  );

ALTER TABLE public.earnings_reviews
  DROP CONSTRAINT IF EXISTS earnings_reviews_dilution_risk_check;

ALTER TABLE public.earnings_reviews
  ADD CONSTRAINT earnings_reviews_dilution_risk_check
  CHECK (dilution_risk IS NULL OR dilution_risk IN ('Low', 'Medium', 'High'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'earnings_financials'
      AND column_name = 'one_off_expenses'
      AND udt_name <> 'jsonb'
  ) THEN
    ALTER TABLE public.earnings_financials DROP COLUMN one_off_expenses;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'earnings_financials'
      AND column_name = 'recurring_profit'
      AND data_type <> 'boolean'
  ) THEN
    ALTER TABLE public.earnings_financials DROP COLUMN recurring_profit;
  END IF;
END $$;

ALTER TABLE public.earnings_financials
  ADD COLUMN IF NOT EXISTS sales_marketing NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS sales_marketing_yoy_pct NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS research_development NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS research_development_yoy_pct NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS general_admin NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS general_admin_yoy_pct NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS one_off_expenses JSONB NULL,
  ADD COLUMN IF NOT EXISTS inventory NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS accounts_receivable NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS revenue_guidance_low NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS revenue_guidance_high NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS eps_guidance_low NUMERIC(16, 6) NULL,
  ADD COLUMN IF NOT EXISTS eps_guidance_high NUMERIC(16, 6) NULL,
  ADD COLUMN IF NOT EXISTS recurring_profit BOOLEAN NULL,
  ADD COLUMN IF NOT EXISTS one_off_income NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS stock_based_compensation NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS current_price NUMERIC(16, 6) NULL,
  ADD COLUMN IF NOT EXISTS market_cap NUMERIC(20, 4) NULL,
  ADD COLUMN IF NOT EXISTS pe_ratio NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS price_to_sales NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS ev_to_sales NUMERIC(12, 4) NULL,
  ADD COLUMN IF NOT EXISTS dcf_fair_value NUMERIC(16, 6) NULL,
  ADD COLUMN IF NOT EXISTS profitability_free_cash_flow NUMERIC(20, 4) NULL;
