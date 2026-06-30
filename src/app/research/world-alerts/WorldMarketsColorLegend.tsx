'use client';

import { gradeSpanForPeriod, returnColor, type WorldMarketPeriod } from '../../config/worldMarkets';

interface WorldMarketsColorLegendProps {
  period: WorldMarketPeriod;
}

export default function WorldMarketsColorLegend({ period }: WorldMarketsColorLegendProps) {
  const span = gradeSpanForPeriod(period);
  const samples = [
    -span,
    -span * 0.5,
    -span * 0.15,
    0,
    span * 0.15,
    span * 0.5,
    span,
  ];

  return (
    <div className="mb-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
        Return colour scale (±{span}% ≈ full range for this period)
      </p>
      <div className="flex items-center gap-1">
        {samples.map((pct) => (
          <div key={pct} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full h-3 rounded-sm border border-gray-300/50 dark:border-gray-600/50"
              style={{ backgroundColor: returnColor(pct, period) }}
              title={`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
            />
            <span className="text-[10px] tabular-nums text-gray-500 dark:text-gray-400 truncate w-full text-center">
              {pct >= 0 ? '+' : ''}
              {Math.round(pct)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-gray-500 dark:text-gray-500">
        <span>Falling</span>
        <span>Amber ≈ 0%</span>
        <span>Growing</span>
      </div>
    </div>
  );
}
