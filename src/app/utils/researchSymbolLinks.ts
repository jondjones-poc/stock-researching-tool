import { query } from './db';
import { isUsableEtoroTicker } from './etoroTicker';
import type { ResearchSymbolLinks } from './symbolMatch';

function baseTicker(symbol: string): string {
  return symbol.trim().toUpperCase().split('.')[0];
}

function linkPair(links: ResearchSymbolLinks, a: string, b: string): void {
  const left = baseTicker(a);
  const right = baseTicker(b);
  if (!left || !right || left === right) return;

  const leftSet = links.get(left) ?? new Set<string>();
  leftSet.add(right);
  links.set(left, leftSet);

  const rightSet = links.get(right) ?? new Set<string>();
  rightSet.add(left);
  links.set(right, rightSet);
}

let cachedLinks: ResearchSymbolLinks | null = null;
let cacheLoadedAt = 0;
const CACHE_MS = 60_000;

/** Load research_symbol links from stock_ticker_cache (cached 60s). */
export async function loadResearchSymbolLinks(force = false): Promise<ResearchSymbolLinks> {
  const now = Date.now();
  if (!force && cachedLinks && now - cacheLoadedAt < CACHE_MS) {
    return cachedLinks;
  }

  const links: ResearchSymbolLinks = new Map();

  try {
    const col = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'stock_ticker_cache' AND column_name = 'research_symbol'`
    );
    if (col.rows.length === 0) {
      cachedLinks = links;
      cacheLoadedAt = now;
      return links;
    }

    const result = await query(
      `SELECT symbol_full, research_symbol
       FROM stock_ticker_cache
       WHERE research_symbol IS NOT NULL AND TRIM(research_symbol) <> ''`
    );

    for (const row of result.rows) {
      const etoro = String(row.symbol_full ?? '');
      const research = String(row.research_symbol ?? '').trim().toUpperCase();
      if (!isUsableEtoroTicker(etoro) || !isUsableEtoroTicker(research)) continue;
      linkPair(links, etoro, research);
    }
  } catch {
    // table may not exist yet
  }

  cachedLinks = links;
  cacheLoadedAt = now;
  return links;
}

export function clearResearchSymbolLinksCache(): void {
  cachedLinks = null;
  cacheLoadedAt = 0;
}
