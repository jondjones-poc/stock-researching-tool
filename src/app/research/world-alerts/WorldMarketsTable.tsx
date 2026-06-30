'use client';

import {
  type WorldMarketPeriod,
  type WorldMarketRegionResult,
  returnColor,
  returnGradeStyle,
  statusLabel,
} from '../../config/worldMarkets';

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatLevel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface WorldMarketsTableProps {
  regions: WorldMarketRegionResult[];
  period: WorldMarketPeriod;
  loading: boolean;
}

export default function WorldMarketsTable({ regions, period, loading }: WorldMarketsTableProps) {
  const sorted = [...regions].sort((a, b) => (b.changePercent ?? -999) - (a.changePercent ?? -999));

  return (
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-900/60 border-b border-gray-200 dark:border-gray-700">
              <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Region
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Index
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Return
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                Level
              </th>
              <th className="text-left px-4 sm:px-6 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                As of
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading && sorted.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={6} className="px-6 py-4">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-md" />
                  </td>
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                  No market data available for this period.
                </td>
              </tr>
            ) : (
              sorted.map((region, index) => (
                <tr
                  key={region.id}
                  className={`transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/40 ${
                    index % 2 === 1 ? 'bg-gray-50/60 dark:bg-gray-900/20' : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <td className="px-4 sm:px-6 py-3.5 whitespace-nowrap">
                    <span className="font-medium text-gray-900 dark:text-white">
                      <span className="mr-2" aria-hidden>
                        {region.icon}
                      </span>
                      {region.name}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-700 dark:text-gray-300">{region.indexName}</td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums font-mono">
                    <span style={{ color: returnColor(region.changePercent, period) }}>
                      {formatPct(region.changePercent)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
                      style={returnGradeStyle(region.changePercent, period)}
                    >
                      {statusLabel(region.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums font-mono text-gray-900 dark:text-gray-100">
                    {formatLevel(region.price)}
                  </td>
                  <td className="px-4 sm:px-6 py-3.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {region.asOfDate ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
