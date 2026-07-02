'use client';

import type { MissingEtoroHolding } from '../utils/portfolioSymbolMatch';

interface PortfolioEtoroSyncDialogProps {
  open: boolean;
  onClose: () => void;
  savedCount: number;
  removedCount?: number;
  holdings: MissingEtoroHolding[];
}

export default function PortfolioEtoroSyncDialog({
  open,
  onClose,
  savedCount,
  removedCount = 0,
  holdings,
}: PortfolioEtoroSyncDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="etoro-sync-dialog-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="etoro-sync-dialog-title" className="text-xl font-bold text-gray-900 dark:text-white">
          eToro sync complete
        </h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Saved {savedCount} active holding{savedCount === 1 ? '' : 's'} from eToro.
          {removedCount > 0 && (
            <span> Removed {removedCount} sold or closed position{removedCount === 1 ? '' : 's'} from cache.</span>
          )}
        </p>

        {holdings.length > 0 ? (
          <>
            <p className="mt-4 text-sm font-medium text-gray-800 dark:text-gray-200">
              Not in your portfolio list — add these with the dropdown above if you still hold them:
            </p>
            <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-900/40">
              {holdings.map((holding) => (
                <li
                  key={`${holding.positionId ?? 'p'}-${holding.instrumentId ?? 'i'}-${holding.displayLabel}`}
                  className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
                >
                  <div className="font-semibold text-gray-900 dark:text-gray-100">{holding.displayLabel}</div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {holding.sharesOwned.toLocaleString('en-GB', { maximumFractionDigits: 4 })} shares
                    {holding.instrumentId != null && (
                      <span> · Instrument ID {holding.instrumentId}</span>
                    )}
                    {holding.positionId != null && <span> · Position ID {holding.positionId}</span>}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-4 text-sm text-green-700 dark:text-green-400">
            All active eToro holdings are already in your portfolio list.
          </p>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
