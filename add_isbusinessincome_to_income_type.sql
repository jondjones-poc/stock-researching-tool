-- Add isbusinessincome column to income_type table
-- This column indicates whether an income type should be displayed on the Planning page

ALTER TABLE income_type 
ADD COLUMN IF NOT EXISTS isbusinessincome BOOLEAN DEFAULT FALSE;

-- Optional: Add a comment to document the column
COMMENT ON COLUMN income_type.isbusinessincome IS 'Indicates if this income type should be displayed on the Planning page';
