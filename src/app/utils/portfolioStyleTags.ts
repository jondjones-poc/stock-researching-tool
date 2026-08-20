import { query } from './db';
import { DEFAULT_PORTFOLIO_STYLE_CATEGORIES } from '../config/dashboard';

export type PortfolioStyleCategory = {
  slug: string;
  label: string;
  sort_order: number;
};

function migrationHint(): Record<string, string> {
  return { hint: 'Run node scripts/apply-portfolio-style-tags.mjs' };
}

export function isMissingStyleTagsTable(error: unknown): boolean {
  const err = error as { code?: string };
  return err.code === '42P01';
}

export async function loadPortfolioStyleCategories(): Promise<PortfolioStyleCategory[]> {
  try {
    const result = await query(
      `SELECT slug, label, sort_order
       FROM portfolio_style_categories
       ORDER BY sort_order ASC, slug ASC`
    );
    if (result.rows.length === 0) {
      return DEFAULT_PORTFOLIO_STYLE_CATEGORIES.map((item) => ({ ...item }));
    }
    return result.rows.map((row) => ({
      slug: String(row.slug),
      label: String(row.label),
      sort_order: Number(row.sort_order) || 0,
    }));
  } catch (error) {
    if (isMissingStyleTagsTable(error)) {
      return DEFAULT_PORTFOLIO_STYLE_CATEGORIES.map((item) => ({ ...item }));
    }
    throw error;
  }
}

export async function loadPortfolioStyleTags(): Promise<Record<string, string>> {
  try {
    const result = await query(
      `SELECT symbol, category_slug FROM portfolio_style_tags ORDER BY symbol ASC`
    );
    const tags: Record<string, string> = {};
    for (const row of result.rows) {
      const symbol = String(row.symbol || '').trim().toUpperCase();
      const category = String(row.category_slug || '').trim();
      if (symbol && category) tags[symbol] = category;
    }
    return tags;
  } catch (error) {
    if (isMissingStyleTagsTable(error)) return {};
    throw error;
  }
}

export async function upsertPortfolioStyleTag(
  symbol: string,
  categorySlug: string | null
): Promise<{ symbol: string; category: string | null }> {
  const normalized = symbol.trim().toUpperCase();
  if (!normalized) {
    throw new Error('symbol is required');
  }

  if (!categorySlug) {
    await query(`DELETE FROM portfolio_style_tags WHERE symbol = $1`, [normalized]);
    return { symbol: normalized, category: null };
  }

  const category = categorySlug.trim();
  const exists = await query(
    `SELECT slug FROM portfolio_style_categories WHERE slug = $1 LIMIT 1`,
    [category]
  );
  if (exists.rows.length === 0) {
    const err = new Error(`Unknown style category: ${category}`) as Error & {
      status?: number;
    };
    err.status = 400;
    throw err;
  }

  await query(
    `INSERT INTO portfolio_style_tags (symbol, category_slug, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (symbol) DO UPDATE SET
       category_slug = EXCLUDED.category_slug,
       updated_at = NOW()`,
    [normalized, category]
  );

  return { symbol: normalized, category };
}

export function styleTagsMigrationResponse(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} | null {
  if (!isMissingStyleTagsTable(error)) return null;
  return {
    status: 503,
    body: {
      error: 'portfolio_style_tags table does not exist',
      ...migrationHint(),
    },
  };
}
