export const CACHE_REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;
export const CACHE_STALE_WARN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

export interface CacheStatus {
  cacheStale: boolean;
  oldestFetchedAt: string | null;
  /** True when any symbol is missing or older than 24h for this period. */
  liveAvailable: boolean;
}

export function computeCacheStatus(
  symbols: string[],
  meta: Map<string, Date>
): CacheStatus {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  if (unique.length === 0) {
    return { cacheStale: false, oldestFetchedAt: null, liveAvailable: false };
  }

  let oldest: Date | null = null;
  let cacheStale = false;
  const warnCutoff = Date.now() - CACHE_STALE_WARN_AFTER_MS;

  for (const s of unique) {
    const fetched = meta.get(s);
    if (!fetched) {
      cacheStale = true;
      continue;
    }
    if (!oldest || fetched < oldest) oldest = fetched;
    if (fetched.getTime() < warnCutoff) cacheStale = true;
  }

  return {
    cacheStale,
    oldestFetchedAt: oldest?.toISOString() ?? null,
    liveAvailable: symbolsNeedingRefresh(unique, meta).length > 0,
  };
}

export function symbolsNeedingRefresh(
  symbols: string[],
  meta: Map<string, Date>
): string[] {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const cutoff = Date.now() - CACHE_REFRESH_AFTER_MS;
  return unique.filter((s) => {
    const fetched = meta.get(s);
    return !fetched || fetched.getTime() < cutoff;
  });
}
