-- Insert script to add current default values for retirement by cashflow settings
-- This script will insert the defaults if the keys don't exist, or update them if they do

-- Required Monthly Cashflow: £5,000
INSERT INTO settings (key, value) 
VALUES ('retirement_required_cashflow', '5000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Cashflow Increase: 5%
INSERT INTO settings (key, value) 
VALUES ('retirement_cashflow_increase', '5')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
