-- Insert script to add current default values for retirement settings
-- This script will insert the defaults if the keys don't exist, or update them if they do

-- Retirement Target Pot: £2,000,000
INSERT INTO settings (key, value) 
VALUES ('retirement_target_pot', '2000000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Return Rate: 7%
INSERT INTO settings (key, value) 
VALUES ('retirement_return_rate', '7')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Withdrawal Rate: 4%
INSERT INTO settings (key, value) 
VALUES ('retirement_withdrawal_rate', '4')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Inflation Rate: 3%
INSERT INTO settings (key, value) 
VALUES ('retirement_inflation', '3')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Tax Rate: 20%
INSERT INTO settings (key, value) 
VALUES ('retirement_tax', '20')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Current Age: 44 years
INSERT INTO settings (key, value) 
VALUES ('retirement_current_age', '44')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Retirement Age: 68 years
INSERT INTO settings (key, value) 
VALUES ('retirement_age', '68')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- State Pension Weekly: £221.20
INSERT INTO settings (key, value) 
VALUES ('retirement_state_pension_weekly', '221.20')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Death Age: 85 years
INSERT INTO settings (key, value) 
VALUES ('retirement_death_age', '85')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Required Cashflow (Monthly): £5,000
INSERT INTO settings (key, value) 
VALUES ('retirement_required_cashflow', '5000')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;

-- Cashflow Increase: 5%
INSERT INTO settings (key, value) 
VALUES ('retirement_cashflow_increase', '5')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
