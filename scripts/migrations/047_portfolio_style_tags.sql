-- Style tags for live eToro holdings on the dashboard (Growth / Dividend & Value / future buckets).

CREATE TABLE IF NOT EXISTS public.portfolio_style_categories (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.portfolio_style_categories (slug, label, sort_order) VALUES
  ('GROWTH', 'Growth', 1),
  ('DIVIDEND & VALUE', 'Dividend & Value', 2)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.portfolio_style_tags (
  symbol TEXT PRIMARY KEY,
  category_slug TEXT NOT NULL
    REFERENCES public.portfolio_style_categories(slug)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_portfolio_style_tags_category
  ON public.portfolio_style_tags (category_slug);

COMMENT ON TABLE public.portfolio_style_categories IS
  'Dashboard style buckets for eToro holdings (extensible beyond Growth / Dividend & Value).';
COMMENT ON TABLE public.portfolio_style_tags IS
  'Persists Growth / Dividend & Value (etc.) tags by ticker; holdings themselves stay live from eToro.';
