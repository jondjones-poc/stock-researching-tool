-- Add new columns to stock_valuations table for Bear, Base, and Bull case prices
ALTER TABLE stock_valuations
ADD COLUMN IF NOT EXISTS bear_case_avg_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bear_case_low_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bear_case_high_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS base_case_avg_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS base_case_low_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS base_case_high_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bull_case_avg_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bull_case_low_price DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bull_case_high_price DECIMAL(10, 2);

-- Insert script for row with primary key id of 3
-- Note: This assumes the stock_valuations table already has a row with id=3
-- If you want to insert a new row with id=3, you may need to adjust the sequence or use a different approach
UPDATE stock_valuations
SET 
    bear_case_avg_price = 305.21,
    bear_case_low_price = 284.87,
    bear_case_high_price = 325.56,
    base_case_avg_price = 701.81,
    base_case_low_price = 633.01,
    base_case_high_price = 770.62,
    bull_case_avg_price = 813.42,
    bull_case_low_price = 739.48,
    bull_case_high_price = NULL  -- High Price value was not provided
WHERE id = 3;

-- Alternative: If you want to insert a completely new row with id=3
-- (Note: This will only work if id=3 doesn't exist and the sequence allows it)
-- You may need to adjust the sequence first: SELECT setval('stock_valuations_id_seq', 3, false);
-- Then use:
/*
INSERT INTO stock_valuations (
    stock,
    bear_case_avg_price,
    bear_case_low_price,
    bear_case_high_price,
    base_case_avg_price,
    base_case_low_price,
    base_case_high_price,
    bull_case_avg_price,
    bull_case_low_price,
    bull_case_high_price
) VALUES (
    'SYMBOL',  -- Replace with actual stock symbol
    305.21,
    284.87,
    325.56,
    701.81,
    633.01,
    770.62,
    813.42,
    739.48,
    NULL  -- High Price value was not provided
) ON CONFLICT (id) DO UPDATE SET
    bear_case_avg_price = EXCLUDED.bear_case_avg_price,
    bear_case_low_price = EXCLUDED.bear_case_low_price,
    bear_case_high_price = EXCLUDED.bear_case_high_price,
    base_case_avg_price = EXCLUDED.base_case_avg_price,
    base_case_low_price = EXCLUDED.base_case_low_price,
    base_case_high_price = EXCLUDED.base_case_high_price,
    bull_case_avg_price = EXCLUDED.bull_case_avg_price,
    bull_case_low_price = EXCLUDED.bull_case_low_price,
    bull_case_high_price = EXCLUDED.bull_case_high_price;
*/
