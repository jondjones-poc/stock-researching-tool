'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  formatBearCasePrice,
  formatGbpPrice,
  formatPositionValue,
  formatPriceMovePercent,
  priceMoveColorClass,
} from '../utils/formatPriceMove';
import type { PortfolioStockCardData } from './PortfolioStockCard';

interface DcfInfo {
  hasDcfEntry: boolean;
  dcfHref: string;
}

interface PortfolioStockTableProps {
  stocks: PortfolioStockCardData[];
  usdToGbpRate: number | null;
  dcfByStockId: Map<number, DcfInfo>;
  saving: boolean;
  trafficLightCopiedId: number | null;
  watchlistStockIds: Set<number>;
  addingWatchlistStockId: number | null;
  onTrafficLight: (stock: PortfolioStockCardData) => void;
  onAddToWatchlist: (stock: PortfolioStockCardData) => void;
  onRemove: (id: number) => void;
}

type SortKey =
  | 'symbol'
  | 'active_price'
  | 'gain_loss_pct'
  | 'position_value'
  | 'shares'
  | 'avg_buy_cost'
  | 'day_change_pct'
  | 'month_change_pct'
  | 'bear_case_low_price';

type SortDir = 'asc' | 'desc';

function formatGbpFromUsd(usd: number | null | undefined, rate: number | null): string {
  if (usd == null || !Number.isFinite(usd)) return '—';
  if (rate) return formatGbpPrice(usd * rate);
  return `$${usd.toFixed(2)}`;
}

function formatShares(shares: number | null | undefined): string {
  if (shares == null || !Number.isFinite(shares)) return '—';
  return shares.toLocaleString('en-GB', { maximumFractionDigits: 4 });
}

function sortValue(stock: PortfolioStockCardData, key: SortKey): number | string | null {
  switch (key) {
    case 'symbol':
      return stock.stock_symbol.toUpperCase();
    case 'active_price':
      return stock.active_price;
    case 'gain_loss_pct':
      return stock.gain_loss_pct ?? null;
    case 'position_value':
      return stock.position_value ?? null;
    case 'shares':
      return stock.shares ?? null;
    case 'avg_buy_cost':
      return stock.avg_buy_cost ?? null;
    case 'day_change_pct':
      return stock.day_change_pct ?? null;
    case 'month_change_pct':
      return stock.month_change_pct ?? null;
    case 'bear_case_low_price':
      return stock.bear_case_low_price ?? null;
    default:
      return null;
  }
}

function compareStocks(a: PortfolioStockCardData, b: PortfolioStockCardData, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const mult = dir === 'asc' ? 1 : -1;

  if (key === 'symbol') {
    return mult * String(av).localeCompare(String(bv));
  }

  const an = av == null || !Number.isFinite(Number(av)) ? null : Number(av);
  const bn = bv == null || !Number.isFinite(Number(bv)) ? null : Number(bv);

  if (an == null && bn == null) return a.stock_symbol.localeCompare(b.stock_symbol);
  if (an == null) return 1;
  if (bn == null) return -1;
  if (an === bn) return a.stock_symbol.localeCompare(b.stock_symbol);
  return mult * (an - bn);
}

function sortStocks(stocks: PortfolioStockCardData[], key: SortKey, dir: SortDir): PortfolioStockCardData[] {
  return [...stocks].sort((a, b) => compareStocks(a, b, key, dir));
}

const thClass =
  'py-3 px-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 whitespace-nowrap';
const tdClass = 'py-3 px-3 text-sm tabular-nums whitespace-nowrap';

function SortHeader({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = 'left',
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'center';
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th className={`${thClass} ${align === 'center' ? 'text-center' : ''} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-gray-800 dark:hover:text-gray-200 ${
          align === 'center' ? 'mx-auto' : ''
        }`}
        title={`Sort by ${label}`}
      >
        <span>{label}</span>
        <span className={`text-[10px] ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden={!active}>
          {direction === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  );
}

export default function PortfolioStockTable({
  stocks,
  usdToGbpRate,
  dcfByStockId,
  saving,
  trafficLightCopiedId,
  watchlistStockIds,
  addingWatchlistStockId,
  onTrafficLight,
  onAddToWatchlist,
  onRemove,
}: PortfolioStockTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'symbol' ? 'asc' : 'desc');
    }
  };

  const sortedStocks = useMemo(
    () => sortStocks(stocks, sortKey, sortDir),
    [stocks, sortKey, sortDir]
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <SortHeader
                label="Symbol"
                sortKey="symbol"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Price"
                sortKey="active_price"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Stocks Value"
                sortKey="position_value"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
                className="min-w-[7.5rem]"
              />
              <SortHeader
                label="Since bought"
                sortKey="gain_loss_pct"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Shares"
                sortKey="shares"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Avg buy"
                sortKey="avg_buy_cost"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="1 day"
                sortKey="day_change_pct"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="1 month"
                sortKey="month_change_pct"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                label="Bear case"
                sortKey="bear_case_low_price"
                activeKey={sortKey}
                direction={sortDir}
                onSort={handleSort}
              />
              <th className={`${thClass} text-center`}>Watchlist</th>
              <th className={`${thClass} text-center`}>Test</th>
              <th className={`${thClass} text-center`}>Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedStocks.map((stock) => {
              const dcf = dcfByStockId.get(stock.id) ?? { hasDcfEntry: false, dcfHref: '#' };
              const showBearCase =
                dcf.hasDcfEntry &&
                stock.bear_case_low_price != null &&
                Number.isFinite(stock.bear_case_low_price) &&
                stock.bear_case_low_price > 0;
              const watchlistAdded = watchlistStockIds.has(stock.stock_id);
              const adding = addingWatchlistStockId === stock.stock_id;

              return (
                <tr key={stock.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className={tdClass}>
                    <Link
                      href={`/companies?stock_id=${stock.stock_id}`}
                      className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {stock.stock_symbol}
                    </Link>
                  </td>
                  <td className={`${tdClass} font-medium text-gray-900 dark:text-gray-100`}>
                    {formatGbpFromUsd(stock.active_price, usdToGbpRate)}
                  </td>
                  <td className={`${tdClass} min-w-[7.5rem] font-medium text-gray-900 dark:text-gray-100`}>
                    {stock.position_value != null
                      ? formatPositionValue(stock.position_value, usdToGbpRate)
                      : '—'}
                  </td>
                  <td className={`${tdClass} font-medium ${priceMoveColorClass(stock.gain_loss_pct)}`}>
                    {formatPriceMovePercent(stock.gain_loss_pct)}
                  </td>
                  <td className={`${tdClass} text-gray-700 dark:text-gray-300`}>
                    {formatShares(stock.shares)}
                  </td>
                  <td className={`${tdClass} text-gray-700 dark:text-gray-300`}>
                    {formatGbpFromUsd(stock.avg_buy_cost, usdToGbpRate)}
                  </td>
                  <td className={`${tdClass} ${priceMoveColorClass(stock.day_change_pct)}`}>
                    {formatPriceMovePercent(stock.day_change_pct)}
                  </td>
                  <td className={`${tdClass} ${priceMoveColorClass(stock.month_change_pct)}`}>
                    {formatPriceMovePercent(stock.month_change_pct)}
                  </td>
                  <td className={tdClass}>
                    <Link
                      href={dcf.dcfHref}
                      className={
                        dcf.hasDcfEntry
                          ? 'text-green-700 dark:text-green-400 hover:underline font-medium'
                          : 'text-red-600 dark:text-red-400 hover:underline'
                      }
                    >
                      {showBearCase
                        ? formatBearCasePrice(stock.bear_case_low_price!, usdToGbpRate)
                        : dcf.hasDcfEntry
                          ? 'DCF'
                          : '—'}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      onClick={() => onAddToWatchlist(stock)}
                      disabled={saving || adding || watchlistAdded}
                      title={
                        watchlistAdded
                          ? 'Already on watchlist this month'
                          : 'Add to watchlist for this month'
                      }
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm disabled:opacity-50 disabled:cursor-not-allowed border-emerald-300 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                    >
                      {adding ? '…' : watchlistAdded ? '✓' : '+'}
                    </button>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      onClick={() => onTrafficLight(stock)}
                      disabled={saving}
                      title={trafficLightCopiedId === stock.id ? 'Copied!' : 'Traffic Light Test'}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm disabled:opacity-50 ${
                        trafficLightCopiedId === stock.id
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                          : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                      }`}
                    >
                      {trafficLightCopiedId === stock.id ? '✓' : '🚦'}
                    </button>
                  </td>
                  <td className={`${tdClass} text-center`}>
                    <button
                      type="button"
                      onClick={() => onRemove(stock.id)}
                      disabled={saving}
                      title="Remove from portfolio"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 text-sm disabled:opacity-50"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
