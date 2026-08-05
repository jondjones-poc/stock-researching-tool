-- Company Finder: US-listed cash/OCF vs market-cap screen (daily SEC + quote cache).

CREATE TABLE IF NOT EXISTS company_finder_runs (
  id BIGSERIAL PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'error', 'partial')),
  mode TEXT NOT NULL DEFAULT 'daily',
  cursor_offset INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  upserted INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  candidates INT NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS company_finder_companies (
  ticker TEXT PRIMARY KEY,
  cik TEXT NOT NULL,
  name TEXT,
  exchange TEXT,
  price NUMERIC,
  shares_outstanding NUMERIC,
  market_cap NUMERIC,
  cash NUMERIC,
  cash_as_of DATE,
  ocf_ytd NUMERIC,
  ocf_as_of DATE,
  ocf_period TEXT,
  -- market_cap - cash - ocf_ytd (negative => cash+OCF cover the equity value)
  score NUMERIC,
  ocf_per_week NUMERIC,
  est_per_share_per_week NUMERIC,
  weekly_ocf_yield_pct NUMERIC,
  data_quality TEXT NOT NULL DEFAULT 'partial'
    CHECK (data_quality IN ('ok', 'partial', 'missing')),
  error_message TEXT,
  facts_fetched_at TIMESTAMPTZ,
  quote_fetched_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_finder_score
  ON company_finder_companies (score ASC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_company_finder_market_cap
  ON company_finder_companies (market_cap DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_company_finder_candidates
  ON company_finder_companies (score)
  WHERE score < 0 AND market_cap IS NOT NULL AND cash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_company_finder_updated
  ON company_finder_companies (updated_at DESC);

COMMENT ON TABLE company_finder_companies IS
  'US-listed company snapshots for Research Company Finder (SEC facts + quotes).';

COMMENT ON COLUMN company_finder_companies.score IS
  'market_cap - cash - ocf_ytd; negative means cash + YTD OCF exceed market cap.';
