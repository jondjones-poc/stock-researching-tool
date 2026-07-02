'use client';

import Link from 'next/link';
import {
  formatBearCasePrice,
  formatPriceMovePercent,
  priceMoveBoxClass,
} from '../utils/formatPriceMove';

interface StockCardActionsProps {
  stockId: number;
  saving: boolean;
  trafficLightCopied: boolean;
  onTrafficLight: () => void;
  onRemove?: () => void;
  showDcf?: boolean;
  hasDcfEntry?: boolean;
  dcfHref?: string;
  bearCaseLowPrice?: number | null;
  dayChangePercent?: number | null;
  monthChangePercent?: number | null;
  usdToGbpRate?: number | null;
}

const metricBoxClass =
  'inline-flex h-8 min-w-[2.75rem] shrink-0 items-center justify-center rounded-lg border px-1 text-[10px] font-bold leading-none tabular-nums';

const metricDivider = 'h-6 w-px shrink-0 bg-gray-300 dark:bg-gray-600';

export default function StockCardActions({
  saving,
  trafficLightCopied,
  onTrafficLight,
  onRemove,
  showDcf = false,
  hasDcfEntry = false,
  dcfHref,
  bearCaseLowPrice,
  dayChangePercent,
  monthChangePercent,
  usdToGbpRate,
}: StockCardActionsProps) {
  const iconButtonClass =
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-base transition-colors';
  const showBearCase =
    hasDcfEntry && bearCaseLowPrice != null && Number.isFinite(bearCaseLowPrice) && bearCaseLowPrice > 0;

  return (
    <div className="flex items-center gap-1.5">
      {showDcf && dcfHref && (
        <>
          <span
            className={`${metricBoxClass} ${priceMoveBoxClass(dayChangePercent)}`}
            title="1 Day Move"
          >
            {formatPriceMovePercent(dayChangePercent)}
          </span>
          <span
            className={`${metricBoxClass} ${priceMoveBoxClass(monthChangePercent)}`}
            title="1 Month Move"
          >
            {formatPriceMovePercent(monthChangePercent)}
          </span>
          <div className={metricDivider} aria-hidden="true" />
          <Link
            href={dcfHref}
            title={
              showBearCase
                ? `Bear Case Low Price${usdToGbpRate ? ` (${formatBearCasePrice(bearCaseLowPrice!, usdToGbpRate)})` : ''}`
                : hasDcfEntry
                  ? 'DCF model saved'
                  : 'No DCF model — create one'
            }
            aria-label={
              showBearCase
                ? `Bear Case Low Price ${formatBearCasePrice(bearCaseLowPrice!, usdToGbpRate)}`
                : hasDcfEntry
                  ? 'DCF model saved'
                  : 'No DCF model — create one'
            }
            className={`${metricBoxClass} ${
              hasDcfEntry
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
                : 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
            }`}
          >
            {showBearCase ? formatBearCasePrice(bearCaseLowPrice!, usdToGbpRate) : 'DCF'}
          </Link>
          <div className={metricDivider} aria-hidden="true" />
        </>
      )}
      <button
        type="button"
        onClick={onTrafficLight}
        disabled={saving}
        title={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
        aria-label={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
        className={`${iconButtonClass} disabled:opacity-50 disabled:cursor-not-allowed ${
          trafficLightCopied
            ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
            : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
        }`}
      >
        {trafficLightCopied ? '✓' : '🚦'}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={saving}
          title="Remove"
          aria-label="Remove"
          className="px-2 py-1 rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base font-semibold leading-none"
        >
          ✕
        </button>
      )}
    </div>
  );
}
