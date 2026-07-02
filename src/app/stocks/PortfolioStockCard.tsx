'use client';

import Link from 'next/link';
import {
  formatBearCasePrice,
  formatGbpPrice,
  formatPositionValue,
  formatPriceMovePercent,
  priceMoveBoxClass,
} from '../utils/formatPriceMove';

export interface PortfolioStockCardData {
  id: number;
  stock_id: number;
  stock_symbol: string;
  active_price: number | null;
  bear_case_low_price?: number | null;
  day_change_pct?: number | null;
  month_change_pct?: number | null;
  shares?: number | null;
  avg_buy_cost?: number | null;
  position_value?: number | null;
  gain_loss_pct?: number | null;
}

interface PortfolioStockCardProps {
  stock: PortfolioStockCardData;
  usdToGbpRate: number | null;
  hasDcfEntry: boolean;
  dcfHref: string;
  saving: boolean;
  trafficLightCopied: boolean;
  onTrafficLight: () => void;
  onAddToWatchlist: () => void;
  onRemove: () => void;
  watchlistAdded: boolean;
  addingToWatchlist: boolean;
}

const valueBoxClass =
  'w-full px-3 py-2.5 rounded-lg border-2 text-center font-semibold min-h-[44px] flex items-center justify-center tabular-nums';

function formatActivePrice(price: number | null, usdToGbpRate: number | null): string {
  if (price == null || !Number.isFinite(price)) return '—';
  if (usdToGbpRate) return formatGbpPrice(price * usdToGbpRate);
  return `$${price.toFixed(2)}`;
}

export default function PortfolioStockCard({
  stock,
  usdToGbpRate,
  hasDcfEntry,
  dcfHref,
  saving,
  trafficLightCopied,
  onTrafficLight,
  onAddToWatchlist,
  onRemove,
  watchlistAdded,
  addingToWatchlist,
}: PortfolioStockCardProps) {
  const showBearCase =
    hasDcfEntry &&
    stock.bear_case_low_price != null &&
    Number.isFinite(stock.bear_case_low_price) &&
    stock.bear_case_low_price > 0;
  const hasHolding = stock.position_value != null && stock.gain_loss_pct != null;
  const gainClass = hasHolding ? priceMoveBoxClass(stock.gain_loss_pct) : '';

  const holdingTooltip =
    stock.shares != null && stock.avg_buy_cost != null
      ? `${stock.shares.toLocaleString('en-US', { maximumFractionDigits: 4 })} shares @ ${
          usdToGbpRate
            ? formatGbpPrice(stock.avg_buy_cost * usdToGbpRate)
            : `$${stock.avg_buy_cost.toFixed(2)}`
        } avg buy`
      : undefined;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 hover:shadow-lg transition-shadow flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/companies?stock_id=${stock.stock_id}`}
          className="text-xl font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate leading-tight"
        >
          {stock.stock_symbol}
        </Link>
        <button
          type="button"
          onClick={onTrafficLight}
          disabled={saving}
          title={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
          aria-label={trafficLightCopied ? 'Copied!' : 'Traffic Light Test'}
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            trafficLightCopied
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
              : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
          }`}
        >
          {trafficLightCopied ? '✓' : '🚦'}
        </button>
      </div>

      <div
        className={`${valueBoxClass} text-2xl border-blue-200 dark:border-blue-500/60 bg-blue-50 dark:bg-blue-950/50 text-gray-900 dark:text-blue-100`}
        title="Current price"
      >
        {formatActivePrice(stock.active_price, usdToGbpRate)}
      </div>

      {hasHolding ? (
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`${valueBoxClass} text-lg ${gainClass}`}
            title="Gain / loss since purchase"
          >
            {formatPriceMovePercent(stock.gain_loss_pct)}
          </div>
          <div className={`${valueBoxClass} text-lg ${gainClass}`} title={holdingTooltip ?? 'Holding value'}>
            {formatPositionValue(stock.position_value!, usdToGbpRate)}
          </div>
        </div>
      ) : (
        <div
          className={`${valueBoxClass} text-lg border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500`}
          title="No holding data — save eToro portfolio on Dividends page"
        >
          —
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <div
          className={`${valueBoxClass} text-xs ${priceMoveBoxClass(stock.day_change_pct)}`}
          title="1 Day Move"
        >
          {formatPriceMovePercent(stock.day_change_pct)}
        </div>
        <div
          className={`${valueBoxClass} text-xs ${priceMoveBoxClass(stock.month_change_pct)}`}
          title="1 Month Move"
        >
          {formatPriceMovePercent(stock.month_change_pct)}
        </div>
        <Link
          href={dcfHref}
          title={
            showBearCase
              ? 'Bear Case Low Price'
              : hasDcfEntry
                ? 'DCF model saved'
                : 'No DCF model — create one'
          }
          className={`${valueBoxClass} text-xs ${
            hasDcfEntry
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40'
              : 'border-red-400 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40'
          }`}
        >
          {showBearCase ? formatBearCasePrice(stock.bear_case_low_price!, usdToGbpRate) : 'DCF'}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onAddToWatchlist}
          disabled={saving || addingToWatchlist || watchlistAdded}
          title={
            watchlistAdded ? 'Already on watchlist this month' : 'Add to watchlist for this month'
          }
          aria-label={
            watchlistAdded ? 'Already on watchlist this month' : 'Add to watchlist for this month'
          }
          className={`${valueBoxClass} text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            watchlistAdded
              ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700/50 text-gray-400 dark:text-gray-500'
              : 'border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
          }`}
        >
          {addingToWatchlist ? '…' : watchlistAdded ? '✓' : '+'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={saving}
          title="Remove from portfolio"
          aria-label="Remove from portfolio"
          className={`${valueBoxClass} text-lg border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
