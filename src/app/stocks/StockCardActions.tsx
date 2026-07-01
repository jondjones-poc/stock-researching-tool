'use client';

import Link from 'next/link';

interface StockCardActionsProps {
  stockId: number;
  saving: boolean;
  trafficLightCopied: boolean;
  onTrafficLight: () => void;
  onRemove?: () => void;
  showDcf?: boolean;
  hasDcfEntry?: boolean;
  dcfHref?: string;
}

export default function StockCardActions({
  saving,
  trafficLightCopied,
  onTrafficLight,
  onRemove,
  showDcf = false,
  hasDcfEntry = false,
  dcfHref,
}: StockCardActionsProps) {
  return (
    <div className="flex items-center gap-2">
      {showDcf && dcfHref && (
        <Link
          href={dcfHref}
          title={hasDcfEntry ? 'DCF model saved' : 'No DCF model — create one'}
          aria-label={hasDcfEntry ? 'DCF model saved' : 'No DCF model — create one'}
          className={`px-2 py-1 rounded-lg border text-xs font-bold transition-colors ${
            hasDcfEntry
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
              : 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
          }`}
        >
          DCF
        </Link>
      )}
      <button
        type="button"
        onClick={onTrafficLight}
        disabled={saving}
        title={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
        aria-label={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
        className={`px-2 py-1 rounded-lg border text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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