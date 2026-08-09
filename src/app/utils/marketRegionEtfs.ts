import { query } from './db';
import type { SectorRegionCode } from '../config/sectorRegions';

type RegionMarket = {
  id: number;
  index_symbol: string | null;
  index_is_proxy?: boolean;
};

/** Apply country/region ETF overrides onto sector markets (US uses markets.index_symbol). */
export async function applyRegionIndexSymbols<T extends RegionMarket>(
  markets: T[],
  region: SectorRegionCode
): Promise<T[]> {
  if (markets.length === 0) return markets;

  if (region === 'us') {
    return markets.map((m) => ({ ...m, index_is_proxy: false }));
  }

  const ids = markets.map((m) => m.id);
  try {
    const result = await query(
      `SELECT market_id, index_symbol, is_proxy
       FROM market_region_etfs
       WHERE region_code = $1 AND market_id = ANY($2::int[])`,
      [region, ids]
    );
    const byId = new Map<number, { index_symbol: string; is_proxy: boolean }>();
    for (const row of result.rows) {
      byId.set(Number(row.market_id), {
        index_symbol: String(row.index_symbol).toUpperCase(),
        is_proxy: Boolean(row.is_proxy),
      });
    }

    return markets.map((m) => {
      const override = byId.get(m.id);
      if (!override) return { ...m, index_is_proxy: false };
      return {
        ...m,
        index_symbol: override.index_symbol,
        index_is_proxy: override.is_proxy,
      };
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01' || err.message?.includes('market_region_etfs')) {
      throw Object.assign(
        new Error(
          'market_region_etfs missing — run node scripts/apply-market-region-etfs.mjs'
        ),
        { code: err.code }
      );
    }
    throw error;
  }
}
