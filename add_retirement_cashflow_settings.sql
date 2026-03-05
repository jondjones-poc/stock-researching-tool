-- SQL script to add retirement-by-cashflow editable inputs as settings
-- This script adds the settings keys to the settings table
-- Note: This script only adds the keys if they don't exist (using INSERT ... ON CONFLICT DO NOTHING)

-- Retirement by Cashflow settings
INSERT INTO settings (key, value) VALUES ('retirement_required_cashflow', '5000')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_cashflow_increase', '5')
ON CONFLICT (key) DO NOTHING;
