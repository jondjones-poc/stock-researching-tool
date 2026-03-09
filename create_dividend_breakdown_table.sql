-- Create dividend_breakdown table to store Dividend & FCF Analysis data
-- This table stores yearly financial data for stock analysis

CREATE TABLE IF NOT EXISTS dividend_breakdown (
    id SERIAL PRIMARY KEY,
    stock_symbol VARCHAR(10) NOT NULL,
    year INTEGER NOT NULL,
    free_cash_flow NUMERIC(18, 2) DEFAULT 0.00,
    dividends_paid NUMERIC(18, 2) DEFAULT 0.00,
    fcf_payout_ratio NUMERIC(10, 2) DEFAULT 0.00,
    adjusted_dividend NUMERIC(18, 2) DEFAULT 0.00,
    payout_ratio NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(stock_symbol, year)
);

-- Create index on stock_symbol for faster queries
CREATE INDEX IF NOT EXISTS idx_dividend_breakdown_symbol ON dividend_breakdown(stock_symbol);

-- Create index on year for faster queries
CREATE INDEX IF NOT EXISTS idx_dividend_breakdown_year ON dividend_breakdown(year);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_dividend_breakdown_symbol_year ON dividend_breakdown(stock_symbol, year);

-- Add comment to table
COMMENT ON TABLE dividend_breakdown IS 'Stores yearly dividend and free cash flow analysis data for stocks';

-- Add comments to columns
COMMENT ON COLUMN dividend_breakdown.id IS 'Primary key';
COMMENT ON COLUMN dividend_breakdown.stock_symbol IS 'Stock ticker symbol (e.g., AAPL, NKE)';
COMMENT ON COLUMN dividend_breakdown.year IS 'Year of the financial data';
COMMENT ON COLUMN dividend_breakdown.free_cash_flow IS 'Free Cash Flow in dollars';
COMMENT ON COLUMN dividend_breakdown.dividends_paid IS 'Dividends Paid in dollars';
COMMENT ON COLUMN dividend_breakdown.fcf_payout_ratio IS 'FCF Payout Ratio as percentage';
COMMENT ON COLUMN dividend_breakdown.adjusted_dividend IS 'Adjusted Dividend in dollars';
COMMENT ON COLUMN dividend_breakdown.payout_ratio IS 'Payout Ratio as percentage';
COMMENT ON COLUMN dividend_breakdown.created_at IS 'Timestamp when record was created';
COMMENT ON COLUMN dividend_breakdown.updated_at IS 'Timestamp when record was last updated';
