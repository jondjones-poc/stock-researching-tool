-- Add Is247wage column to income_type table
-- This column indicates whether an income type should be displayed on the 24/7 Wage page

ALTER TABLE income_type 
ADD COLUMN IF NOT EXISTS Is247wage BOOLEAN DEFAULT FALSE;

-- Optional: Add a comment to document the column
COMMENT ON COLUMN income_type.Is247wage IS 'Indicates if this income type should be displayed on the 24/7 Wage page';
