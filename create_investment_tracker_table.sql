-- Create investment_tracker table
CREATE TABLE IF NOT EXISTS investment_tracker (
    id SERIAL PRIMARY KEY,
    month VARCHAR(50) NOT NULL,
    description VARCHAR(500),
    invested DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_investment_tracker_month ON investment_tracker(month);

-- Add comments to document the table
COMMENT ON TABLE investment_tracker IS 'Tracks investment entries by month';
COMMENT ON COLUMN investment_tracker.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN investment_tracker.month IS 'Month identifier (e.g., "2024-01" or month name)';
COMMENT ON COLUMN investment_tracker.description IS 'Description of the investment';
COMMENT ON COLUMN investment_tracker.invested IS 'Amount invested in this entry';
