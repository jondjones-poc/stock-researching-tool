import { isActiveSavedEtoroStock, MIN_ACTIVE_ETORO_UNITS } from './etoroPositionFilter';
import { isUsableEtoroTicker } from './etoroTicker';
import { symbolsMatch, type ResearchSymbolLinks } from './symbolMatch';

export { symbolMatchKeys, symbolsMatch } from './symbolMatch';

export interface MissingEtoroHolding {
  displayLabel: string;
  ticker: string | null;
  instrumentId?: number;
  positionId?: number;
  sharesOwned: number;
}

function isUsableTicker(ticker: string | null | undefined): boolean {
  return isUsableEtoroTicker(ticker);
}

export function formatEtoroHoldingLabel(stock: {
  ticker?: string | null;
  instrumentId?: number;
  positionId?: number;
}): string {
  if (isUsableTicker(stock.ticker)) {
    return stock.ticker!.trim().toUpperCase();
  }

  const parts: string[] = [];
  if (stock.instrumentId != null) parts.push(`Instrument ${stock.instrumentId}`);
  if (stock.positionId != null) parts.push(`Position ${stock.positionId}`);
  return parts.length > 0 ? parts.join(' · ') : 'Unidentified holding';
}

export function findEtoroHoldingsMissingFromPortfolio(
  etoroStocks: Array<{
    ticker?: string | null;
    instrumentId?: number;
    positionId?: number;
    sharesOwned?: number;
    isDetached?: boolean;
  }>,
  portfolioSymbols: string[],
  symbolLinks?: ResearchSymbolLinks
): MissingEtoroHolding[] {
  const missing: MissingEtoroHolding[] = [];
  const seen = new Set<string>();

  for (const stock of etoroStocks) {
    if (!isActiveSavedEtoroStock(stock)) continue;

    const shares = Number(stock.sharesOwned) || 0;
    const ticker = stock.ticker?.trim() ?? '';
    const hasSymbol = isUsableTicker(ticker);

    if (hasSymbol && portfolioSymbols.some((ps) => symbolsMatch(ticker, ps, symbolLinks))) {
      continue;
    }

    const displayLabel = formatEtoroHoldingLabel(stock);
    const key = `${stock.positionId ?? ''}:${stock.instrumentId ?? ''}:${displayLabel}`;
    if (seen.has(key)) continue;
    seen.add(key);

    missing.push({
      displayLabel,
      ticker: hasSymbol ? ticker.toUpperCase() : null,
      instrumentId: stock.instrumentId,
      positionId: stock.positionId,
      sharesOwned: shares,
    });
  }

  return missing.sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
}

export { MIN_ACTIVE_ETORO_UNITS };
