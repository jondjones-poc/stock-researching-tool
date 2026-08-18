'use client';

import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

type NetworthHistoryRow = { monthLabel: string; year: number; month: number; networth: number };
type Wage247HistoryRow = { monthLabel: string; year: number; month: number; hourlyWage: number };
type InvestmentTrackerRow = {
  monthLabel: string;
  month: number;
  investedThisMonth: number;
  cumulativeInvested: number;
  targetPerMonth: number;
  cumulativeTarget: number;
};

export default function ReportingNetworthPage() {
  const [networthData, setNetworthData] = useState<NetworthHistoryRow[]>([]);
  const [networthLoading, setNetworthLoading] = useState(true);
  const [networthError, setNetworthError] = useState<string | null>(null);

  const [wage247Data, setWage247Data] = useState<Wage247HistoryRow[]>([]);
  const [wage247Loading, setWage247Loading] = useState(true);
  const [wage247Error, setWage247Error] = useState<string | null>(null);
  const [wage247View, setWage247View] = useState<'line' | 'bar'>('line');

  const [investmentTrackerData, setInvestmentTrackerData] = useState<InvestmentTrackerRow[]>([]);
  const [investmentTrackerLoading, setInvestmentTrackerLoading] = useState(true);
  const [investmentTrackerError, setInvestmentTrackerError] = useState<string | null>(null);
  const [targetPerMonth, setTargetPerMonth] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/networth-history')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        setNetworthData(Array.isArray(json.data) ? json.data : []);
      })
      .catch((err) => {
        if (!cancelled) setNetworthError(err.message ?? 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setNetworthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/wage247-history')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        setWage247Data(Array.isArray(json.data) ? json.data : []);
      })
      .catch((err) => {
        if (!cancelled) setWage247Error(err.message ?? 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setWage247Loading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/investment-tracker-current-year')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        setInvestmentTrackerData(Array.isArray(json.data) ? json.data : []);
        setTargetPerMonth(json.targetPerMonth ?? 0);
      })
      .catch((err) => {
        if (!cancelled) setInvestmentTrackerError(err.message ?? 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setInvestmentTrackerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const formatAxisMoney = (v: number) =>
    v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(1)}m` : `£${(v / 1000).toFixed(0)}k`;

  const formatAxisWage = (v: number) => `£${v.toFixed(1)}`;
  const wage247Average =
    wage247Data.length > 0
      ? wage247Data.reduce((sum, row) => sum + row.hourlyWage, 0) / wage247Data.length
      : 0;
  const wage247LineData = wage247Data.map((row) => ({
    ...row,
    average: Number(wage247Average.toFixed(2)),
  }));
  const toggleBtnClass = (active: boolean) =>
    `inline-flex h-9 w-9 items-center justify-center transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
    }`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* 1. Networth over time */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Networth over time
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Total networth by month from networth report (first to last available).
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {networthLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : networthError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">
                {networthError}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={networthData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                  />
                  <YAxis
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                    tickFormatter={formatAxisMoney}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tw-bg-opacity)',
                      border: '1px solid #e5e7eb',
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as NetworthHistoryRow;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">
                            {label}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Networth: £
                            {p.networth.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="networth"
                    name="Networth"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 2. 24/7 Wage hourly */}
        <section className="mb-12">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              24/7 Wage (hourly)
            </h2>
            <div
              className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden shrink-0"
              role="group"
              aria-label="24/7 Wage chart type"
            >
              <button
                type="button"
                onClick={() => setWage247View('line')}
                title="Line graph (average)"
                aria-label="Line graph of average"
                aria-pressed={wage247View === 'line'}
                className={toggleBtnClass(wage247View === 'line')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M2 14.5V4M2 14.5h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4 11.5 7.5 7l3 3L16 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setWage247View('bar')}
                title="Bar graph"
                aria-label="Bar graph"
                aria-pressed={wage247View === 'bar'}
                className={toggleBtnClass(wage247View === 'bar')}
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path
                    d="M2 14.5V4M2 14.5h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M4.5 14.5v-4h2.5v4M8 14.5V7h2.5v7.5M11.5 14.5V9h2.5v5.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Hourly wage from 24/7 Wage (income types marked 24/7 wage ÷ 730 hours per month).
            {wage247View === 'line' && wage247Data.length > 0
              ? ` Average for this period: £${wage247Average.toLocaleString('en-GB', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}/hr.`
              : null}
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {wage247Loading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : wage247Error ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">
                {wage247Error}
              </div>
            ) : wage247View === 'line' ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={wage247LineData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                  />
                  <YAxis
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                    tickFormatter={formatAxisWage}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tw-bg-opacity)',
                      border: '1px solid #e5e7eb',
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as Wage247HistoryRow & { average?: number };
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">
                            {label}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Hourly wage: £
                            {p.hourlyWage.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /hr
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Average: £
                            {(p.average ?? wage247Average).toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /hr
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="hourlyWage"
                    name="24/7 Hourly Wage"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#06b6d4' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="average"
                    name="Average"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={wage247Data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                  />
                  <YAxis
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                    tickFormatter={formatAxisWage}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tw-bg-opacity)',
                      border: '1px solid #e5e7eb',
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as Wage247HistoryRow;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">
                            {label}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Hourly wage: £
                            {p.hourlyWage.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                            /hr
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="hourlyWage"
                    name="24/7 Hourly Wage"
                    fill="#06b6d4"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 3. Investment Tracker – current year */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Investment Tracker (current year)
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {investmentTrackerLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : investmentTrackerError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">
                {investmentTrackerError}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={investmentTrackerData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                  />
                  <YAxis
                    tick={{ fill: 'currentColor' }}
                    className="text-gray-700 dark:text-gray-300"
                    tickFormatter={formatAxisMoney}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--tw-bg-opacity)',
                      border: '1px solid #e5e7eb',
                    }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as InvestmentTrackerRow;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">
                            {label}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Invested this month: £
                            {p.investedThisMonth.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Cumulative invested: £
                            {p.cumulativeInvested.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Target cumulative (avg £
                            {p.targetPerMonth.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            /month): £
                            {p.cumulativeTarget.toLocaleString('en-GB', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="cumulativeInvested"
                    name="Cumulative invested"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeTarget"
                    name="Target cumulative (monthly avg × months)"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
