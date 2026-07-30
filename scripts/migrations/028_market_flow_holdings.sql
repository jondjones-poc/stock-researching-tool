-- Top holdings cache for market-flow ETFs (refreshed ~weekly)

ALTER TABLE market_flow_fund_meta
  ADD COLUMN IF NOT EXISTS holdings_fetched_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS market_flow_holdings (
  fund_id INT NOT NULL REFERENCES market_flow_funds(id) ON DELETE CASCADE,
  holding_symbol TEXT NOT NULL,
  holding_name TEXT NOT NULL DEFAULT '',
  weight_pct NUMERIC(10, 4),
  rank_no INT NOT NULL DEFAULT 0,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (fund_id, holding_symbol)
);

CREATE INDEX IF NOT EXISTS idx_market_flow_holdings_fund_rank
  ON market_flow_holdings(fund_id, rank_no ASC);

COMMENT ON TABLE market_flow_holdings IS
  'Cached top ETF holdings for Market Flow Tracker Ask AI / card insight';
