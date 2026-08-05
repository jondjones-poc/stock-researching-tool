'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { buildCompanyFinderAskAiPrompt } from '@/app/utils/buildCompanyFinderAskAiPrompt';

type FinderRow = {
  ticker: string;
  name: string | null;
  sector: string | null;
  country: string | null;
  price: number | null;
  marketCap: number | null;
  cash: number | null;
  ocfYtd: number | null;
  fcfYtd: number | null;
  score: number | null;
  ocfPerWeek: number | null;
  estPerSharePerWeek: number | null;
  weeklyOcfYieldPct: number | null;
  cashAsOf: string | null;
  totalDebt: number | null;
  totalDebtAsOf: string | null;
  totalDebtSource: string | null;
  netCash: number | null;
  ocfAsOf: string | null;
  ocfPeriod: string | null;
  fcfAsOf: string | null;
  fcfPeriod: string | null;
  fcfSource: string | null;
  confidenceScore: number | null;
  confidenceStars: number | null;
  confidenceReasons: Array<{ code: string; message: string; points: number }>;
  confidenceLatestFilingDate: string | null;
  dataQuality: string;
};

type SortKey = 'ticker' | 'confidence' | 'marketCap' | 'cash' | 'netCash' | 'fcf';
type SortDir = 'asc' | 'desc';

const FCF_YIELD_SLIDER_MAX = 50;
const NET_CASH_YIELD_SLIDER_MAX = 100;

function formatMoney(value: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(digits)}`;
}

function cashToMarketPct(row: FinderRow): number | null {
  if (row.cash == null || row.marketCap == null || row.marketCap <= 0) return null;
  return (row.cash / row.marketCap) * 100;
}

function confidenceTooltip(row: FinderRow): string {
  if (row.confidenceScore == null) return 'Confidence not computed yet (will fill on next scrape).';
  const lines = [`Confidence: ${row.confidenceScore} / 100`];
  if (row.confidenceLatestFilingDate) {
    lines.push(`Latest filing: ${row.confidenceLatestFilingDate}`);
  }
  if (row.confidenceReasons?.length) {
    lines.push('');
    for (const reason of row.confidenceReasons) {
      lines.push(`−${reason.points}: ${reason.message}`);
    }
  } else {
    lines.push('No warning flags.');
  }
  return lines.join('\n');
}

function ConfidenceStars({ stars }: { stars: number | null }) {
  if (stars == null) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span className="inline-flex tracking-tight text-amber-500" aria-label={`${stars} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < stars ? 'opacity-100' : 'opacity-25'}>
          ★
        </span>
      ))}
    </span>
  );
}

function sortValue(row: FinderRow, key: SortKey): string | number | null {
  switch (key) {
    case 'ticker':
      return row.ticker.toUpperCase();
    case 'confidence':
      return row.confidenceScore ?? row.confidenceStars;
    case 'marketCap':
      return row.marketCap;
    case 'cash':
      return row.cash;
    case 'netCash':
      return row.netCash;
    case 'fcf':
      return row.fcfYtd;
  }
}

function compareRows(a: FinderRow, b: FinderRow, key: SortKey, dir: SortDir): number {
  const av = sortValue(a, key);
  const bv = sortValue(b, key);
  const aNull = av == null || av === '';
  const bNull = bv == null || bv === '';
  if (aNull && bNull) return a.ticker.localeCompare(b.ticker);
  if (aNull) return 1;
  if (bNull) return -1;
  let cmp = 0;
  if (typeof av === 'string' && typeof bv === 'string') {
    cmp = av.localeCompare(bv);
  } else {
    cmp = Number(av) - Number(bv);
  }
  if (cmp === 0) cmp = a.ticker.localeCompare(b.ticker);
  return dir === 'asc' ? cmp : -cmp;
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  className = '',
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sortKey === column;
  return (
    <th className={className} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide hover:text-gray-800 dark:hover:text-gray-200 ${
          active ? 'font-semibold text-gray-800 dark:text-gray-200' : ''
        }`}
      >
        {label}
        <span className="text-[10px] tabular-nums" aria-hidden>
          {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
        </span>
      </button>
    </th>
  );
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

  const [minCashToMarketPct, setMinCashToMarketPct] = useState(90);
  const [minFcfToMarketPct, setMinFcfToMarketPct] = useState(20);
  const [minConfidenceStars, setMinConfidenceStars] = useState(5);
  const [minNetCashToMarketPct, setMinNetCashToMarketPct] = useState(0);
  const [includeMissingNetCash, setIncludeMissingNetCash] = useState(false);
  const [showNetCashOptions, setShowNetCashOptions] = useState(false);
  const [showDeepValueInfo, setShowDeepValueInfo] = useState(false);
  const [q, setQ] = useState('');
  const [sector, setSector] = useState('');
  const [country, setCountry] = useState('');
  const [sectors, setSectors] = useState<string[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [savedTickers, setSavedTickers] = useState<Set<string>>(new Set());
  const [savingTicker, setSavingTicker] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [askAiMessage, setAskAiMessage] = useState<string | null>(null);
  const [askAiCopiedTicker, setAskAiCopiedTicker] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'ticker' ? 'asc' : 'desc');
  };

  const sortedRows =
    sortKey == null ? rows : [...rows].sort((a, b) => compareRows(a, b, sortKey, sortDir));

  const loadSavedTickers = useCallback(async () => {
    try {
      const res = await fetch('/api/stock-valuations/list?limit=2000');
      const json = await res.json();
      if (!res.ok) return;
      const next = new Set<string>();
      for (const row of json.data || []) {
        if (row.stock) next.add(String(row.stock).toUpperCase());
      }
      setSavedTickers(next);
    } catch {
      // optional
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('minCashToMarketPct', String(minCashToMarketPct));
      params.set('minFcfToMarketPct', String(minFcfToMarketPct));
      params.set('minConfidenceStars', String(minConfidenceStars));
      params.set('minNetCashToMarketPct', String(minNetCashToMarketPct));
      params.set('includeMissingNetCash', String(includeMissingNetCash));
      params.set('limit', '150');
      if (q.trim()) params.set('q', q.trim());
      if (sector) params.set('sector', sector);
      if (country) params.set('country', country);

      const res = await fetch(`/api/company-finder?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || json.hint || 'Failed to load');
      setRows(json.rows || []);
      setTotal(json.total || 0);
      setStats(json.stats || null);
      setLatestRun(json.latestRun || null);
      setSectors(json.facets?.sectors || []);
      setCountries(json.facets?.countries || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    minCashToMarketPct,
    minFcfToMarketPct,
    minConfidenceStars,
    minNetCashToMarketPct,
    includeMissingNetCash,
    q,
    sector,
    country,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSavedTickers();
  }, [loadSavedTickers]);

  const handleSave = async (row: FinderRow) => {
    const ticker = row.ticker.toUpperCase();
    if (savedTickers.has(ticker) || savingTicker) return;
    setSavingTicker(ticker);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/stock-valuations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock: ticker,
          active_price: row.price,
          market_cap: row.marketCap,
          free_cash_flow: row.fcfYtd,
        }),
      });
      const json = await res.json();
      if (res.status === 409 || res.ok) {
        setSavedTickers((prev) => new Set(prev).add(ticker));
        setSaveMessage(
          res.status === 409
            ? `${ticker} is already in Companies`
            : `${ticker} saved to Companies`
        );
        return;
      }
      setSaveMessage(json.error || `Failed to save ${ticker}`);
    } catch (e: unknown) {
      setSaveMessage(e instanceof Error ? e.message : `Failed to save ${ticker}`);
    } finally {
      setSavingTicker(null);
    }
  };

  const handleAskAi = async (row: FinderRow) => {
    const cashPct = cashToMarketPct(row);
    const fcfPct =
      row.fcfYtd != null && row.marketCap != null && row.marketCap > 0
        ? (row.fcfYtd / row.marketCap) * 100
        : null;
    const prompt = buildCompanyFinderAskAiPrompt({
      ticker: row.ticker,
      name: row.name,
      sector: row.sector,
      country: row.country,
      price: row.price,
      marketCap: row.marketCap,
      cash: row.cash,
      cashAsOf: row.cashAsOf,
      totalDebt: row.totalDebt,
      totalDebtAsOf: row.totalDebtAsOf,
      netCash: row.netCash,
      fcfYtd: row.fcfYtd,
      fcfPeriod: row.fcfPeriod,
      fcfAsOf: row.fcfAsOf,
      ocfYtd: row.ocfYtd,
      ocfPeriod: row.ocfPeriod,
      cashToMarketPct: cashPct,
      fcfToMarketPct: fcfPct,
      minCashToMarketPct,
      minFcfToMarketPct,
      minNetCashToMarketPct,
      includeMissingNetCash,
      minConfidenceStars,
      filterSector: sector || null,
      filterCountry: country || null,
      confidenceScore: row.confidenceScore,
      confidenceStars: row.confidenceStars,
      confidenceLatestFilingDate: row.confidenceLatestFilingDate,
      confidenceReasons: row.confidenceReasons ?? [],
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setAskAiCopiedTicker(row.ticker);
        setAskAiMessage(`${row.ticker} Ask AI prompt copied`);
        window.setTimeout(() => {
          setAskAiCopiedTicker(null);
          setAskAiMessage(null);
        }, 5000);
        return;
      }
      setError('Could not access clipboard.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to copy prompt');
    }
  };

  const handleRefresh = async () => {
    const ok = window.confirm(
      'This scrape batch hits SEC and quote APIs and can be resource intensive (rate limits, DB writes, several minutes for larger runs).\n\nContinue?'
    );
    if (!ok) return;

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
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <label className="flex min-w-[180px] flex-1 basis-[200px] flex-col text-xs font-medium">
              <span className="mb-2 block text-center">
                Cash ≥ market
                <span className="ml-1 tabular-nums text-gray-600 dark:text-gray-300">
                  {minCashToMarketPct}%
                </span>
              </span>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                value={minCashToMarketPct}
                onChange={(e) => setMinCashToMarketPct(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-green-600"
              />
            </label>

            <label className="flex min-w-[180px] flex-1 basis-[200px] flex-col text-xs font-medium">
              <span className="mb-2 block text-center">
                FCF ≥ market
                <span className="ml-1 tabular-nums text-gray-600 dark:text-gray-300">
                  {minFcfToMarketPct <= 0 ? 'Any' : `${minFcfToMarketPct}%`}
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={FCF_YIELD_SLIDER_MAX}
                step={5}
                value={minFcfToMarketPct}
                onChange={(e) => setMinFcfToMarketPct(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-green-600"
              />
            </label>

            <div className="relative flex min-w-[180px] flex-1 basis-[200px] flex-col text-xs font-medium">
              <div className="mb-2 flex items-center justify-center gap-1">
                <label htmlFor="net-cash-slider">
                  Net cash ≥ market
                  <span className="ml-1 tabular-nums text-gray-600 dark:text-gray-300">
                    {minNetCashToMarketPct <= 0 ? 'Any %' : `${minNetCashToMarketPct}%`}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowNetCashOptions((open) => !open)}
                  title="Net cash data options"
                  aria-label="Net cash data options"
                  aria-expanded={showNetCashOptions}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    includeMissingNetCash
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
                  }`}
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4h18l-7 8v7l-4-2v-5L3 4z"
                    />
                  </svg>
                </button>
              </div>
              {showNetCashOptions && (
                <div className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg dark:border-gray-600 dark:bg-gray-900">
                  <label className="flex items-start gap-2 text-[11px] font-normal leading-relaxed text-gray-700 dark:text-gray-200">
                    <input
                      type="checkbox"
                      checked={includeMissingNetCash}
                      onChange={(e) => setIncludeMissingNetCash(e.target.checked)}
                      className="mt-0.5 accent-green-600"
                    />
                    <span>
                      Include companies with no Net Cash (SEC does not report a single Total Debt
                      value for them)
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNetCashOptions(false)}
                    className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
                  >
                    Close
                  </button>
                </div>
              )}
              <input
                id="net-cash-slider"
                type="range"
                min={0}
                max={NET_CASH_YIELD_SLIDER_MAX}
                step={5}
                value={minNetCashToMarketPct}
                onChange={(e) => setMinNetCashToMarketPct(Number(e.target.value))}
                className="h-2 w-full cursor-pointer accent-green-600"
              />
            </div>

            <label className="flex w-36 flex-col text-xs font-medium">
              <span className="mb-2 block text-center">Confidence</span>
              <select
                value={minConfidenceStars}
                onChange={(e) => setMinConfidenceStars(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                <option value={5}>★★★★★</option>
                <option value={4}>★★★★☆+</option>
                <option value={3}>★★★☆☆+</option>
                <option value={2}>★★☆☆☆+</option>
                <option value={1}>★☆☆☆☆+</option>
                <option value={0}>Any</option>
              </select>
            </label>

            <label className="flex w-44 flex-col text-xs font-medium">
              <span className="mb-2 block text-center">Sector</span>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="">All sectors</option>
                {sectors.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex w-32 flex-col text-xs font-medium">
              <span className="mb-2 block text-center">Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
              >
                <option value="">All</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col items-center text-xs font-medium">
              <span className="mb-2 block select-none text-transparent" aria-hidden>
                &nbsp;
              </span>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Filter
              </button>
            </div>
          </div>

          <label className="mt-3 flex w-full flex-col text-xs font-medium">
            <span className="mb-2 block text-center">Ticker or name</span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ticker or company name"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
            />
          </label>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {askAiMessage && (
          <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            {askAiMessage}
          </div>
        )}
        {saveMessage && (
          <div className="mb-4 rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            {saveMessage}{' '}
            <a href="/companies" className="font-semibold underline">
              Open Companies
            </a>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-gray-500">Loading deep value stocks…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
            No matching companies yet.
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <SortHeader
                    label="Ticker"
                    column="ticker"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[13%] px-2 py-2.5 text-left"
                  />
                  <th className="w-[11%] px-2 py-2.5">Sector</th>
                  <th className="w-[5%] px-2 py-2.5">Ctry</th>
                  <SortHeader
                    label="Confidence"
                    column="confidence"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[10%] px-2 py-2.5 text-center [&_button]:justify-center"
                  />
                  <th className="w-[7%] px-2 py-2.5">Cash/mkt</th>
                  <SortHeader
                    label="Mkt cap"
                    column="marketCap"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[8%] px-2 py-2.5 text-left"
                  />
                  <SortHeader
                    label="Cash"
                    column="cash"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[8%] px-2 py-2.5 text-left"
                  />
                  <SortHeader
                    label="Net cash"
                    column="netCash"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[8%] px-2 py-2.5 text-left"
                  />
                  <SortHeader
                    label="FCF"
                    column="fcf"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={toggleSort}
                    className="w-[8%] px-2 py-2.5 text-left"
                  />
                  <th className="w-[7%] px-2 py-2.5">Price</th>
                  <th className="w-[15%] px-2 py-2.5"> </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const coverage = cashToMarketPct(row);
                  const strong = coverage != null && coverage >= minCashToMarketPct;
                  const isSaved = savedTickers.has(row.ticker.toUpperCase());
                  const isSaving = savingTicker === row.ticker.toUpperCase();
                  return (
                    <tr
                      key={row.ticker}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <td className="px-2 py-2 align-top">
                        <div className="font-bold leading-tight">{row.ticker}</div>
                        <div className="truncate text-[11px] text-gray-500" title={row.name || undefined}>
                          {row.name || '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top text-xs text-gray-600 dark:text-gray-300">
                        <div className="truncate" title={row.sector || undefined}>
                          {row.sector || '—'}
                        </div>
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums text-xs">{row.country || '—'}</td>
                      <td className="px-2 py-2 align-top text-center text-xs" title={confidenceTooltip(row)}>
                        <div className="leading-tight">
                          <ConfidenceStars stars={row.confidenceStars} />
                        </div>
                      </td>
                      <td
                        className={`px-2 py-2 align-top font-semibold tabular-nums ${
                          strong
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {coverage == null ? '—' : `${coverage.toFixed(0)}%`}
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums text-xs">
                        {formatMoney(row.marketCap)}
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums text-xs">
                        <div>{formatMoney(row.cash)}</div>
                        {row.cashAsOf ? (
                          <div className="text-[10px] text-gray-500">{row.cashAsOf}</div>
                        ) : null}
                      </td>
                      <td
                        className={`px-2 py-2 align-top tabular-nums text-xs ${
                          row.netCash != null && row.netCash > 0
                            ? 'text-green-700 dark:text-green-400'
                            : ''
                        }`}
                        title={
                          row.totalDebt != null
                            ? `Cash − Total Debt (${formatMoney(row.totalDebt)}${
                                row.totalDebtAsOf ? ` as of ${row.totalDebtAsOf}` : ''
                              })`
                            : 'Total Debt not reported as a single SEC fact — Net Cash left blank'
                        }
                      >
                        <div>{formatMoney(row.netCash)}</div>
                        {row.totalDebtAsOf ? (
                          <div className="text-[10px] text-gray-500">{row.totalDebtAsOf}</div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums text-xs">
                        <div>{formatMoney(row.fcfYtd)}</div>
                        {row.fcfPeriod || row.fcfAsOf ? (
                          <div className="truncate text-[10px] text-gray-500">
                            {row.fcfPeriod || row.fcfAsOf}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-2 py-2 align-top tabular-nums text-xs">
                        {row.price != null ? `$${row.price.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => void handleAskAi(row)}
                            title="Copy Ask AI research prompt"
                            className={`rounded-md px-2 py-1 text-xs font-semibold border ${
                              askAiCopiedTicker === row.ticker
                                ? 'border-green-600 bg-green-600 text-white'
                                : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            {askAiCopiedTicker === row.ticker ? 'Copied' : 'Ask AI'}
                          </button>
                          <button
                            type="button"
                            disabled={isSaved || isSaving}
                            onClick={() => void handleSave(row)}
                            className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                              isSaved
                                ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                                : 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-60'
                            }`}
                          >
                            {isSaved ? 'Saved' : isSaving ? '…' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="relative mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-gray-600 dark:text-gray-400">
          <button
            type="button"
            onClick={() => setShowDeepValueInfo((open) => !open)}
            title="What is deep value here?"
            aria-label="What is deep value here?"
            aria-expanded={showDeepValueInfo}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
              />
            </svg>
          </button>
          {showDeepValueInfo && (
            <div className="absolute bottom-full left-0 z-30 mb-2 w-80 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-relaxed text-gray-700 shadow-lg dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
              <div className="mb-1.5 font-semibold text-gray-900 dark:text-white">
                Deep value (this screen)
              </div>
              <p className="mb-2">
                Companies whose cash and investments are worth a large share of the entire market
                value. At <strong>90%</strong>, about 90% of the stock price is backed by cash —
                and you&apos;re effectively paying for the remaining ~10% of the business.
              </p>
              <p>
                Use the cash/market, FCF/market, and Net cash/market sliders, then sector and
                country, to narrow names for further research. Net Cash is Cash minus a single SEC
                Total Debt fact (blank when Total Debt is not tagged — never estimated). Confidence
                stars measure how reliable the SEC data looks (not investment quality) — hover for
                reasons.
              </p>
              <button
                type="button"
                onClick={() => setShowDeepValueInfo(false)}
                className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400"
              >
                Close
              </button>
            </div>
          )}
          {stats && (
            <span>
              Cached companies: <strong>{stats.total}</strong> · ≥90% cash/market:{' '}
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

        {isAdmin && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={refreshing}
              className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              {refreshing ? 'Scraping…' : 'Run scrape batch'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
