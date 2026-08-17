'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type BreakdownRow = {
  incomeTypeId: number;
  name: string;
  annual: number;
  monthly: number;
  percentOfFreedom: number;
  isBusiness: boolean;
};

type ProjectionRow = {
  year: number;
  age: number | null;
  projectedNetWorth: number;
  projectedFreedomIncome: number;
  projectedFreedomMonthly: number;
  projectedAnnualExpenses: number;
  freedomRatio: number | null;
  salaryRequired: number;
  isWorkOptional: boolean;
};

type FreedomPayload = {
  statementYear: number;
  statementMonth: number;
  freedomAnnual: number;
  freedomMonthly: number;
  freedomRatio: number | null;
  salaryRequired: number | null;
  annualSalary: number | null;
  monthlySalary: number | null;
  salarySource: string | null;
  annualExpenses: number | null;
  monthlyLivingCost: number | null;
  currentNetWorth: number;
  workOptionalYear: number | null;
  breakdown: BreakdownRow[];
  projections: ProjectionRow[];
  assumptions: {
    incomeGrowthRatePct: number;
    expenseInflationPct: number;
    portfolioReturnPct: number;
    currentAge: number | null;
    retirementAge: number | null;
    monthlyLivingCost: number | null;
    statementMonth: number;
    statementYear: number;
  };
  salaryHistory: Array<{
    id: number;
    year: number;
    month: number;
    monthly_salary: number | string;
  }>;
  notes: {
    freedomDefinition: string;
    expensesDefinition: string;
    projectionDefinition: string;
  };
};

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatGbp(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const formatted = `£${abs.toLocaleString('en-GB', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
  return n < 0 ? `-${formatted}` : formatted;
}

function formatPct(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(digits)}%`;
}

export default function FreedomIncomePage() {
  const [data, setData] = useState<FreedomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salaryInput, setSalaryInput] = useState('');
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryMessage, setSalaryMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/freedom-income', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Freedom Income');
      setData(json as FreedomPayload);
      if (json.monthlySalary != null) {
        setSalaryInput(String(Number(json.monthlySalary)));
      }
      if (json.statementYear && json.statementMonth) {
        setSalaryYear(json.statementYear);
        setSalaryMonth(json.statementMonth);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSalary = async () => {
    const monthly = parseFloat(salaryInput.replace(/[£,\s]/g, ''));
    if (!Number.isFinite(monthly) || monthly < 0) {
      setSalaryMessage('Enter a valid monthly salary.');
      return;
    }
    setSavingSalary(true);
    setSalaryMessage(null);
    try {
      const res = await fetch('/api/salary-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: salaryYear,
          month: salaryMonth,
          monthly_salary: monthly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setSalaryMessage(
        `Saved £${monthly.toLocaleString('en-GB', { minimumFractionDigits: 2 })} for ${MONTH_NAMES[salaryMonth - 1]} ${salaryYear}`
      );
      await load();
    } catch (e: unknown) {
      setSalaryMessage(e instanceof Error ? e.message : 'Failed to save salary');
    } finally {
      setSavingSalary(false);
    }
  };

  const chartData =
    data?.projections.slice(0, 25).map((p) => ({
      year: p.year,
      'Freedom Income': Math.round(p.projectedFreedomIncome),
      'Annual expenses': Math.round(p.projectedAnnualExpenses),
      'Salary required': Math.round(p.salaryRequired),
    })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-2 sm:px-4 lg:px-6">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Freedom Income</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            How independent you are from salary — other income only (wage types excluded).
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">Loading…</div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-6 text-red-700 dark:text-red-300">
            {error}
            <button
              type="button"
              onClick={() => void load()}
              className="ml-3 underline font-medium"
            >
              Retry
            </button>
          </div>
        ) : !data ? (
          <div className="text-center py-16 text-gray-500">No data</div>
        ) : (
          <>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Based on {MONTH_NAMES[data.statementMonth - 1]} {data.statementYear} income
              statement · salary excluded from Freedom Income
            </p>

            {/* Key cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Freedom Income</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatGbp(data.freedomAnnual)}
                  <span className="text-sm font-medium text-gray-500"> / year</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatGbp(data.freedomMonthly, 2)} / month
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Freedom Ratio</div>
                <div
                  className={`text-2xl font-bold ${
                    (data.freedomRatio ?? 0) >= 100
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {formatPct(data.freedomRatio, 0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Freedom Income ÷ annual living costs
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Salary Required</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatGbp(data.salaryRequired)}
                  <span className="text-sm font-medium text-gray-500"> / year</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Living costs still needing salary (min £0)
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 border-l-4 border-green-500">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Work Optional</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {data.workOptionalYear != null ? data.workOptionalYear : 'Not yet projected'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  First year Freedom Ratio ≥ 100%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Current Salary</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatGbp(data.annualSalary)}
                  <span className="text-sm font-medium text-gray-500"> / year</span>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatGbp(data.monthlySalary, 2)} / month
                  {data.salarySource === 'Is247wage_fallback'
                    ? ' · from 24/7 wage types (enter salary below to override)'
                    : data.salarySource === 'salary_history'
                      ? ' · from salary history'
                      : ''}
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                  Salary is not included in Freedom Income.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Annual living costs
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatGbp(data.annualExpenses)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {data.monthlyLivingCost != null
                    ? `${formatGbp(data.monthlyLivingCost, 2)} / month from settings`
                    : 'Set MONTHLY_RETIERMENT_VALUE in Settings'}
                </div>
                <Link
                  href="/settings"
                  className="text-xs text-blue-600 dark:text-blue-400 underline mt-2 inline-block"
                >
                  Edit living cost in Settings
                </Link>
              </div>
            </div>

            {/* Salary entry */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Monthly salary
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                Stored by month for growth / mix reporting later. Does not change Freedom Income
                totals (those exclude wage income types).
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year</label>
                  <input
                    type="number"
                    value={salaryYear}
                    onChange={(e) => setSalaryYear(parseInt(e.target.value, 10) || salaryYear)}
                    className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Month</label>
                  <select
                    value={salaryMonth}
                    onChange={(e) => setSalaryMonth(parseInt(e.target.value, 10))}
                    className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Monthly salary (£)</label>
                  <input
                    type="text"
                    value={salaryInput}
                    onChange={(e) => setSalaryInput(e.target.value)}
                    placeholder="0.00"
                    className="w-40 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void saveSalary()}
                  disabled={savingSalary}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingSalary ? 'Saving…' : 'Save salary'}
                </button>
              </div>
              {salaryMessage && (
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-3">{salaryMessage}</p>
              )}
              {data.salaryHistory.length > 0 && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4">Month</th>
                        <th className="py-2">Monthly salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.salaryHistory.slice(0, 12).map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"
                        >
                          <td className="py-2 pr-4">
                            {MONTH_NAMES[Number(row.month) - 1]} {row.year}
                          </td>
                          <td className="py-2 tabular-nums">
                            {formatGbp(Number(row.monthly_salary), 2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Breakdown */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Freedom Income breakdown
              </h2>
              {data.breakdown.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No non-salary income for {MONTH_NAMES[data.statementMonth - 1]}{' '}
                  {data.statementYear}. Add entries on Cashflow / 24/7 Wage pages.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4">Income source</th>
                        <th className="py-2 pr-4 text-right">Annual income</th>
                        <th className="py-2 text-right">% of Freedom Income</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.breakdown.map((row) => (
                        <tr
                          key={row.incomeTypeId}
                          className="border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200"
                        >
                          <td className="py-2 pr-4">
                            {row.name}
                            {row.isBusiness ? (
                              <span className="ml-2 text-[10px] uppercase text-gray-400">
                                business
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-4 text-right tabular-nums">
                            {formatGbp(row.annual)}
                          </td>
                          <td className="py-2 text-right tabular-nums">
                            {formatPct(row.percentOfFreedom, 1)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                Projected Freedom Income vs expenses
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {data.notes.projectionDefinition}
                {data.workOptionalYear != null
                  ? ` Work Optional marked at ${data.workOptionalYear}.`
                  : ''}
              </p>
              {chartData.length === 0 ? (
                <p className="text-sm text-gray-500">Not enough data to project.</p>
              ) : (
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v) =>
                          `£${Number(v).toLocaleString('en-GB', { notation: 'compact' })}`
                        }
                      />
                      <Tooltip
                        formatter={(value) =>
                          formatGbp(typeof value === 'number' ? value : Number(value))
                        }
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Freedom Income"
                        stroke="#16a34a"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Annual expenses"
                        stroke="#dc2626"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="Salary required"
                        stroke="#ca8a04"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                      {data.workOptionalYear != null && (
                        <ReferenceLine
                          x={data.workOptionalYear}
                          stroke="#16a34a"
                          strokeDasharray="3 3"
                          label={{
                            value: 'Work Optional',
                            position: 'insideTopRight',
                            fill: '#16a34a',
                            fontSize: 12,
                          }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                Assumptions (from Settings): income growth{' '}
                {data.assumptions.incomeGrowthRatePct}% · expense inflation{' '}
                {data.assumptions.expenseInflationPct}% · portfolio return{' '}
                {data.assumptions.portfolioReturnPct}%
              </p>
            </div>

            {/* Projection table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 overflow-x-auto">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Projected view
              </h2>
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-2 pr-3">Year</th>
                    <th className="py-2 pr-3">Age</th>
                    <th className="py-2 pr-3 text-right">Net worth</th>
                    <th className="py-2 pr-3 text-right">Freedom Income</th>
                    <th className="py-2 pr-3 text-right">Monthly</th>
                    <th className="py-2 pr-3 text-right">Expenses</th>
                    <th className="py-2 pr-3 text-right">Ratio</th>
                    <th className="py-2 text-right">Salary req.</th>
                  </tr>
                </thead>
                <tbody>
                  {data.projections.slice(0, 30).map((row) => (
                    <tr
                      key={row.year}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        row.isWorkOptional && row.year === data.workOptionalYear
                          ? 'bg-green-50 dark:bg-green-900/20 font-medium'
                          : 'text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      <td className="py-2 pr-3">
                        {row.year}
                        {row.year === data.workOptionalYear ? (
                          <span className="ml-2 text-[10px] uppercase text-green-700 dark:text-green-400">
                            Work Optional
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3">{row.age ?? '—'}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatGbp(row.projectedNetWorth)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatGbp(row.projectedFreedomIncome)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatGbp(row.projectedFreedomMonthly)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatGbp(row.projectedAnnualExpenses)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {formatPct(row.freedomRatio, 0)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatGbp(row.salaryRequired)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
