-- Cached FX rates (e.g. USD→GBP from Frankfurter / ECB reference data).
-- Refreshed at most once per 24h by the app to avoid rate-limiting external APIs.

CREATE TABLE IF NOT EXISTS fx_rate_cache (
  base_currency TEXT NOT NULL,
  quote_currency TEXT NOT NULL,
  rate NUMERIC(18, 8) NOT NULL,
  rate_date DATE NULL,
  source TEXT NOT NULL DEFAULT 'frankfurter',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (base_currency, quote_currency)
);

COMMENT ON TABLE fx_rate_cache IS 'Cached foreign-exchange rates for display conversion';
