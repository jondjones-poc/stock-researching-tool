-- Table to store DDM (Dividend Discount Model) data
-- Stores all inputs and dividend history data needed for DDM calculations
-- This avoids hitting Alpha Vantage rate limits by caching the data

CREATE TABLE IF NOT EXISTS ddm_data (
    id SERIAL PRIMARY KEY,
    symbol VARCHAR(10) NOT NULL UNIQUE,
    
    -- DDM Input Parameters (required)
    wacc DECIMAL(5, 2) NOT NULL DEFAULT 8.5, -- Weighted Average Cost of Capital (%)
    margin_of_safety DECIMAL(5, 2) NOT NULL DEFAULT 20.0, -- Margin of Safety (%)
    high_growth_years INTEGER NOT NULL DEFAULT 5, -- Number of high growth years
    stable_growth_rate DECIMAL(5, 2) NOT NULL DEFAULT 3.0, -- Stable growth rate after high growth period (%)
    current_price DECIMAL(10, 2), -- Current stock price
    
    -- Dividend History Data (from Alpha Vantage or manual entry)
    dividends_by_year JSONB, -- { "2020": 1.01, "2021": 1.13, ... } - Annual aggregated dividends
    historical_dividends JSONB, -- Array of {date, dividend, adjustedDividend} - Full dividend history
    dividend_growth_rate DECIMAL(10, 6), -- Calculated dividend growth rate
    latest_dividend DECIMAL(10, 4), -- Most recent dividend amount
    current_year_projected BOOLEAN DEFAULT FALSE, -- Whether current year dividend is projected
    
    -- Dividend Projections (calculated from historical data)
    dividend_projections JSONB, -- Array of {year, dividend, growthRate} for DDM calculations
    
    -- Calculated DDM Results (optional - can be recalculated)
    intrinsic_value DECIMAL(10, 2), -- Calculated intrinsic value
    ddm_with_safety DECIMAL(10, 2), -- Intrinsic value with margin of safety applied
    terminal_value DECIMAL(10, 2), -- Terminal value from DDM calculation
    
    -- Metadata
    data_source VARCHAR(50) DEFAULT 'ALPHA_VANTAGE',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_wacc CHECK (wacc >= 0 AND wacc <= 100),
    CONSTRAINT valid_margin_of_safety CHECK (margin_of_safety >= 0 AND margin_of_safety <= 100),
    CONSTRAINT valid_high_growth_years CHECK (high_growth_years >= 0 AND high_growth_years <= 20),
    CONSTRAINT valid_stable_growth_rate CHECK (stable_growth_rate >= 0 AND stable_growth_rate <= 100),
    CONSTRAINT valid_current_price CHECK (current_price IS NULL OR current_price >= 0)
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_ddm_data_symbol ON ddm_data (symbol);
CREATE INDEX IF NOT EXISTS idx_ddm_data_last_updated ON ddm_data (last_updated);

-- Trigger to update 'last_updated' timestamp
CREATE OR REPLACE FUNCTION update_ddm_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER update_ddm_data_updated_at
BEFORE UPDATE ON ddm_data
FOR EACH ROW
EXECUTE FUNCTION update_ddm_data_updated_at();

-- Add comments
COMMENT ON TABLE ddm_data IS 'Stores DDM (Dividend Discount Model) inputs and dividend history data to avoid API rate limits';
COMMENT ON COLUMN ddm_data.wacc IS 'Weighted Average Cost of Capital - required for DDM calculations';
COMMENT ON COLUMN ddm_data.margin_of_safety IS 'Margin of Safety percentage - required for DDM calculations';
COMMENT ON COLUMN ddm_data.high_growth_years IS 'Number of years for high growth phase - required for DDM calculations';
COMMENT ON COLUMN ddm_data.stable_growth_rate IS 'Stable growth rate after high growth period - required for DDM calculations';
COMMENT ON COLUMN ddm_data.dividends_by_year IS 'JSON object with year as key and total annual dividend as value';
COMMENT ON COLUMN ddm_data.historical_dividends IS 'JSON array of all dividend payments with date, dividend, and adjustedDividend';
COMMENT ON COLUMN ddm_data.dividend_projections IS 'JSON array of {year, dividend, growthRate} for DDM calculations';
