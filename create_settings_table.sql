-- Create settings table for storing key-value pairs
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(255) NOT NULL UNIQUE,
    value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create an index on the key column for faster lookups
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Add a comment to document the table
COMMENT ON TABLE settings IS 'Stores application settings as key-value pairs';
COMMENT ON COLUMN settings.key IS 'Unique setting key identifier';
COMMENT ON COLUMN settings.value IS 'Setting value (can store JSON, text, or other data types)';
