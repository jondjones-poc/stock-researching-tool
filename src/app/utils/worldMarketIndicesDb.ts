import { query } from './db';
import {
  WORLD_MARKET_REGIONS,
  type WorldMarketRegionConfig,
  type WorldMarketDataSource,
} from '../config/worldMarkets';

interface WorldMarketIndexRow {
  id: number;
  slug: string;
  name: string;
  index_name: string;
  symbol: string;
  data_source: string;
  fred_series_id: string | null;
  lat: number;
  lng: number;
  country_codes: string[];
  icon: string;
  note: string | null;
  display_order: number;
  is_active: boolean;
}

function rowToConfig(row: WorldMarketIndexRow): WorldMarketRegionConfig {
  return {
    id: row.slug,
    name: row.name,
    indexName: row.index_name,
    symbol: row.symbol,
    dataSource: row.data_source as WorldMarketDataSource,
    fredSeriesId: row.fred_series_id ?? undefined,
    lat: Number(row.lat),
    lng: Number(row.lng),
    countryCodes: row.country_codes ?? [],
    icon: row.icon || '📊',
    note: row.note ?? undefined,
  };
}

export async function loadWorldMarketIndicesFromDb(): Promise<WorldMarketRegionConfig[]> {
  try {
    const result = await query(
      `SELECT id, slug, name, index_name, symbol, data_source, fred_series_id,
              lat, lng, country_codes, icon, note, display_order, is_active
       FROM world_market_indices
       WHERE is_active = true
       ORDER BY display_order, name`
    );

    if (result.rows.length === 0) {
      return WORLD_MARKET_REGIONS;
    }

    return result.rows.map((row) => rowToConfig(row as WorldMarketIndexRow));
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      console.warn('[world_market_indices] Table missing — using config fallback');
      return WORLD_MARKET_REGIONS;
    }
    console.error('[world_market_indices] Load failed:', err.message);
    return WORLD_MARKET_REGIONS;
  }
}

export function slugifyRegionName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export async function insertWorldMarketIndex(input: {
  name: string;
  indexName: string;
  symbol: string;
  dataSource: WorldMarketDataSource;
  fredSeriesId?: string | null;
  lat: number;
  lng: number;
  countryCodes: string[];
  icon?: string;
  note?: string | null;
}): Promise<WorldMarketRegionConfig> {
  const slug = slugifyRegionName(input.name);
  if (!slug) {
    throw new Error('Region name must contain letters or numbers');
  }

  const orderResult = await query(
    'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM world_market_indices'
  );
  const displayOrder = Number(orderResult.rows[0]?.next_order ?? 1);

  const result = await query(
    `INSERT INTO world_market_indices
       (slug, name, index_name, symbol, data_source, fred_series_id,
        lat, lng, country_codes, icon, note, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
     RETURNING id, slug, name, index_name, symbol, data_source, fred_series_id,
               lat, lng, country_codes, icon, note, display_order, is_active`,
    [
      slug,
      input.name.trim(),
      input.indexName.trim(),
      input.symbol.trim(),
      input.dataSource,
      input.fredSeriesId?.trim() || null,
      input.lat,
      input.lng,
      input.countryCodes,
      input.icon?.trim() || '📊',
      input.note?.trim() || null,
      displayOrder,
    ]
  );

  return rowToConfig(result.rows[0] as WorldMarketIndexRow);
}

export async function deleteWorldMarketIndex(slug: string): Promise<boolean> {
  const result = await query(
    'UPDATE world_market_indices SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE slug = $1 RETURNING slug',
    [slug]
  );
  return result.rows.length > 0;
}
