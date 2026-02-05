-- Create monthly_stocks table
CREATE TABLE IF NOT EXISTS monthly_stocks (
    id SERIAL PRIMARY KEY,
    stock_id INTEGER NOT NULL,
    investment_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_stock_valuation
        FOREIGN KEY(stock_id)
        REFERENCES stock_valuations(id)
        ON DELETE CASCADE
);

-- Create index on stock_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_monthly_stocks_stock_id ON monthly_stocks (stock_id);

-- Create index on investment_date for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_monthly_stocks_investment_date ON monthly_stocks (investment_date);
