-- Add free cash flow fields to Company Finder / Deep Value Stocks cache.
ALTER TABLE company_finder_companies
  ADD COLUMN IF NOT EXISTS fcf_ytd NUMERIC,
  ADD COLUMN IF NOT EXISTS fcf_as_of DATE,
  ADD COLUMN IF NOT EXISTS fcf_period TEXT,
  ADD COLUMN IF NOT EXISTS fcf_source TEXT;

CREATE INDEX IF NOT EXISTS idx_company_finder_fcf_ytd
  ON company_finder_companies (fcf_ytd DESC NULLS LAST);

COMMENT ON COLUMN company_finder_companies.fcf_ytd IS
  'Free cash flow for matched period: direct SEC tag when available, else OCF - CapEx.';
