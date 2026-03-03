-- Add account_id column to income_source table
-- This links each income source to a single account

-- Add the account_id column (nullable initially to allow existing data)
ALTER TABLE income_source 
ADD COLUMN account_id INTEGER;

-- Add foreign key constraint
ALTER TABLE income_source
ADD CONSTRAINT fk_income_source_account 
FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_income_source_account ON income_source(account_id);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN income_source.account_id IS 'Reference to the accounts table - each income source is tied to a single account';
