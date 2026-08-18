-- Allow multiple salary payments in the same calendar month.

ALTER TABLE public.salary_history
  DROP CONSTRAINT IF EXISTS salary_history_year_month_key;

COMMENT ON TABLE public.salary_history IS
  'Declared salary payments by calendar month (multiple rows per month allowed) for Freedom Income';
