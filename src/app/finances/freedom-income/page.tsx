'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

function salaryYearChoices(historyYears: number[], currentYear: number): number[] {
  const fromHistory = historyYears.filter((y) => Number.isFinite(y));
  const min = Math.min(currentYear - 20, ...fromHistory, currentYear);
  const max = Math.max(currentYear + 2, ...fromHistory, currentYear);
  const years: number[] = [];
  for (let y = max; y >= min; y -= 1) years.push(y);
  return years;
}

const DATE_SELECT_CLASS =
  'px-2 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white';

export default function FreedomIncomePage() {
  const [data, setData] = useState<FreedomPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [salaryYear, setSalaryYear] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);
  const [salaryMessage, setSalaryMessage] = useState<string | null>(null);
  const [addDraftYear, setAddDraftYear] = useState<number | null>(null);
  const [addDraftMonth, setAddDraftMonth] = useState<number | null>(null);
  const skipSalaryBlurSave = useRef(false);

  const load = useCallback(async (opts?: { quiet?: boolean }) => {
    if (!opts?.quiet) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await fetch('/api/freedom-income', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load Freedom Income');
      setData(json as FreedomPayload);
      const nextYear = json.statementYear ?? new Date().getFullYear();
      setSalaryYear((prev) => prev ?? nextYear);
      setAddDraftYear((prev) => prev ?? nextYear);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      if (!opts?.quiet) setData(null);
    } finally {
      if (!opts?.quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSalaryAmount = async (id: number, rawValue: string) => {
    const monthly = parseFloat(rawValue.replace(/[£,\s]/g, ''));
    if (!Number.isFinite(monthly) || monthly < 0) {
      setSalaryMessage('Enter a valid monthly salary.');
      return;
    }
    setSavingSalary(true);
    setSalaryMessage(null);
    try {
      const res = await fetch('/api/salary-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, monthly_salary: monthly }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setEditingId(null);
      setEditingValue('');
      await load({ quiet: true });
    } catch (e: unknown) {
      setSalaryMessage(e instanceof Error ? e.message : 'Failed to save salary');
    } finally {
      setSavingSalary(false);
    }
  };

  const saveSalaryDate = async (id: number, year: number, month: number) => {
    setSavingSalary(true);
    setSalaryMessage(null);
    try {
      const res = await fetch('/api/salary-history', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, year, month }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update date');
      setSalaryYear(year);
      await load({ quiet: true });
    } catch (e: unknown) {
      setSalaryMessage(e instanceof Error ? e.message : 'Failed to update date');
    } finally {
      setSavingSalary(false);
    }
  };

  const deleteSalaryEntry = async (id: number) => {
    setSavingSalary(true);
    setSalaryMessage(null);
    try {
      const res = await fetch(`/api/salary-history?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete');
      setEditingId(null);
      await load({ quiet: true });
    } catch (e: unknown) {
      setSalaryMessage(e instanceof Error ? e.message : 'Failed to delete salary');
    } finally {
      setSavingSalary(false);
    }
  };

  const addSalaryForMonth = async (year: number, month: number, rawValue: string) => {
    const monthly = parseFloat(rawValue.replace(/[£,\s]/g, ''));
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
          year,
          month,
          monthly_salary: monthly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      setEditingId(null);
      setEditingValue('');
      setSalaryYear(year);
      setAddDraftYear(year);
      setAddDraftMonth(null);
      await load({ quiet: true });
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
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Monthly salary
              </h2>
              {(() => {
                const currentYear = new Date().getFullYear();
                const historyYears = (data.salaryHistory || []).map((r) => Number(r.year));
                const years = Array.from(
                  new Set([
                    currentYear,
                    currentYear - 1,
                    ...historyYears,
                    salaryYear ?? currentYear,
                  ].filter((y) => Number.isFinite(y)))
                ).sort((a, b) => b - a);
                const yearChoices = salaryYearChoices(historyYears, currentYear);
                const activeYear = salaryYear ?? years[0];
                const yearEntries = (data.salaryHistory || [])
                  .filter((r) => Number(r.year) === activeYear)
                  .slice()
                  .sort((a, b) => Number(a.month) - Number(b.month));
                const addYear = addDraftYear ?? activeYear;
                const usedMonthsForAddYear = new Set(
                  (data.salaryHistory || [])
                    .filter((r) => Number(r.year) === addYear)
                    .map((r) => Number(r.month))
                );
                const yearTotal = yearEntries.reduce(
                  (sum, r) => sum + (Number(r.monthly_salary) || 0),
                  0
                );

                return (
                  <>
                    <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex flex-wrap gap-x-4">
                        {years.map((year) => (
                          <button
                            key={year}
                            type="button"
                            onClick={() => {
                              setSalaryYear(year);
                              setAddDraftYear(year);
                              setAddDraftMonth(null);
                              setEditingId(null);
                              setEditingValue('');
                              setSalaryMessage(null);
                            }}
                            className={`px-4 py-2 font-semibold transition-colors border-b-2 ${
                              activeYear === year
                                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                          >
                            {year}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Monthly salary
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {yearEntries.length === 0 ? (
                            <tr>
                              <td
                                colSpan={3}
                                className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400 text-center"
                              >
                                No salary entries for {activeYear}. Add a month below.
                              </td>
                            </tr>
                          ) : (
                            yearEntries.map((row) => {
                              const id = Number(row.id);
                              const month = Number(row.month);
                              const year = Number(row.year);
                              const value = Number(row.monthly_salary);
                              const isEditing = editingId === id;
                              const usedMonthsForRowYear = new Set(
                                (data.salaryHistory || [])
                                  .filter((r) => Number(r.year) === year && Number(r.id) !== id)
                                  .map((r) => Number(r.month))
                              );
                              const takenYearsForMonth = new Set(
                                (data.salaryHistory || [])
                                  .filter((r) => Number(r.month) === month && Number(r.id) !== id)
                                  .map((r) => Number(r.year))
                              );
                              return (
                                <tr key={id}>
                                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                                    <div className="flex gap-2">
                                      <select
                                        value={month}
                                        disabled={savingSalary}
                                        onChange={(e) => {
                                          const m = parseInt(e.target.value, 10);
                                          if (!Number.isFinite(m) || m === month) return;
                                          void saveSalaryDate(id, year, m);
                                        }}
                                        className={DATE_SELECT_CLASS}
                                      >
                                        {MONTH_NAMES.map((name, idx) => {
                                          const m = idx + 1;
                                          return (
                                            <option
                                              key={name}
                                              value={m}
                                              disabled={usedMonthsForRowYear.has(m)}
                                            >
                                              {name}
                                            </option>
                                          );
                                        })}
                                      </select>
                                      <select
                                        value={year}
                                        disabled={savingSalary}
                                        onChange={(e) => {
                                          const y = parseInt(e.target.value, 10);
                                          if (!Number.isFinite(y) || y === year) return;
                                          void saveSalaryDate(id, y, month);
                                        }}
                                        className={DATE_SELECT_CLASS}
                                      >
                                        {yearChoices.map((y) => (
                                          <option
                                            key={y}
                                            value={y}
                                            disabled={takenYearsForMonth.has(y)}
                                          >
                                            {y}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right text-sm tabular-nums">
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editingValue}
                                        disabled={savingSalary}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        onBlur={() => {
                                          if (skipSalaryBlurSave.current) {
                                            skipSalaryBlurSave.current = false;
                                            return;
                                          }
                                          if (editingValue.trim() === '') {
                                            setEditingId(null);
                                            return;
                                          }
                                          void saveSalaryAmount(id, editingValue);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            e.preventDefault();
                                            void saveSalaryAmount(id, editingValue);
                                          }
                                          if (e.key === 'Escape') {
                                            skipSalaryBlurSave.current = true;
                                            setEditingId(null);
                                            setEditingValue('');
                                          }
                                        }}
                                        className="w-36 ml-auto block px-3 py-1.5 text-right rounded-lg border border-blue-400 dark:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        className="w-full text-right text-gray-900 dark:text-white"
                                        onClick={() => {
                                          if (savingSalary) return;
                                          setEditingId(id);
                                          setEditingValue(Number.isFinite(value) ? String(value) : '');
                                          setSalaryMessage(null);
                                        }}
                                      >
                                        {Number.isFinite(value) ? formatGbp(value, 2) : '—'}
                                      </button>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button
                                      type="button"
                                      disabled={savingSalary}
                                      onClick={() => void deleteSalaryEntry(id)}
                                      className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                    >
                                      Delete
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                          <tr>
                              <td className="px-4 py-3 text-sm whitespace-nowrap">
                                <div className="flex gap-2">
                                  <select
                                    value={addDraftMonth ?? ''}
                                    disabled={savingSalary}
                                    onChange={(e) => {
                                      const m = parseInt(e.target.value, 10);
                                      setAddDraftMonth(Number.isFinite(m) ? m : null);
                                      setSalaryMessage(null);
                                    }}
                                    className={DATE_SELECT_CLASS}
                                  >
                                    <option value="" disabled>
                                      Month
                                    </option>
                                    {MONTH_NAMES.map((name, idx) => {
                                      const m = idx + 1;
                                      return (
                                        <option
                                          key={name}
                                          value={m}
                                          disabled={usedMonthsForAddYear.has(m)}
                                        >
                                          {name}
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <select
                                    value={addYear}
                                    disabled={savingSalary}
                                    onChange={(e) => {
                                      const y = parseInt(e.target.value, 10);
                                      if (!Number.isFinite(y)) return;
                                      setAddDraftYear(y);
                                      setAddDraftMonth(null);
                                      setSalaryMessage(null);
                                    }}
                                    className={DATE_SELECT_CLASS}
                                  >
                                    {yearChoices.map((y) => (
                                      <option key={y} value={y}>
                                        {y}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="text"
                                  placeholder="0.00"
                                  disabled={savingSalary}
                                  id="add-salary-amount"
                                  className="w-36 ml-auto block px-3 py-1.5 text-right rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  onKeyDown={(e) => {
                                    if (e.key !== 'Enter') return;
                                    if (addDraftMonth == null) {
                                      setSalaryMessage('Choose a month first.');
                                      return;
                                    }
                                    void addSalaryForMonth(
                                      addYear,
                                      addDraftMonth,
                                      (e.target as HTMLInputElement).value
                                    );
                                  }}
                                />
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  disabled={savingSalary}
                                  onClick={() => {
                                    const amountEl = document.getElementById(
                                      'add-salary-amount'
                                    ) as HTMLInputElement | null;
                                    if (addDraftMonth == null) {
                                      setSalaryMessage('Choose a month first.');
                                      return;
                                    }
                                    void addSalaryForMonth(
                                      addYear,
                                      addDraftMonth,
                                      amountEl?.value || ''
                                    );
                                  }}
                                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Add
                                </button>
                              </td>
                            </tr>
                          <tr className="font-semibold bg-gray-50 dark:bg-gray-700">
                            <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">Year total</td>
                            <td className="px-4 py-3 text-right text-sm tabular-nums text-gray-900 dark:text-white">
                              {formatGbp(yearTotal, 2)}
                            </td>
                            <td />
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    {salaryMessage && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-2">{salaryMessage}</p>
                    )}
                  </>
                );
              })()}
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
              <h2
                className={`text-lg font-semibold text-gray-900 dark:text-white ${
                  data.workOptionalYear != null ? 'mb-1' : 'mb-4'
                }`}
              >
                Projected Freedom Income vs expenses
              </h2>
              {data.workOptionalYear != null ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Work Optional marked at {data.workOptionalYear}.
                </p>
              ) : null}
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
