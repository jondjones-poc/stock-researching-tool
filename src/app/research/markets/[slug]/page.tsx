'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  MARKET_FLOW_PERIOD_LABELS,
  MARKET_FLOW_PERIODS,
  type MarketFlowPeriod,
} from '@/app/config/marketFlow';
import { formatPct, heatClass } from '@/app/utils/marketFlowFormat';

interface DetailFund {
  symbol: string;
  name: string;
  description: string;
  price: number | null;
  asOf: string | null;
  returns: Record<string, number | null>;
}

interface DetailPayload {
  market: { slug: string; name: string; region: string };
  period: MarketFlowPeriod;
  large: DetailFund | null;
  small: DetailFund | null;
  chart: Array<{ date: string; large: number; small: number }>;
  historyTable: Array<{ date: string; large: number | null; small: number | null }>;
}

export default function MarketFlowDetailPage() {
  const params = useParams();
  const slug = String(params.slug ?? '');
  const [period, setPeriod] = useState<MarketFlowPeriod>('1y');
  const [data, setData] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/market-flow/${slug}?period=${period}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [slug, period]);

  useEffect(() => {
    void load();
  }, [load]);

  const pillClass = (active: boolean) =>
    `px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
      active
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400'
    }`;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-6xl mx-auto p-4 lg:p-6">
        <Link
          href="/research/markets"
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Market Flow Tracker
        </Link>

        {loading && !data ? (
          <div className="py-16 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : error ? (
          <div className="mt-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg">
            {error}
          </div>
        ) : data ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3 mb-4">
              <div>
                <h1 className="text-2xl font-bold">{data.market.name}</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">{data.market.region}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {MARKET_FLOW_PERIODS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={pillClass(period === p)}
                  >
                    {MARKET_FLOW_PERIOD_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 mb-6">
              {[
                { label: 'Large-cap', fund: data.large },
                { label: 'Small-cap', fund: data.small },
              ].map(({ label, fund }) => (
                <div
                  key={label}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700"
                >
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {label}
                  </div>
                  {fund ? (
                    <>
                      <div className="mt-1 text-lg font-semibold">
                        {fund.symbol}{' '}
                        <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                          {fund.name}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {fund.description}
                      </p>
                      <div className="mt-3 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Price: </span>
                        <span className="font-semibold tabular-nums">
                          {fund.price != null ? `$${fund.price.toFixed(2)}` : '—'}
                        </span>
                        {fund.asOf && (
                          <span className="ml-2 text-xs text-gray-400">as of {fund.asOf}</span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {MARKET_FLOW_PERIODS.map((p) => (
                          <span
                            key={p}
                            className={`rounded px-2 py-0.5 text-xs font-semibold tabular-nums ${heatClass(fund.returns[p] ?? null)}`}
                          >
                            {p} {formatPct(fund.returns[p] ?? null)}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 italic">
                      No fund configured
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 mb-6">
              <h2 className="text-sm font-semibold">
                Indexed comparison — both series start at 100
              </h2>
              <div className="h-80 w-full mt-4">
                {data.chart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.3} />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={32} />
                      <YAxis tick={{ fontSize: 11 }} width={44} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={(v: number) => v.toFixed(1)}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="large"
                        name={data.large ? `${data.large.symbol} (large)` : 'Large'}
                        stroke="#2563eb"
                        dot={false}
                        strokeWidth={2}
                      />
                      <Line
                        type="monotone"
                        dataKey="small"
                        name={data.small ? `${data.small.symbol} (small)` : 'Small'}
                        stroke="#d97706"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    No overlapping price history for this period
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-sm font-semibold">Historic prices</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Most recent 120 sessions
                </p>
              </div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full border-collapse">
                  <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700">
                    <tr className="border-b border-gray-200 dark:border-gray-600">
                      <th className="text-left py-2 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Date
                      </th>
                      <th className="text-right py-2 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {data.large?.symbol ?? 'Large'}
                      </th>
                      <th className="text-right py-2 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {data.small?.symbol ?? 'Small'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.historyTable.map((row) => (
                      <tr
                        key={row.date}
                        className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td className="py-1.5 px-4 text-sm text-gray-600 dark:text-gray-300">
                          {row.date}
                        </td>
                        <td className="py-1.5 px-4 text-sm text-right tabular-nums">
                          {row.large != null ? row.large.toFixed(2) : '—'}
                        </td>
                        <td className="py-1.5 px-4 text-sm text-right tabular-nums">
                          {row.small != null ? row.small.toFixed(2) : '—'}
                        </td>
                      </tr>
                    ))}
                    {data.historyTable.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          className="py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          No prices stored yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Tracks price momentum and market leadership. Does not show confirmed investor cash
              flows.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
