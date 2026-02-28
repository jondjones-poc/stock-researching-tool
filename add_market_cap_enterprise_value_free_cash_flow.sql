-- Add Market Cap, Enterprise Value, and Free Cash Flow columns to stock_valuations table
ALTER TABLE stock_valuations 
ADD COLUMN IF NOT EXISTS market_cap DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS enterprise_value DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS free_cash_flow DECIMAL(15, 2);

-- Add comments for documentation
COMMENT ON COLUMN stock_valuations.market_cap IS 'Market Capitalization in USD';
COMMENT ON COLUMN stock_valuations.enterprise_value IS 'Enterprise Value in USD';
COMMENT ON COLUMN stock_valuations.free_cash_flow IS 'Free Cash Flow (TTM) in USD';
