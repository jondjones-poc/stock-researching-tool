-- Extend market flow return periods to include 3y / 5y / 10y

ALTER TABLE market_flow_returns
  DROP CONSTRAINT IF EXISTS market_flow_returns_period_check;

ALTER TABLE market_flow_returns
  ADD CONSTRAINT market_flow_returns_period_check
  CHECK (period IN ('1w', '1m', '3m', '6m', '1y', '3y', '5y', '10y'));

COMMENT ON CONSTRAINT market_flow_returns_period_check ON market_flow_returns IS
  'Supported lookback periods for market flow returns';
