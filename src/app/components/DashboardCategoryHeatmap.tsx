'use client';

import {
  marketChangePctToColor,
  marketChangePctToTextColor,
} from '../utils/marketHeatColor';

export type HeatmapTile = {
  symbol: string;
  name: string;
  changePercent: number | null;
  marketCap?: number | null;
  /** Watchlist buy signal: true=below buy price, false=not, null=hide indicator */
  buySignal?: boolean | null;
};

function tileWeight(tile: HeatmapTile): number {
  const cap = tile.marketCap != null && Number.isFinite(tile.marketCap) ? tile.marketCap : 0;
  if (cap > 0) return Math.max(1.5, Math.log10(cap));
  const abs = tile.changePercent != null && Number.isFinite(tile.changePercent)
    ? Math.abs(tile.changePercent)
    : 0;
  return 1.5 + abs / 2;
}

function sortByPerformanceAsc(tiles: HeatmapTile[]): HeatmapTile[] {
  return [...tiles].sort((a, b) => {
    const aChange = a.changePercent;
    const bChange = b.changePercent;
    if (aChange == null && bChange == null) return 0;
    if (aChange == null) return 1;
    if (bChange == null) return -1;
    return aChange - bChange;
  });
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

export default function DashboardCategoryHeatmap({
  tiles,
  onSelect,
}: {
  tiles: HeatmapTile[];
  onSelect: (symbol: string) => void;
}) {
  const sorted = sortByPerformanceAsc(tiles);

  return (
    <div className="flex flex-wrap gap-px overflow-hidden rounded-lg bg-black">
      {sorted.map((tile) => {
        const weight = tileWeight(tile);
        const backgroundColor =
          tile.changePercent == null ? '#4b5563' : marketChangePctToColor(tile.changePercent);
        const textColor =
          tile.changePercent == null ? '#ffffff' : marketChangePctToTextColor(tile.changePercent);
        return (
          <button
            key={tile.symbol}
            type="button"
            onClick={() => onSelect(tile.symbol)}
            title={`${tile.name} · ${formatPct(tile.changePercent)}${
              tile.buySignal == null
                ? ''
                : tile.buySignal
                  ? ' · Buy (below buy price)'
                  : ' · Hold (at/above buy price)'
            }`}
            className="relative flex min-h-[4.25rem] min-w-[4.75rem] flex-col items-center justify-center px-1.5 py-1.5 text-center transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/70 focus:ring-inset"
            style={{
              flexGrow: weight,
              flexBasis: `${Math.min(240, 56 + weight * 14)}px`,
              backgroundColor,
              color: textColor,
            }}
          >
            {tile.buySignal != null ? (
              <span
                className={`absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-sm text-[10px] font-bold leading-none ${
                  tile.buySignal
                    ? 'bg-emerald-500/95 text-white'
                    : 'bg-red-500/95 text-white'
                }`}
                aria-label={tile.buySignal ? 'Buy' : 'Do not buy'}
              >
                {tile.buySignal ? '✓' : '✗'}
              </span>
            ) : null}
            <span className="max-w-full truncate text-xs font-bold leading-tight sm:text-sm">
              {tile.symbol}
            </span>
            <span className="mt-0.5 text-[11px] font-semibold tabular-nums leading-tight sm:text-xs">
              {formatPct(tile.changePercent)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
