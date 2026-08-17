-- Monthly salary history for Freedom Income (single-tenant household).
-- Prefer calculating Freedom Income from source income tables; this stores
-- declared salary only so independence metrics can exclude it cleanly.

CREATE TABLE IF NOT EXISTS public.salary_history (
  id SERIAL PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  monthly_salary NUMERIC(14, 2) NOT NULL CHECK (monthly_salary >= 0),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (year, month)
);

CREATE INDEX IF NOT EXISTS idx_salary_history_year_month
  ON public.salary_history (year DESC, month DESC);

COMMENT ON TABLE public.salary_history IS
  'Declared monthly salary by calendar month for Freedom Income / salary growth reporting';

CREATE OR REPLACE FUNCTION public.set_salary_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_history_updated_at ON public.salary_history;
CREATE TRIGGER trg_salary_history_updated_at
  BEFORE UPDATE ON public.salary_history
  FOR EACH ROW
  EXECUTE FUNCTION public.set_salary_history_updated_at();
