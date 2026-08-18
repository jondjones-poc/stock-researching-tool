export type FreedomIncomeBreakdownRow = {
  incomeTypeId: number;
  name: string;
  annual: number;
  monthly: number;
  percentOfFreedom: number;
  isBusiness: boolean;
};

export type FreedomIncomeProjectionRow = {
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

export type FreedomIncomeAssumptions = {
  incomeGrowthRatePct: number;
  expenseInflationPct: number;
  portfolioReturnPct: number;
  currentAge: number | null;
  retirementAge: number | null;
  monthlyLivingCost: number | null;
  statementMonth: number;
  statementYear: number;
};

export function entryAmount(entry: {
  account_id?: number | null;
  current_month_balance?: number | string | null;
  previous_month_balance?: number | string | null;
  price: number | string;
}): number {
  if (
    entry.account_id != null &&
    entry.current_month_balance != null &&
    entry.current_month_balance !== undefined &&
    entry.previous_month_balance != null &&
    entry.previous_month_balance !== undefined
  ) {
    return (
      parseFloat(String(entry.current_month_balance)) -
      parseFloat(String(entry.previous_month_balance))
    );
  }
  return parseFloat(String(entry.price)) || 0;
}

type NetworthReport = {
  year?: number;
  categories?: string[];
  monthData?: Record<number | string, Record<string, number>>;
  monthsWithData?: number[];
  categoryRules?: Record<string, string>;
};

function findCategory(
  categories: string[] | undefined,
  test: (lower: string) => boolean
): string | null {
  if (!categories?.length) return null;
  return categories.find((c) => test(c.toLowerCase().trim())) ?? null;
}

function monthRow(
  report: NetworthReport | null | undefined,
  month: number
): Record<string, number> | null {
  if (!report?.monthData) return null;
  const direct = report.monthData[month] ?? report.monthData[String(month)];
  if (direct) return direct;
  for (const [key, row] of Object.entries(report.monthData)) {
    if (Number(key) === month) return row;
  }
  return null;
}

function categoryValue(
  report: NetworthReport | null | undefined,
  category: string | null,
  month: number
): number {
  if (!category) return 0;
  const row = monthRow(report, month);
  if (!row) return 0;
  if (row[category] != null) return Number(row[category]) || 0;
  const match = Object.keys(row).find(
    (key) => key.toLowerCase().trim() === category.toLowerCase().trim()
  );
  return match ? Number(row[match]) || 0 : 0;
}

function findStockCategory(categories: string[] | undefined): string | null {
  return (
    findCategory(categories, (n) => n === 'stock value') ||
    findCategory(categories, (n) => n.includes('stock value') && !n.includes('total')) ||
    findCategory(categories, (n) => n === 'total stock value' || n.includes('stock value'))
  );
}

function findBusinessCategory(categories: string[] | undefined): string | null {
  return (
    findCategory(categories, (n) => n === 'business cash') ||
    findCategory(categories, (n) => n.includes('business') && n.includes('cash'))
  );
}

function lastMonthInReport(
  report: NetworthReport | null | undefined,
  currentYear: number,
  currentMonth: number
): number | null {
  if (!report) return null;
  const year = Number(report.year);
  const eligible = (report.monthsWithData || [])
    .map(Number)
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    .filter((m) => !Number.isFinite(year) || year < currentYear || m <= currentMonth)
    .sort((a, b) => b - a);
  return eligible[0] ?? null;
}

function sumTrackerForYear(
  entries: Array<{ month?: string; invested?: number | string }>,
  year: number,
  throughMonth?: number
): number {
  let total = 0;
  for (const e of entries) {
    const raw = String(e.month || '');
    const match = raw.match(/^(\d{4})-(\d{1,2})/);
    if (!match) continue;
    const entryYear = parseInt(match[1], 10);
    const entryMonth = parseInt(match[2], 10);
    if (entryYear !== year) continue;
    if (
      throughMonth != null &&
      Number.isFinite(entryMonth) &&
      entryMonth > throughMonth
    ) {
      continue;
    }
    const amount = parseFloat(String(e.invested));
    if (Number.isFinite(amount)) total += amount;
  }
  return total;
}

function openingMonth(report: NetworthReport | null | undefined): number {
  const months = (report?.monthsWithData || [])
    .map(Number)
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12);
  if (months.includes(12)) return 12;
  const latest = [...months].sort((a, b) => b - a)[0];
  return latest || 12;
}

/**
 * Freedom Income = Stock Value (year change) − investment contributions this year
 * + Business Cash (year change). Year change is latest statement vs December prior year.
 */
export function computeAssetFreedomIncome(opts: {
  networthCurr: NetworthReport | null;
  networthPrev: NetworthReport | null;
  networthStart?: NetworthReport | null;
  trackerCurr: Array<{ month?: string; invested?: number | string }>;
  trackerPrev: Array<{ month?: string; invested?: number | string }>;
  currentYear: number;
  currentMonth: number;
  allowPriorYearFallback?: boolean;
}): {
  statementYear: number;
  statementMonth: number;
  freedomAnnual: number;
  freedomMonthly: number;
  breakdown: FreedomIncomeBreakdownRow[];
  stockCategory: string | null;
  businessCategory: string | null;
} {
  const currLatest = lastMonthInReport(opts.networthCurr, opts.currentYear, opts.currentMonth);
  if (currLatest == null && opts.allowPriorYearFallback === false) {
    const emptyBreakdown: FreedomIncomeBreakdownRow[] = [];
    return {
      statementYear: opts.currentYear,
      statementMonth: opts.currentMonth,
      freedomAnnual: 0,
      freedomMonthly: 0,
      breakdown: emptyBreakdown,
      stockCategory: null,
      businessCategory: null,
    };
  }
  const prevLatest =
    opts.allowPriorYearFallback === false
      ? null
      : lastMonthInReport(opts.networthPrev, opts.currentYear, opts.currentMonth);
  const report = currLatest != null ? opts.networthCurr : opts.networthPrev;
  const statementMonth = currLatest ?? prevLatest ?? opts.currentMonth;
  const statementYear =
    currLatest != null
      ? Number(opts.networthCurr?.year) || opts.currentYear
      : Number(opts.networthPrev?.year) || opts.currentYear - 1;

  const startReport =
    Number(opts.networthCurr?.year) === statementYear
      ? opts.networthPrev
      : opts.networthStart ?? null;

  const categories = [
    ...(report?.categories || []),
    ...(startReport?.categories || []),
  ];
  const stockCategory = findStockCategory(categories);
  const businessCategory = findBusinessCategory(categories);

  const latestStock = categoryValue(report, stockCategory, statementMonth);
  const latestBusiness = categoryValue(report, businessCategory, statementMonth);
  const startMonth = openingMonth(startReport);
  const startStock = categoryValue(startReport, stockCategory, startMonth);
  const startBusiness = categoryValue(startReport, businessCategory, startMonth);

  const stockChange = latestStock - startStock;
  const businessChange = latestBusiness - startBusiness;
  const contributions = sumTrackerForYear(
    statementYear === opts.currentYear ? opts.trackerCurr : opts.trackerPrev,
    statementYear,
    statementMonth
  );

  const freedomAnnual = stockChange - contributions + businessChange;
  const freedomMonthly = freedomAnnual / 12;

  const rows: FreedomIncomeBreakdownRow[] = [
    {
      incomeTypeId: 1,
      name: `${stockCategory || 'Stock Value'} (year change)`,
      monthly: stockChange / 12,
      annual: stockChange,
      percentOfFreedom: 0,
      isBusiness: false,
    },
    {
      incomeTypeId: 2,
      name: 'Investment contributions',
      monthly: -contributions / 12,
      annual: -contributions,
      percentOfFreedom: 0,
      isBusiness: false,
    },
    {
      incomeTypeId: 3,
      name: `${businessCategory || 'Business Cash'} (year change)`,
      monthly: businessChange / 12,
      annual: businessChange,
      percentOfFreedom: 0,
      isBusiness: true,
    },
  ];
  for (const row of rows) {
    row.percentOfFreedom =
      freedomAnnual !== 0 ? (row.annual / freedomAnnual) * 100 : 0;
  }

  return {
    statementYear,
    statementMonth,
    freedomAnnual,
    freedomMonthly,
    breakdown: rows,
    stockCategory,
    businessCategory,
  };
}

type FreedomEntry = {
  income_source_id: number;
  income_type_id?: number | string;
  year: number | string;
  month: number | string;
  account_id?: number | null;
  current_month_balance?: number | string | null;
  previous_month_balance?: number | string | null;
  price: number | string;
};

/** Latest calendar month that has non-zero non-wage (Freedom) income. */
export function latestFreedomStatementMonth(
  types: Array<{ id: number; Is247wage?: boolean | null }>,
  sources: Array<{ id: number; income_type_id: number }>,
  entries: FreedomEntry[],
  currentYear: number,
  currentMonth: number
): { year: number; month: number } | null {
  const wageTypeIds = new Set(
    types.filter((t) => t.Is247wage === true).map((t) => Number(t.id))
  );
  const sourceTypeId = new Map(
    sources.map((s) => [Number(s.id), Number(s.income_type_id)])
  );

  let bestYm = 0;
  let best: { year: number; month: number } | null = null;

  for (const e of entries) {
    const typeId =
      e.income_type_id != null
        ? Number(e.income_type_id)
        : sourceTypeId.get(Number(e.income_source_id));
    if (typeId == null || !Number.isFinite(typeId) || wageTypeIds.has(typeId)) continue;

    const y = parseInt(String(e.year), 10);
    const m = parseInt(String(e.month), 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
    if (y > currentYear || (y === currentYear && m > currentMonth)) continue;

    const amount = entryAmount(e);
    if (!Number.isFinite(amount) || amount === 0) continue;

    const ym = y * 100 + m;
    if (ym > bestYm) {
      bestYm = ym;
      best = { year: y, month: m };
    }
  }

  return best;
}

export function buildFreedomBreakdown(
  types: Array<{
    id: number;
    name: string;
    Is247wage?: boolean | null;
    isbusinessincome?: boolean | null;
  }>,
  sources: Array<{ id: number; income_type_id: number }>,
  entries: FreedomEntry[],
  statementYear: number,
  statementMonth: number
): FreedomIncomeBreakdownRow[] {
  const freedomTypes = types.filter((t) => t.Is247wage !== true);
  const rows: FreedomIncomeBreakdownRow[] = [];

  for (const type of freedomTypes) {
    const typeSources = sources.filter((s) => s.income_type_id === type.id);
    let monthly = 0;
    for (const src of typeSources) {
      const entry = entries.find(
        (e) =>
          e.income_source_id === src.id &&
          parseInt(String(e.year), 10) === statementYear &&
          parseInt(String(e.month), 10) === statementMonth
      );
      if (entry) monthly += entryAmount(entry);
    }
    if (monthly === 0) continue;
    rows.push({
      incomeTypeId: type.id,
      name: type.name.trim() || `Type ${type.id}`,
      monthly,
      annual: monthly * 12,
      percentOfFreedom: 0,
      isBusiness: type.isbusinessincome === true,
    });
  }

  const freedomAnnual = rows.reduce((sum, r) => sum + r.annual, 0);
  for (const row of rows) {
    row.percentOfFreedom =
      freedomAnnual > 0 ? (row.annual / freedomAnnual) * 100 : 0;
  }

  rows.sort((a, b) => b.annual - a.annual);
  return rows;
}

export function wageMonthlyTotal(
  types: Array<{ id: number; Is247wage?: boolean | null }>,
  sources: Array<{ id: number; income_type_id: number }>,
  entries: Array<{
    income_source_id: number;
    year: number | string;
    month: number | string;
    account_id?: number | null;
    current_month_balance?: number | string | null;
    previous_month_balance?: number | string | null;
    price: number | string;
  }>,
  statementYear: number,
  statementMonth: number
): number {
  let total = 0;
  for (const type of types.filter((t) => t.Is247wage === true)) {
    for (const src of sources.filter((s) => s.income_type_id === type.id)) {
      const entry = entries.find(
        (e) =>
          e.income_source_id === src.id &&
          parseInt(String(e.year), 10) === statementYear &&
          parseInt(String(e.month), 10) === statementMonth
      );
      if (entry) total += entryAmount(entry);
    }
  }
  return total;
}

/** Average monthly salary from all payments in the last 24 months. */
export function currentSalaryFromHistory(
  rows: Array<{
    year: number | string;
    month: number | string;
    monthly_salary: string | number;
  }>
): { monthly: number; annual: number } | null {
  let latestYm = 0;
  for (const r of rows) {
    const y = Number(r.year);
    const m = Number(r.month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
    const ym = y * 12 + m;
    if (ym > latestYm) latestYm = ym;
  }
  if (latestYm === 0) return null;

  const startYm = latestYm - 23;
  const byMonth = new Map<number, number>();
  for (const r of rows) {
    const y = Number(r.year);
    const m = Number(r.month);
    if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
    const ym = y * 12 + m;
    if (ym < startYm || ym > latestYm) continue;
    const amount = parseFloat(String(r.monthly_salary)) || 0;
    byMonth.set(ym, (byMonth.get(ym) || 0) + amount);
  }

  if (byMonth.size === 0) return null;

  let total = 0;
  for (const amount of byMonth.values()) total += amount;
  const monthly = total / byMonth.size;
  return { monthly, annual: monthly * 12 };
}

export function netWorthFromReport(
  report: NetworthReport | null | undefined,
  month: number
): number {
  if (!report) return 0;
  const categories = report.categories || [];
  let hnwiCategory =
    findCategory(
      categories,
      (n) => n.includes('hnwi') || n.includes('high net worth')
    ) || null;
  if (!hnwiCategory && report.categoryRules) {
    const networthName = findCategory(
      categories,
      (n) => n.includes('networth') || n.includes('net worth')
    );
    if (networthName && report.categoryRules[networthName]) {
      const rule = String(report.categoryRules[networthName]);
      const parts = rule.split('+').map((s) => s.trim());
      if (parts.length === 2) hnwiCategory = parts[1];
    }
  }
  if (hnwiCategory) {
    const value = categoryValue(report, hnwiCategory, month);
    if (value) return value;
  }
  const networthCat = findCategory(
    categories,
    (n) => n.includes('networth') || n.includes('net worth')
  );
  return networthCat ? categoryValue(report, networthCat, month) : 0;
}

export function earliestSalaryYear(
  rows: Array<{ year: number | string }>
): number | null {
  let earliest: number | null = null;
  for (const row of rows) {
    const year = Number(row.year);
    if (!Number.isFinite(year) || year < 1900 || year > 2100) continue;
    if (earliest == null || year < earliest) earliest = year;
  }
  return earliest;
}

export function projectFreedomIncome(opts: {
  currentFreedomAnnual: number;
  currentNetWorth: number;
  annualExpenses: number;
  assumptions: FreedomIncomeAssumptions;
  horizonYears?: number;
  historicalRows?: FreedomIncomeProjectionRow[];
}): { rows: FreedomIncomeProjectionRow[]; workOptionalYear: number | null } {
  const {
    currentFreedomAnnual,
    currentNetWorth,
    annualExpenses,
    assumptions,
    horizonYears = 40,
    historicalRows = [],
  } = opts;

  const incomeGrowth = assumptions.incomeGrowthRatePct / 100;
  const inflation = assumptions.expenseInflationPct / 100;
  const portfolioReturn = assumptions.portfolioReturnPct / 100;
  const startYear = new Date().getFullYear();
  const maxYears =
    assumptions.retirementAge != null && assumptions.currentAge != null
      ? Math.max(horizonYears, assumptions.retirementAge - assumptions.currentAge + 5)
      : horizonYears;

  const rows: FreedomIncomeProjectionRow[] = historicalRows
    .filter((row) => row.year < startYear)
    .sort((a, b) => a.year - b.year);
  let freedom = currentFreedomAnnual;
  let expenses = annualExpenses;
  let netWorth = currentNetWorth;

  for (let i = 0; i <= maxYears; i++) {
    const year = startYear + i;
    const age =
      assumptions.currentAge != null ? assumptions.currentAge + i : null;

    if (i > 0) {
      freedom = freedom * (1 + incomeGrowth);
      expenses = expenses * (1 + inflation);
      // Portfolio grows at return rate; Freedom Income is assumed spent / separate
      // from reinvestment here so independence is measured against living costs.
      netWorth = netWorth * (1 + portfolioReturn);
    }

    const ratio = expenses > 0 ? (freedom / expenses) * 100 : null;
    const salaryRequired = Math.max(0, expenses - freedom);
    const isWorkOptional = ratio != null && ratio >= 100;

    rows.push({
      year,
      age,
      projectedNetWorth: Number(netWorth.toFixed(2)),
      projectedFreedomIncome: Number(freedom.toFixed(2)),
      projectedFreedomMonthly: Number((freedom / 12).toFixed(2)),
      projectedAnnualExpenses: Number(expenses.toFixed(2)),
      freedomRatio: ratio != null ? Number(ratio.toFixed(1)) : null,
      salaryRequired: Number(salaryRequired.toFixed(2)),
      isWorkOptional,
    });

    if (assumptions.retirementAge != null && age != null && age > assumptions.retirementAge + 15) {
      break;
    }
  }

  const workOptionalYear =
    rows.find((row) => row.isWorkOptional)?.year ?? null;

  return { rows, workOptionalYear };
}
