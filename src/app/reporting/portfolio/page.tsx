'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

type Row = { symbol: string; value: number; weightPercent: number };

const COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
];

function formatMoney(amount: number, currency: 'GBP' | 'USD') {
  if (currency === 'GBP') {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildPortfolioReviewPrompt(rows: Row[]): string {
  const lines = rows
    .map((r) => `${r.symbol}: ${r.weightPercent.toFixed(2)}%`)
    .join('\n');
  return `Please review my investment portfolio. Based only on the holdings and their percentage weights below (there are no dollar amounts—only allocation %):

1. What looks good about this portfolio?
2. What looks weak, risky, or worth questioning?
3. Give me 3 concrete tips I could use to improve it.

Holdings (weight % of portfolio):
${lines}`;
}

export default function ReportingPortfolioPage() {
  const [data, setData] = useState<Row[]>([]);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [currency, setCurrency] = useState<'GBP' | 'USD'>('GBP');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/portfolio-weights')
      .then((res) =>
        res.ok ? res.json() : res.json().then((j) => Promise.reject(new Error(j.error || res.statusText)))
      )
      .then((json) => {
        if (cancelled) return;
        setData(Array.isArray(json.data) ? json.data : []);
        setTotalValue(typeof json.totalValue === 'number' ? json.totalValue : 0);
        setCurrency(json.currency === 'USD' ? 'USD' : 'GBP');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? 'Failed to load portfolio');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartHeight = Math.max(320, data.length * 36 + 80);
  const maxPct = data.length ? Math.max(...data.map((d) => d.weightPercent), 1) : 100;
  const xMax = Math.min(100, Math.ceil(maxPct * 1.15 + 2));
  const yAxisWidth = Math.min(140, Math.max(72, ...data.map((d) => d.symbol.length * 8 + 16)));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {loading && (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading portfolio…</div>
        )}
        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
        {!loading && !error && data.length === 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-6 text-amber-900 dark:text-amber-200">
            No portfolio positions found. Save your eToro portfolio from the app so rows exist in{' '}
            <code className="text-sm">portfolio_data</code>.
          </div>
        )}
        {!loading && !error && data.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex flex-wrap justify-between items-baseline gap-4 mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Portfolio Weighting
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 max-w-xl">
                <div>
                  Total portfolio value:{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatMoney(totalValue, currency)}
                  </span>
                  <span className="text-gray-500 dark:text-gray-500 font-normal ml-1">
                    ({currency})
                  </span>
                </div>
              </div>
            </div>
            <div className="rounded-lg bg-gray-900 p-4 -mx-1 sm:mx-0 mt-2">
              <ResponsiveContainer width="100%" height={chartHeight}>
                <BarChart
                  layout="vertical"
                  data={data}
                  margin={{ top: 8, right: 24, left: 4, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, xMax]}
                    tick={false}
                    tickLine={false}
                    stroke="#94a3b8"
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    width={yAxisWidth}
                    tick={{ fill: '#ffffff', fontSize: 13 }}
                    stroke="#94a3b8"
                    tickMargin={6}
                  />
                  <Tooltip
                    formatter={(value: number, _name: string, props: { payload?: Row }) => {
                      const row = props.payload;
                      const pct = typeof value === 'number' ? value : Number(value);
                      return [
                        `${pct.toFixed(2)}% (${formatMoney(row?.value ?? 0, currency)})`,
                        'Weight',
                      ];
                    }}
                    labelFormatter={(label) => `Symbol: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(255,255,255,0.95)',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem',
                    }}
                  />
                  <Bar dataKey="weightPercent" name="Weight %" radius={[0, 4, 4, 0]}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 rounded-lg bg-gray-900 p-6">
              <h3 className="text-2xl font-semibold text-white mb-4">Holdings Breakdown</h3>
              <ul className="flex flex-col divide-y divide-gray-600 text-sm w-full max-w-xl">
                {data.map((r) => (
                  <li
                    key={r.symbol}
                    className="flex justify-between items-center gap-4 py-2.5 text-gray-200"
                  >
                    <span className="font-semibold shrink-0 text-white">{r.symbol}</span>
                    <span className="text-gray-300 tabular-nums text-right">
                      {r.weightPercent.toFixed(2)}% — {formatMoney(r.value, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(buildPortfolioReviewPrompt(data));
                    setCopyStatus('copied');
                    window.setTimeout(() => setCopyStatus('idle'), 3500);
                  } catch {
                    setCopyStatus('error');
                    window.setTimeout(() => setCopyStatus('idle'), 4000);
                  }
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400 text-white font-medium px-6 py-3 text-sm shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                Ask AI to review my portfolio
              </button>
              {copyStatus === 'copied' && (
                <p className="text-sm text-green-600 dark:text-green-400 text-center max-w-md">
                  Copied to clipboard — paste into ChatGPT, Claude, or your AI of choice.
                </p>
              )}
              {copyStatus === 'error' && (
                <p className="text-sm text-red-600 dark:text-red-400 text-center">
                  Could not copy. Check browser permissions or copy manually.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
