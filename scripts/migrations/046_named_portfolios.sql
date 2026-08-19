-- Named portfolios so /stocks/portfolio can have multiple books.
-- Existing portfolio_stocks rows become the default "My Portfolio".

CREATE TABLE IF NOT EXISTS public.portfolios (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.portfolios (slug, name, sort_order, is_default) VALUES
  ('main', 'My Portfolio', 0, TRUE),
  ('contrarian', 'The Contrarian Portfolio', 1, FALSE)
ON CONFLICT (slug) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolios_one_default
  ON public.portfolios (is_default)
  WHERE is_default;

ALTER TABLE public.portfolio_stocks
  ADD COLUMN IF NOT EXISTS portfolio_id INTEGER NULL
  REFERENCES public.portfolios(id) ON DELETE CASCADE;

UPDATE public.portfolio_stocks
SET portfolio_id = (SELECT id FROM public.portfolios WHERE slug = 'main' LIMIT 1)
WHERE portfolio_id IS NULL;

ALTER TABLE public.portfolio_stocks
  ALTER COLUMN portfolio_id SET NOT NULL;

ALTER TABLE public.portfolio_stocks
  DROP CONSTRAINT IF EXISTS portfolio_stocks_stock_id_key;

ALTER TABLE public.portfolio_stocks
  DROP CONSTRAINT IF EXISTS portfolio_stocks_stock_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_stocks_portfolio_stock
  ON public.portfolio_stocks (portfolio_id, stock_id);

CREATE INDEX IF NOT EXISTS idx_portfolio_stocks_portfolio_id
  ON public.portfolio_stocks (portfolio_id);

COMMENT ON TABLE public.portfolios IS
  'Named stock lists shown as tabs on /stocks/portfolio. Add a row here to create a new book.';
COMMENT ON TABLE public.portfolio_stocks IS
  'Holdings per named portfolio. Unique per (portfolio_id, stock_id).';
