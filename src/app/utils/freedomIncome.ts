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

export function projectFreedomIncome(opts: {
  currentFreedomAnnual: number;
  currentNetWorth: number;
  annualExpenses: number;
  assumptions: FreedomIncomeAssumptions;
  horizonYears?: number;
}): { rows: FreedomIncomeProjectionRow[]; workOptionalYear: number | null } {
  const {
    currentFreedomAnnual,
    currentNetWorth,
    annualExpenses,
    assumptions,
    horizonYears = 40,
  } = opts;

  const incomeGrowth = assumptions.incomeGrowthRatePct / 100;
  const inflation = assumptions.expenseInflationPct / 100;
  const portfolioReturn = assumptions.portfolioReturnPct / 100;
  const startYear = new Date().getFullYear();
  const maxYears =
    assumptions.retirementAge != null && assumptions.currentAge != null
      ? Math.max(horizonYears, assumptions.retirementAge - assumptions.currentAge + 5)
      : horizonYears;

  const rows: FreedomIncomeProjectionRow[] = [];
  let freedom = currentFreedomAnnual;
  let expenses = annualExpenses;
  let netWorth = currentNetWorth;
  let workOptionalYear: number | null = null;

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
    if (isWorkOptional && workOptionalYear == null) {
      workOptionalYear = year;
    }

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

  return { rows, workOptionalYear };
}
