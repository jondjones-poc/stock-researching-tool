-- Add earnings columns to stock_valuations table
-- This allows storing earnings data to reduce API calls to API Ninjas

ALTER TABLE stock_valuations
ADD COLUMN IF NOT EXISTS next_earnings_date DATE,
ADD COLUMN IF NOT EXISTS next_earnings_eps_estimate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS next_earnings_revenue_estimate DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS next_earnings_quarter VARCHAR(10),
ADD COLUMN IF NOT EXISTS next_earnings_year INTEGER,
ADD COLUMN IF NOT EXISTS earnings_data_updated_at TIMESTAMP;

-- Create index on next_earnings_date for faster queries
CREATE INDEX IF NOT EXISTS idx_stock_valuations_next_earnings_date ON stock_valuations (next_earnings_date);

-- Add comment to explain the columns
COMMENT ON COLUMN stock_valuations.next_earnings_date IS 'Date of the next earnings announcement';
COMMENT ON COLUMN stock_valuations.next_earnings_eps_estimate IS 'Estimated EPS for the next earnings report';
COMMENT ON COLUMN stock_valuations.next_earnings_revenue_estimate IS 'Estimated revenue for the next earnings report (in dollars)';
COMMENT ON COLUMN stock_valuations.next_earnings_quarter IS 'Quarter of the next earnings (e.g., Q1, Q2, Q3, Q4)';
COMMENT ON COLUMN stock_valuations.next_earnings_year IS 'Year of the next earnings';
COMMENT ON COLUMN stock_valuations.earnings_data_updated_at IS 'Timestamp when earnings data was last updated from API';
