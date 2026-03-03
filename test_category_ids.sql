-- Test queries for category_ids column in investment_type table

-- 1. View all investment types with their category_ids
SELECT id, name, category_ids 
FROM investment_type 
ORDER BY id;

-- 2. Find investment types that have category 4
SELECT id, name, category_ids 
FROM investment_type 
WHERE category_ids @> '[4]'::jsonb;

-- 3. Get category details for investment type with category_ids
-- Replace 1 with the investment_type id you want to check
SELECT 
    it.id as investment_type_id,
    it.name as investment_type_name,
    it.category_ids,
    ic.id as category_id,
    ic.name as category_name,
    ic.category_date,
    ic.value
FROM investment_type it
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(it.category_ids, '[]'::jsonb)) AS cat_id
JOIN investment_categories ic ON ic.id = cat_id::int
WHERE it.id = 1;  -- Change this to the investment_type id you want to check

-- 4. Add another category (e.g., category 5) to an investment type
-- Replace 1 with the investment_type id
UPDATE investment_type 
SET category_ids = category_ids || '[5]'::jsonb
WHERE id = 1 
  AND NOT (category_ids @> '[5]'::jsonb)
RETURNING id, name, category_ids;

-- 5. Remove category 4 from an investment type
-- Replace 1 with the investment_type id
UPDATE investment_type 
SET category_ids = (
  SELECT jsonb_agg(elem::text::int)
  FROM jsonb_array_elements(category_ids) elem
  WHERE elem::text::int != 4
)
WHERE id = 1
RETURNING id, name, category_ids;
