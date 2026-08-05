'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface IncomeSource {
  id: number;
  name: string;
  income_type_id: number;
  income_type_name: string;
  account_id: number | null;
  account_name: string | null;
  isbusinessincome: boolean | null;
}

interface AccountBalance {
  id: number;
  account_id: number;
  account_name: string;
  balance: number | null;
  year: number;
  month: number;
}

interface Account {
  id: number;
  name: string;
  investment_type_id: number | null;
  investment_type_name: string | null;
  investment_type_order: number | null;
}

interface BusinessAccountCol {
  accountId: number;
  accountName: string;
  /** Business income source feeding this account, when one exists. */
  sourceName: string | null;
  /** Cash / income accounts count toward monthly profit; inventory does not. */
  includeInProfit: boolean;
}

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

function formatGbp(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  const abs = Math.abs(amount);
  const formatted = `£${abs.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return amount < 0 ? `-${formatted}` : formatted;
}

function moneyClass(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount === 0) {
    return 'text-gray-500 dark:text-gray-400';
  }
  return amount > 0
    ? 'text-green-700 dark:text-green-400'
    : 'text-red-700 dark:text-red-400';
}

export default function BusinessPage() {
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [sources, setSources] = useState<IncomeSource[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [priorYearBalances, setPriorYearBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchYears = async () => {
      try {
        const res = await fetch('/api/monthly-account-balances/years');
        if (!res.ok) throw new Error('Failed to fetch years');
        const data = await res.json();
        const years: number[] = (data.years || []).map((y: number | string) => Number(y));
        if (years.length) {
          setAvailableYears(years);
          setSelectedYear(Math.max(...years));
        } else {
          const y = new Date().getFullYear();
          setAvailableYears([y]);
          setSelectedYear(y);
        }
      } catch (err) {
        console.error(err);
        const y = new Date().getFullYear();
        setAvailableYears([y, y - 1]);
      }
    };
    void fetchYears();
  }, []);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await fetch('/api/income-sources');
        if (!res.ok) throw new Error('Failed to fetch income sources');
        const data = await res.json();
        setSources(data.data || []);
      } catch (err) {
        console.error(err);
        setError('Failed to load business sources');
      }
    };
    void fetchSources();
  }, []);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/accounts');
        if (!res.ok) throw new Error('Failed to fetch accounts');
        const data = await res.json();
        setAccounts(data.data || []);
      } catch (err) {
        console.error(err);
      }
    };
    void fetchAccounts();
  }, []);

  const loadBalances = useCallback(async (year: number) => {
    setLoading(true);
    setError(null);
    try {
      const [currRes, priorRes] = await Promise.all([
        fetch(`/api/monthly-account-balances?year=${year}`),
        fetch(`/api/monthly-account-balances?year=${year - 1}`),
      ]);
      if (!currRes.ok) throw new Error('Failed to fetch balances');
      const curr = await currRes.json();
      setBalances(curr.data || []);
      if (priorRes.ok) {
        const prior = await priorRes.json();
        setPriorYearBalances(prior.data || []);
      } else {
        setPriorYearBalances([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load account balances');
      setBalances([]);
      setPriorYearBalances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedYear) void loadBalances(selectedYear);
  }, [selectedYear, loadBalances]);

  const businessAccounts: BusinessAccountCol[] = useMemo(() => {
    const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim();
    const isInventoryAccount = (name: string) =>
      /inventory/i.test(cleanName(name));
    const byAccount = new Map<number, BusinessAccountCol>();

    for (const source of sources) {
      if (!source.isbusinessincome || source.account_id == null) continue;
      if (byAccount.has(source.account_id)) continue;
      const accountName = cleanName(source.account_name || source.name);
      byAccount.set(source.account_id, {
        accountId: source.account_id,
        accountName,
        sourceName: source.name,
        includeInProfit: !isInventoryAccount(accountName),
      });
    }

    // Sibling accounts in the same investment type (e.g. Inventory Value) hold
    // company value even though no income source posts entries against them.
    const businessTypeIds = new Set(
      accounts
        .filter((a) => byAccount.has(a.id) && a.investment_type_id != null)
        .map((a) => a.investment_type_id as number)
    );
    for (const account of accounts) {
      if (byAccount.has(account.id)) continue;
      if (account.investment_type_id == null) continue;
      if (!businessTypeIds.has(account.investment_type_id)) continue;
      const accountName = cleanName(account.name);
      byAccount.set(account.id, {
        accountId: account.id,
        accountName,
        sourceName: null,
        includeInProfit: !isInventoryAccount(accountName),
      });
    }

    return [...byAccount.values()].sort((a, b) =>
      a.accountName.localeCompare(b.accountName, 'en')
    );
  }, [sources, accounts]);

  const balanceLookup = useMemo(() => {
    const map = new Map<string, number>();
    const add = (rows: AccountBalance[]) => {
      for (const row of rows) {
        if (row.balance == null || !Number.isFinite(row.balance)) continue;
        map.set(`${row.account_id}-${row.year}-${row.month}`, row.balance);
      }
    };
    add(balances);
    add(priorYearBalances);
    return map;
  }, [balances, priorYearBalances]);

  const monthRows = useMemo(() => {
    const getBal = (accountId: number, year: number, month: number): number | null => {
      const v = balanceLookup.get(`${accountId}-${year}-${month}`);
      return v == null ? null : v;
    };
    const getPrior = (accountId: number, year: number, month: number): number | null => {
      if (month > 1) return getBal(accountId, year, month - 1);
      return getBal(accountId, year - 1, 12);
    };

    return MONTH_NAMES.map((name, idx) => {
      const month = idx + 1;
      const accountBalances = businessAccounts.map((col) => ({
        accountId: col.accountId,
        includeInProfit: col.includeInProfit,
        balance: getBal(col.accountId, selectedYear, month),
        prior: getPrior(col.accountId, selectedYear, month),
      }));

      let companyValue = 0;
      let hasAnyBalance = false;
      let profit = 0;
      let hasAnyProfit = false;
      let monthlyValuation = 0;
      let hasAnyValuation = false;

      for (const cell of accountBalances) {
        if (cell.balance != null) {
          hasAnyBalance = true;
          companyValue += cell.balance;
        }
        if (cell.balance != null && cell.prior != null) {
          const delta = cell.balance - cell.prior;
          hasAnyValuation = true;
          monthlyValuation += delta;
          if (cell.includeInProfit) {
            hasAnyProfit = true;
            profit += delta;
          }
        }
      }

      const pctOfCompany =
        hasAnyProfit && hasAnyBalance && companyValue !== 0
          ? (profit / companyValue) * 100
          : null;

      return {
        month,
        name,
        accountBalances,
        companyValue: hasAnyBalance ? companyValue : null,
        profit: hasAnyProfit ? profit : null,
        monthlyValuation: hasAnyValuation ? monthlyValuation : null,
        pctOfCompany,
      };
    });
  }, [businessAccounts, selectedYear, balanceLookup]);

  const yearSummary = useMemo(() => {
    const getBal = (accountId: number, year: number, month: number): number | null => {
      const v = balanceLookup.get(`${accountId}-${year}-${month}`);
      return v == null ? null : v;
    };

    const companyValueFor = (year: number, month: number): number | null => {
      let total = 0;
      let hasAny = false;
      for (const col of businessAccounts) {
        const bal = getBal(col.accountId, year, month);
        if (bal != null) {
          hasAny = true;
          total += bal;
        }
      }
      return hasAny ? total : null;
    };

    let profitTotal = 0;
    let hasProfit = false;
    let valuationTotal = 0;
    let hasValuation = false;
    let latestCompanyValue: number | null = null;
    let latestMonth: number | null = null;

    for (const row of monthRows) {
      if (row.profit != null) {
        hasProfit = true;
        profitTotal += row.profit;
      }
      if (row.monthlyValuation != null) {
        hasValuation = true;
        valuationTotal += row.monthlyValuation;
      }
      if (row.companyValue != null) {
        latestCompanyValue = row.companyValue;
        latestMonth = row.month;
      }
    }

    const priorDecCompanyValue = companyValueFor(selectedYear - 1, 12);
    const yoyPct =
      latestCompanyValue != null &&
      priorDecCompanyValue != null &&
      priorDecCompanyValue !== 0
        ? ((latestCompanyValue - priorDecCompanyValue) / priorDecCompanyValue) * 100
        : null;

    const companyValueChange =
      latestCompanyValue != null && priorDecCompanyValue != null
        ? latestCompanyValue - priorDecCompanyValue
        : hasValuation
          ? valuationTotal
          : null;

    return {
      profitTotal: hasProfit ? profitTotal : null,
      valuationTotal: hasValuation ? valuationTotal : null,
      latestCompanyValue,
      latestMonth,
      priorDecCompanyValue,
      companyValueChange,
      yoyPct,
    };
  }, [businessAccounts, selectedYear, balanceLookup, monthRows]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-2 dark:bg-gray-900 sm:px-4 lg:px-6">
      <div className="w-full">
        <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            {availableYears.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`border-b-2 px-4 py-2 font-semibold transition-colors ${
                  selectedYear === year
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-600 dark:text-gray-400">Loading…</div>
        ) : error ? (
          <div className="py-12 text-center text-red-600 dark:text-red-400">{error}</div>
        ) : businessAccounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500 dark:border-gray-700">
            No business income sources are linked to accounts yet. Link eBay / Vinted / etc. on an
            income source with <code className="text-xs">account_id</code> to populate this grid.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full table-fixed divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="sticky left-0 z-10 w-32 bg-gray-50 px-3 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-300">
                    Month
                  </th>
                  {businessAccounts.map((col) => (
                    <th
                      key={col.accountId}
                      className="w-32 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300"
                      title={
                        col.sourceName
                          ? `Income source: ${col.sourceName}`
                          : 'Business account with no linked income source'
                      }
                    >
                      {col.accountName}
                    </th>
                  ))}
                  <th className="w-32 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    <span className="block">Company</span>
                    <span className="block">value</span>
                  </th>
                  <th
                    className="w-32 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300"
                    title="Month-over-month change excluding inventory"
                  >
                    <span className="block">Monthly</span>
                    <span className="block">profit</span>
                  </th>
                  <th
                    className="w-32 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300"
                    title="Month-over-month change including inventory"
                  >
                    <span className="block">Monthly company</span>
                    <span className="block">valuation</span>
                  </th>
                  <th className="w-32 px-3 py-3 text-center text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-300">
                    <span className="block">% of company</span>
                    <span className="block">value</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {monthRows.map((row) => (
                  <tr key={row.month} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2.5 text-center text-sm font-semibold text-gray-900 dark:bg-gray-900 dark:text-white">
                      {row.name}
                    </td>
                    {row.accountBalances.map((cell) => (
                      <td
                        key={`${row.month}-${cell.accountId}`}
                        className="px-3 py-2.5 text-center text-sm tabular-nums text-gray-800 dark:text-gray-200"
                      >
                        {formatGbp(cell.balance)}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center text-sm font-medium tabular-nums text-gray-900 dark:text-white">
                      {formatGbp(row.companyValue)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums ${moneyClass(row.profit)}`}
                    >
                      {formatGbp(row.profit)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums ${moneyClass(row.monthlyValuation)}`}
                    >
                      {formatGbp(row.monthlyValuation)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-center text-sm font-semibold tabular-nums ${moneyClass(row.pctOfCompany)}`}
                    >
                      {row.pctOfCompany == null
                        ? '—'
                        : `${row.pctOfCompany > 0 ? '+' : ''}${row.pctOfCompany.toFixed(1)}%`}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-100 font-bold dark:border-gray-600 dark:bg-gray-800">
                  <td className="sticky left-0 z-10 bg-gray-100 px-3 py-3 text-center text-sm text-gray-900 dark:bg-gray-800 dark:text-white">
                    Year
                    {yearSummary.latestMonth != null ? (
                      <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                        (vs Dec {selectedYear - 1})
                      </span>
                    ) : null}
                  </td>
                  {businessAccounts.map((col) => (
                    <td
                      key={`year-${col.accountId}`}
                      className="px-3 py-3 text-center text-sm tabular-nums text-gray-400 dark:text-gray-500"
                    >
                      —
                    </td>
                  ))}
                  <td
                    className={`px-3 py-3 text-center text-sm tabular-nums ${moneyClass(yearSummary.companyValueChange)}`}
                    title={
                      yearSummary.latestCompanyValue != null &&
                      yearSummary.priorDecCompanyValue != null
                        ? `Latest ${formatGbp(yearSummary.latestCompanyValue)} − Dec ${selectedYear - 1} ${formatGbp(yearSummary.priorDecCompanyValue)}`
                        : undefined
                    }
                  >
                    {formatGbp(yearSummary.companyValueChange)}
                  </td>
                  <td
                    className={`px-3 py-3 text-center text-sm tabular-nums ${moneyClass(yearSummary.profitTotal)}`}
                    title="Year-to-date profit excluding inventory"
                  >
                    {formatGbp(yearSummary.profitTotal)}
                  </td>
                  <td
                    className={`px-3 py-3 text-center text-sm tabular-nums ${moneyClass(yearSummary.valuationTotal)}`}
                    title="Year-to-date company valuation change including inventory"
                  >
                    {formatGbp(yearSummary.valuationTotal)}
                  </td>
                  <td
                    className={`px-3 py-3 text-center text-sm tabular-nums ${moneyClass(yearSummary.yoyPct)}`}
                    title={
                      yearSummary.latestCompanyValue != null &&
                      yearSummary.priorDecCompanyValue != null
                        ? `Increase from Dec ${selectedYear - 1} (${formatGbp(yearSummary.priorDecCompanyValue)}) to latest (${formatGbp(yearSummary.latestCompanyValue)})`
                        : undefined
                    }
                  >
                    {yearSummary.yoyPct == null
                      ? '—'
                      : `${yearSummary.yoyPct > 0 ? '+' : ''}${yearSummary.yoyPct.toFixed(1)}%`}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
