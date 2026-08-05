-- Confidence Score cache for Deep Value Stocks (SEC EDGAR only; not part of value ranking).
ALTER TABLE company_finder_companies
  ADD COLUMN IF NOT EXISTS confidence_score INT,
  ADD COLUMN IF NOT EXISTS confidence_reasons JSONB,
  ADD COLUMN IF NOT EXISTS confidence_latest_filing_date DATE,
  ADD COLUMN IF NOT EXISTS confidence_latest_accession TEXT,
  ADD COLUMN IF NOT EXISTS confidence_latest_form TEXT,
  ADD COLUMN IF NOT EXISTS confidence_is_foreign BOOLEAN,
  ADD COLUMN IF NOT EXISTS confidence_flag_going_concern BOOLEAN,
  ADD COLUMN IF NOT EXISTS confidence_flag_reverse_split BOOLEAN,
  ADD COLUMN IF NOT EXISTS confidence_flag_discontinued BOOLEAN,
  ADD COLUMN IF NOT EXISTS confidence_computed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_company_finder_confidence_score
  ON company_finder_companies (confidence_score DESC NULLS LAST);

COMMENT ON COLUMN company_finder_companies.confidence_score IS
  'Data-reliability score 0-100 (starts at 100, penalties from SEC filing warnings). Separate from value score.';
COMMENT ON COLUMN company_finder_companies.confidence_reasons IS
  'JSON array of {code, message, points} explaining confidence deductions.';
COMMENT ON COLUMN company_finder_companies.confidence_latest_accession IS
  'SEC accession of the filing used for confidence text flags; refresh flags only when this changes.';
