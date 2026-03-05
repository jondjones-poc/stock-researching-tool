-- SQL script to add retirement-by-target-pot editable inputs as settings
-- This script adds the settings keys to the settings table
-- Note: This script only adds the keys if they don't exist (using INSERT ... ON CONFLICT DO NOTHING)

-- Retirement Target Pot settings
INSERT INTO settings (key, value) VALUES ('retirement_target_pot', '2000000')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_return_rate', '7')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_withdrawal_rate', '4')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_inflation', '3')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_tax', '20')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_current_age', '44')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_age', '68')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_state_pension_weekly', '221.20')
ON CONFLICT (key) DO NOTHING;

INSERT INTO settings (key, value) VALUES ('retirement_death_age', '85')
ON CONFLICT (key) DO NOTHING;

-- Retirement Cashflow settings (from Retirement by Cashflow tab)
INSERT INTO settings (key, value) VALUES ('retirement_required_cashflow', '5000')
ON CONFLICT (key) DO NOTHING;

-- Retirement Summary settings (from Summary tab)
INSERT INTO settings (key, value) VALUES ('retirement_cashflow_increase', '5')
ON CONFLICT (key) DO NOTHING;
