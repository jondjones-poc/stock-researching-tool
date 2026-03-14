'use client';

import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';

type CombinedTargetPotRow = {
  year: number;
  age: number;
  cashflowIncome: number | null;
  portfolioValue: number;
  totalPortfolioValue: number | null;
  withdrawalAmount: number | null;
  portfolioWithBusiness?: number | null;
};
type TargetPotRow = { year: number; portfolioValue?: number; withdrawalAmount?: number };
type CashflowRow = { year: number; age: number; projectedMonthlyCashflow: number };
type DividendsRow = { year: number; age: number; monthlyLivingCost: number; monthlyDividendIncome: number };

export default function RetirementReportsPage() {
  const [combinedTargetPotData, setCombinedTargetPotData] = useState<CombinedTargetPotRow[]>([]);
  const [combinedTargetPotLoading, setCombinedTargetPotLoading] = useState(true);
  const [combinedTargetPotError, setCombinedTargetPotError] = useState<string | null>(null);

  const [targetPotData, setTargetPotData] = useState<TargetPotRow[]>([]);
  const [targetPotLoading, setTargetPotLoading] = useState(true);
  const [targetPotError, setTargetPotError] = useState<string | null>(null);

  const [cashflowData, setCashflowData] = useState<CashflowRow[]>([]);
  const [cashflowLoading, setCashflowLoading] = useState(true);
  const [cashflowError, setCashflowError] = useState<string | null>(null);

  const [dividendsData, setDividendsData] = useState<DividendsRow[]>([]);
  const [dividendsLoading, setDividendsLoading] = useState(true);
  const [dividendsError, setDividendsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/combined-target-pot')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        setCombinedTargetPotData(Array.isArray(json.data) ? json.data : []);
      })
      .catch((err) => { if (!cancelled) setCombinedTargetPotError(err.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setCombinedTargetPotLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/target-pot-projections')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        const acc = json.accumulation ?? {};
        const dd = json.drawdown ?? {};
        const accYears = acc.years ?? [];
        const accValues = acc.portfolioValue ?? [];
        const ddYears = dd.years ?? [];
        const ddValues = dd.portfolioValue ?? [];
        const ddWithdrawal = dd.withdrawalAmount ?? [];
        const byYear = new Map<number, TargetPotRow>();
        accYears.forEach((y: number, i: number) => {
          byYear.set(y, { year: y, portfolioValue: accValues[i], withdrawalAmount: undefined });
        });
        ddYears.forEach((y: number, i: number) => {
          const existing = byYear.get(y);
          byYear.set(y, {
            year: y,
            portfolioValue: ddValues[i] ?? existing?.portfolioValue,
            withdrawalAmount: ddWithdrawal[i],
          });
        });
        setTargetPotData(Array.from(byYear.values()).sort((a, b) => a.year - b.year));
      })
      .catch((err) => { if (!cancelled) setTargetPotError(err.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setTargetPotLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/cashflow-projections')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        const years = json.years ?? [];
        const ages = json.ages ?? [];
        const projectedMonthlyCashflow = json.projectedMonthlyCashflow ?? [];
        setCashflowData(
          years.map((year: number, i: number) => ({
            year,
            age: ages[i] ?? 0,
            projectedMonthlyCashflow: projectedMonthlyCashflow[i] ?? 0,
          }))
        );
      })
      .catch((err) => { if (!cancelled) setCashflowError(err.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setCashflowLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/reporting/dividends-projections')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(res.statusText))))
      .then((json) => {
        if (cancelled) return;
        const years = json.years ?? [];
        const ages = json.ages ?? [];
        const monthlyLivingCost = json.monthlyLivingCost ?? [];
        const monthlyDividendIncome = json.monthlyDividendIncome ?? [];
        setDividendsData(
          years.map((year: number, i: number) => ({
            year,
            age: ages[i] ?? 0,
            monthlyLivingCost: monthlyLivingCost[i] ?? 0,
            monthlyDividendIncome: monthlyDividendIncome[i] ?? 0,
          }))
        );
      })
      .catch((err) => { if (!cancelled) setDividendsError(err.message ?? 'Failed to load'); })
      .finally(() => { if (!cancelled) setDividendsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const formatAxisMoney = (v: number) =>
    v >= 1_000_000 ? `£${(v / 1_000_000).toFixed(1)}m` : `£${(v / 1000).toFixed(0)}k`;

  const fmt = (n: number | null | undefined) =>
    n != null && Number.isFinite(n) ? `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Retirement Reports
        </h1>
        <hr className="border-gray-200 dark:border-gray-700 mb-10" />

        {/* 0. Combined Summary (from finances/retirement-by-target-pot Summary tab) */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Retirement by Target Pot (Summary)
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Portfolio Value (pre-retirement); then Portfolio with Business and Withdrawal Amount (post-retirement).
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {combinedTargetPotLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">Loading…</div>
            ) : combinedTargetPotError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">{combinedTargetPotError}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={combinedTargetPotData.map((r) => ({
                    ...r,
                    portfolioDisplay: r.cashflowIncome != null ? r.portfolioValue : (r.portfolioWithBusiness ?? r.portfolioValue),
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" />
                  <YAxis yAxisId="left" tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" tickFormatter={formatAxisMoney} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tw-bg-opacity)', border: '1px solid #e5e7eb' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as CombinedTargetPotRow & { portfolioDisplay?: number };
                      const isDrawdown = p.cashflowIncome == null;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">Year {label} (Age {p.age})</div>
                          <div className="text-gray-600 dark:text-gray-300">
                            {isDrawdown ? 'Portfolio with Business: ' : 'Portfolio Value: '}
                            {fmt(isDrawdown ? p.portfolioWithBusiness : p.portfolioValue)}
                          </div>
                          {isDrawdown && <div className="text-gray-600 dark:text-gray-300">Withdrawal Amount: {fmt(p.withdrawalAmount)}</div>}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="portfolioDisplay" name="Portfolio Value / Portfolio with Business" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  <Line yAxisId="left" type="monotone" dataKey="withdrawalAmount" name="Withdrawal Amount" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 1. Retirement by Target Pot */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Retirement by Target Pot
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Portfolio value until retirement, then portfolio value after retirement and withdrawal amount by year.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {targetPotLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">Loading…</div>
            ) : targetPotError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">{targetPotError}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={targetPotData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" />
                  <YAxis yAxisId="left" tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" tickFormatter={formatAxisMoney} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tw-bg-opacity)', border: '1px solid #e5e7eb' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">Year {label}</div>
                          {payload.map((entry) => (
                            <div key={entry.dataKey} className="text-gray-600 dark:text-gray-300">
                              {entry.name}: {entry.value != null && Number.isFinite(entry.value as number)
                                ? `£${Number(entry.value).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '—'}
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="portfolioValue" name="Portfolio Value" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  {targetPotData.some((r) => r.withdrawalAmount != null && Number.isFinite(r.withdrawalAmount)) && (
                    <Line yAxisId="left" type="monotone" dataKey="withdrawalAmount" name="Withdrawal Amount" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 2. Retirement by Cashflow */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Retirement by Cashflow
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Projected Monthly Cashflow by year.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {cashflowLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">Loading…</div>
            ) : cashflowError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">{cashflowError}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cashflowData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" />
                  <YAxis tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tw-bg-opacity)', border: '1px solid #e5e7eb' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as CashflowRow;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">Year {label} (Age {p.age})</div>
                          <div className="text-gray-600 dark:text-gray-300">
                            Projected Monthly Cashflow: £{p.projectedMonthlyCashflow.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="projectedMonthlyCashflow" name="Projected Monthly Cashflow" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* 3. Retirement by Dividends */}
        <section>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Retirement by Dividends
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Monthly Living Cost vs Monthly Available Dividend Income by year.
          </p>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[500px]">
            {dividendsLoading ? (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">Loading…</div>
            ) : dividendsError ? (
              <div className="h-full flex items-center justify-center text-red-600 dark:text-red-400">{dividendsError}</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dividendsData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-600" />
                  <XAxis dataKey="year" type="number" domain={['dataMin', 'dataMax']} tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" />
                  <YAxis tick={{ fill: 'currentColor' }} className="text-gray-700 dark:text-gray-300" tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--tw-bg-opacity)', border: '1px solid #e5e7eb' }}
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length || !payload[0]?.payload) return null;
                      const p = payload[0].payload as DividendsRow;
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg px-3 py-2 text-sm">
                          <div className="font-semibold text-white bg-gray-700 dark:bg-gray-900 -mx-3 -mt-2 px-3 py-2 rounded-t-lg mb-1">Year {label} (Age {p.age})</div>
                          <div className="text-gray-600 dark:text-gray-300">Monthly Living Cost: £{p.monthlyLivingCost.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-gray-600 dark:text-gray-300">Monthly Available Dividend Income: £{p.monthlyDividendIncome.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="monthlyLivingCost" name="Monthly Living Cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="monthlyDividendIncome" name="Monthly Available Dividend Income" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
