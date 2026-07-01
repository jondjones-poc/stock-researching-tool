-- Portfolio stocks (all-time holdings). Watchlist remains in monthly_stocks.

CREATE TABLE IF NOT EXISTS portfolio_stocks (
  id SERIAL PRIMARY KEY,
  stock_id INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT portfolio_stocks_stock_id_fkey
    FOREIGN KEY (stock_id) REFERENCES stock_valuations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_portfolio_stocks_stock_id ON portfolio_stocks (stock_id);

COMMENT ON TABLE monthly_stocks IS 'Monthly watchlist — one entry per stock per month';
COMMENT ON TABLE portfolio_stocks IS 'All-time portfolio — stocks I own (one row per stock)';
