-- Sector + country for Deep Value Stocks filters (Finnhub profile / SEC submissions).
ALTER TABLE company_finder_companies
  ADD COLUMN IF NOT EXISTS sector TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT;

CREATE INDEX IF NOT EXISTS idx_company_finder_sector
  ON company_finder_companies (sector);

CREATE INDEX IF NOT EXISTS idx_company_finder_country
  ON company_finder_companies (country);

COMMENT ON COLUMN company_finder_companies.sector IS
  'Industry/sector label (prefer Finnhub finnhubIndustry; else SEC SIC description).';
COMMENT ON COLUMN company_finder_companies.country IS
  'ISO-style country code when available (e.g. US, IL); from Finnhub or SEC address.';
