-- Add hexcolour column to income_type table
ALTER TABLE income_type 
ADD COLUMN IF NOT EXISTS hexcolour VARCHAR(7);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN income_type.hexcolour IS 'Hex color code (with or without #) for displaying income type rows';
