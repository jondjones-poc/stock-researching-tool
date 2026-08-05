'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';

type FinderRow = {
  ticker: string;
  name: string | null;
  price: number | null;
  marketCap: number | null;
  cash: number | null;
  ocfYtd: number | null;
  score: number | null;
  ocfPerWeek: number | null;
  estPerSharePerWeek: number | null;
  weeklyOcfYieldPct: number | null;
  cashAsOf: string | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  dataQuality: string;
};

function formatMoney(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(digits)}`;
}

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(3)}%`;
}

function formatShare(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toFixed(4)}`;
}

export default function CompanyFinderPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<FinderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ total: number; candidates: number } | null>(null);
  const [latestRun, setLatestRun] = useState<{
    status: string;
    processed: number;
    upserted: number;
    candidates: number;
    finishedAt: string | null;
    cursorOffset: number;
  } | null>(null);

  const [candidatesOnly, setCandidatesOnly] = useState(true);
  const [q, setQ] = useState('');
  const [minMarketCapMm, setMinMarketCapMm] = useState('');
  const [maxMarketCapMm, setMaxMarketCapMm] = useState('5000');
  const [minCashMm, setMinCashMm] = useState('');
  const [minOcfMm, setMinOcfMm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('candidatesOnly', candidatesOnly ? '1' : '0');
      params.set('limit', '150');
      if (q.trim()) params.set('q', q.trim());
      if (minMarketCapMm.trim()) {
        params.set('minMarketCap', String(Number(minMarketCapMm) * 1e6));
      }
      if (maxMarketCapMm.trim()) {
        params.set('maxMarketCap', String(Number(maxMarketCapMm) * 1e6));
      }
      if (minCashMm.trim()) {
        params.set('minCash', String(Number(minCashMm) * 1e6));
      }
      if (minOcfMm.trim()) {
        params.set('minOcfYtd', String(Number(minOcfMm) * 1e6));
      }

      const res = await fetch(`/api/company-finder?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Failed to load');
      setRows(json.rows || []);
      setTotal(json.total || 0);
      setStats(json.stats || null);
      setLatestRun(json.latestRun || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [candidatesOnly, q, minMarketCapMm, maxMarketCapMm, minCashMm, minOcfMm]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/company-finder/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 40 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Refresh failed');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="mx-auto max-w-7xl p-4 lg:p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Company Finder</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-400">
              US-listed names where <span className="font-semibold">cash + operating cash flow</span>{' '}
              can cover market cap. Score = market cap − cash − OCF. Negative score = potential
              buy-screen hit.
            </p>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {refreshing ? 'Scraping…' : 'Run scrape batch'}
            </button>
          )}
        </div>

        <div className="mb-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-medium lg:col-span-2">
            Search
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ticker or name"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Min market cap ($M)
            <input
              value={minMarketCapMm}
              onChange={(e) => setMinMarketCapMm(e.target.value)}
              inputMode="decimal"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Max market cap ($M)
            <input
              value={maxMarketCapMm}
              onChange={(e) => setMaxMarketCapMm(e.target.value)}
              inputMode="decimal"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Min cash ($M)
            <input
              value={minCashMm}
              onChange={(e) => setMinCashMm(e.target.value)}
              inputMode="decimal"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            Min OCF YTD ($M)
            <input
              value={minOcfMm}
              onChange={(e) => setMinOcfMm(e.target.value)}
              inputMode="decimal"
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium lg:col-span-2">
            <input
              type="checkbox"
              checked={candidatesOnly}
              onChange={(e) => setCandidatesOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Buy candidates only (score &lt; 0)
          </label>
          <div className="flex items-end lg:col-span-4">
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:hover:bg-gray-700"
            >
              Apply filters
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
          {stats && (
            <span>
              Cached companies: <strong>{stats.total}</strong> · Candidates:{' '}
              <strong>{stats.candidates}</strong>
            </span>
          )}
          <span>
            Showing <strong>{rows.length}</strong> of <strong>{total}</strong>
          </span>
          {latestRun && (
            <span>
              Last scrape: {latestRun.status} · processed {latestRun.processed} · cursor{' '}
              {latestRun.cursorOffset}
              {latestRun.finishedAt
                ? ` · ${new Date(latestRun.finishedAt).toLocaleString('en-GB')}`
                : ''}
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading company finder…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
            No matching companies yet. Warm the database with a scrape batch (admin), then filter
            again.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-3">Ticker</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Market cap</th>
                  <th className="px-3 py-3">Cash</th>
                  <th className="px-3 py-3">OCF YTD</th>
                  <th className="px-3 py-3">Est $/share/wk</th>
                  <th className="px-3 py-3">Weekly OCF yield</th>
                  <th className="px-3 py-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const negative = row.score != null && row.score < 0;
                  return (
                    <tr
                      key={row.ticker}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <td className="px-3 py-3">
                        <div className="font-bold">{row.ticker}</div>
                        <div className="max-w-[220px] truncate text-xs text-gray-500">
                          {row.name || '—'}
                        </div>
                      </td>
                      <td
                        className={`px-3 py-3 font-semibold tabular-nums ${
                          negative
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {formatMoney(row.score)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{formatMoney(row.marketCap)}</td>
                      <td className="px-3 py-3 tabular-nums">
                        <div>{formatMoney(row.cash)}</div>
                        <div className="text-[10px] text-gray-500">{row.cashAsOf || ''}</div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        <div>{formatMoney(row.ocfYtd)}</div>
                        <div className="text-[10px] text-gray-500">
                          {row.ocfPeriod || row.ocfAsOf || ''}
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatShare(row.estPerSharePerWeek)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatPct(row.weeklyOcfYieldPct)}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
