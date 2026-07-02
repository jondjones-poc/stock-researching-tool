/** Bidirectional links between eToro tickers and portfolio research symbols. */
export type ResearchSymbolLinks = Map<string, Set<string>>;

/** Normalize ticker for matching (strip exchange suffix). */
export function baseSymbolMatchKeys(symbol: string): string[] {
  const upper = symbol.trim().toUpperCase();
  if (!upper || upper.startsWith('INSTRUMENT_')) return [];
  const base = upper.split('.')[0];
  return base !== upper ? [upper, base] : [upper];
}

export function symbolMatchKeys(symbol: string, links?: ResearchSymbolLinks): string[] {
  const keys = new Set(baseSymbolMatchKeys(symbol));
  const base = symbol.trim().toUpperCase().split('.')[0];
  const linked = links?.get(base);
  if (linked) {
    for (const alias of linked) keys.add(alias);
  }
  return [...keys];
}

export function symbolsMatch(a: string, b: string, links?: ResearchSymbolLinks): boolean {
  const keysA = new Set(symbolMatchKeys(a, links));
  const keysB = symbolMatchKeys(b, links);
  return keysB.some((key) => keysA.has(key));
}

/** Build links map from API JSON payload. */
export function deserializeResearchSymbolLinks(data: Record<string, string[]>): ResearchSymbolLinks {
  const links: ResearchSymbolLinks = new Map();
  for (const [key, values] of Object.entries(data)) {
    const normalized = key.trim().toUpperCase();
    if (!normalized) continue;
    links.set(normalized, new Set(values.map((v) => v.trim().toUpperCase()).filter(Boolean)));
  }
  return links;
}
