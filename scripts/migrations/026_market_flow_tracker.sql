-- Global Market Flow Tracker
-- Tracks large-cap vs small-cap ETF price momentum across ten markets.
-- Dashboard reads from these tables; market API is only used by the daily update job.

CREATE TABLE IF NOT EXISTS market_flow_markets (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  region TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS market_flow_funds (
  id SERIAL PRIMARY KEY,
  market_id INT NOT NULL REFERENCES market_flow_markets(id) ON DELETE CASCADE,
  cap_type TEXT NOT NULL CHECK (cap_type IN ('large', 'small')),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (market_id, cap_type),
  UNIQUE (symbol)
);

CREATE INDEX IF NOT EXISTS idx_market_flow_funds_market ON market_flow_funds(market_id);
CREATE INDEX IF NOT EXISTS idx_market_flow_funds_symbol ON market_flow_funds(symbol);

CREATE TABLE IF NOT EXISTS market_flow_prices (
  fund_id INT NOT NULL REFERENCES market_flow_funds(id) ON DELETE CASCADE,
  price_date DATE NOT NULL,
  close NUMERIC(18, 6) NOT NULL,
  PRIMARY KEY (fund_id, price_date)
);

CREATE INDEX IF NOT EXISTS idx_market_flow_prices_date ON market_flow_prices(price_date);

CREATE TABLE IF NOT EXISTS market_flow_fund_meta (
  fund_id INT PRIMARY KEY REFERENCES market_flow_funds(id) ON DELETE CASCADE,
  last_fetched_at TIMESTAMPTZ,
  last_price_date DATE,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ok', 'error', 'stale'))
);

CREATE TABLE IF NOT EXISTS market_flow_returns (
  fund_id INT NOT NULL REFERENCES market_flow_funds(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('1w', '1m', '3m', '6m', '1y')),
  return_pct NUMERIC(12, 6),
  as_of_date DATE,
  start_date DATE,
  start_close NUMERIC(18, 6),
  end_close NUMERIC(18, 6),
  computed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fund_id, period)
);

CREATE TABLE IF NOT EXISTS market_flow_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TIMESTAMPTZ,
  mode TEXT NOT NULL CHECK (mode IN ('live', 'mock')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'partial', 'error')),
  funds_ok INT NOT NULL DEFAULT 0,
  funds_failed INT NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE market_flow_markets IS 'Ten global markets for large vs small-cap flow (momentum) tracking';
COMMENT ON TABLE market_flow_prices IS 'Daily close prices; unique per fund+date prevents duplicates';
COMMENT ON TABLE market_flow_returns IS 'Precomputed period returns so the dashboard never hits the market API';
