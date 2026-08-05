-- Net Cash = Cash and Short-Term Investments − Total Debt (single SEC Total Debt fact only).
-- If SEC Total Debt is unavailable, net_cash stays NULL (no debt field summing).
ALTER TABLE company_finder_companies
  ADD COLUMN IF NOT EXISTS total_debt NUMERIC,
  ADD COLUMN IF NOT EXISTS total_debt_as_of DATE,
  ADD COLUMN IF NOT EXISTS total_debt_source TEXT,
  ADD COLUMN IF NOT EXISTS net_cash NUMERIC;

CREATE INDEX IF NOT EXISTS idx_company_finder_net_cash
  ON company_finder_companies (net_cash DESC NULLS LAST);

COMMENT ON COLUMN company_finder_companies.total_debt IS
  'Single SEC XBRL Total Debt fact (DebtInstrumentCarryingAmount or label Total Debt). Never summed from multiple debt tags.';
COMMENT ON COLUMN company_finder_companies.net_cash IS
  'Cash − Total Debt when both available; NULL if Total Debt is missing.';
