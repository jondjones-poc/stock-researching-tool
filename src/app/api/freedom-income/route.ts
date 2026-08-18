import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';
import { internalApiFetch } from '../../utils/internalApiFetch';
import {
  computeAssetFreedomIncome,
  currentSalaryFromHistory,
  earliestSalaryYear,
  netWorthFromReport,
  projectFreedomIncome,
  wageMonthlyTotal,
  type FreedomIncomeProjectionRow,
} from '../../utils/freedomIncome';

function getSetting(
  settings: Array<{ key: string; value: string | null }>,
  key: string,
  def: number | null = null
): number | null {
  const s = settings.find((x) => x.key === key);
  if (!s || s.value == null || s.value === '') return def;
  const n = parseFloat(String(s.value));
  return Number.isFinite(n) ? n : def;
}

function pickLivingCostMonthly(
  settings: Array<{ key: string; value: string | null }>
): number | null {
  return (
    getSetting(settings, 'MONTHLY_RETIERMENT_VALUE', null) ??
    getSetting(settings, 'MONTHLY_RETIREMENT_VALUE', null) ??
    getSetting(settings, 'retirement_required_cashflow', null)
  );
}

/** GET — Freedom Income dashboard payload (calculated from existing finance data). */
export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const [
      settingsRes,
      typesRes,
      sourcesRes,
      salaryRes,
      networthCurrRes,
      networthPrevRes,
      networthStartRes,
      incomeCurrRes,
      incomePrevRes,
      trackerRes,
    ] = await Promise.all([
      internalApiFetch(request, '/api/settings'),
      internalApiFetch(request, '/api/income-types'),
      internalApiFetch(request, '/api/income-sources'),
      query(
        `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
         FROM salary_history
         ORDER BY year DESC, month DESC, id ASC`
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> })),
      internalApiFetch(request, `/api/networth-report?year=${currentYear}`),
      internalApiFetch(request, `/api/networth-report?year=${currentYear - 1}`),
      internalApiFetch(request, `/api/networth-report?year=${currentYear - 2}`),
      internalApiFetch(request, `/api/income-entries?year=${currentYear}`),
      internalApiFetch(request, `/api/income-entries?year=${currentYear - 1}`),
      internalApiFetch(request, '/api/investment-tracker'),
    ]);

    if (!settingsRes.ok) throw new Error('Failed to load settings');
    if (!typesRes.ok) throw new Error('Failed to load income types');
    if (!sourcesRes.ok) throw new Error('Failed to load income sources');

    const settingsData = await settingsRes.json();
    const settings = settingsData.data || [];
    const typesData = await typesRes.json();
    const sourcesData = await sourcesRes.json();
    const types = typesData.data || [];
    const sources = sourcesData.data || [];

    const incomeCurr = incomeCurrRes.ok ? await incomeCurrRes.json() : { data: [] };
    const incomePrev = incomePrevRes.ok ? await incomePrevRes.json() : { data: [] };
    const entries = [...(incomeCurr.data || []), ...(incomePrev.data || [])];

    const networthCurr = networthCurrRes.ok ? await networthCurrRes.json() : null;
    const networthPrev = networthPrevRes.ok ? await networthPrevRes.json() : null;
    const networthStart = networthStartRes.ok ? await networthStartRes.json() : null;
    const trackerAll = trackerRes.ok ? await trackerRes.json() : { data: [] };
    const trackerEntries = trackerAll.data || [];

    const assetFreedom = computeAssetFreedomIncome({
      networthCurr,
      networthPrev,
      networthStart,
      trackerCurr: trackerEntries,
      trackerPrev: trackerEntries,
      currentYear,
      currentMonth,
    });
    const statementYear = assetFreedom.statementYear;
    const statementMonth = assetFreedom.statementMonth;
    const breakdown = assetFreedom.breakdown;
    const freedomMonthly = assetFreedom.freedomMonthly;
    const freedomAnnual = assetFreedom.freedomAnnual;

    const salaryRows = (salaryRes.rows || []) as Array<{
      id?: number;
      year: number | string;
      month: number | string;
      monthly_salary: string | number;
      notes?: string | null;
      created_at?: string;
      updated_at?: string;
    }>;
    const historySalary = currentSalaryFromHistory(salaryRows);
    const wageFallback = wageMonthlyTotal(
      types,
      sources,
      entries,
      statementYear,
      statementMonth
    );
    const monthlySalary =
      historySalary != null
        ? historySalary.monthly
        : wageFallback > 0
          ? wageFallback
          : null;
    const annualSalary =
      historySalary != null
        ? historySalary.annual
        : monthlySalary != null
          ? monthlySalary * 12
          : null;
    const salarySource =
      historySalary != null
        ? 'salary_history'
        : wageFallback > 0
          ? 'Is247wage_fallback'
          : null;

    const livingMonthly = pickLivingCostMonthly(settings);
    const annualExpenses = livingMonthly != null ? livingMonthly * 12 : null;
    const freedomRatio =
      annualExpenses != null && annualExpenses > 0
        ? (freedomAnnual / annualExpenses) * 100
        : null;
    const salaryRequired =
      annualExpenses != null ? Math.max(0, annualExpenses - freedomAnnual) : null;

    // HNWI / net worth for projections
    const nwData =
      statementYear === currentYear
        ? networthCurr
        : statementYear === currentYear - 1
          ? networthPrev
          : networthCurr;
    const currentNetWorth = netWorthFromReport(nwData, statementMonth);

    const assumptions = {
      incomeGrowthRatePct: getSetting(settings, 'retirement_cashflow_increase', 5) ?? 5,
      expenseInflationPct: getSetting(settings, 'retirement_inflation', 3) ?? 3,
      portfolioReturnPct: getSetting(settings, 'retirement_return_rate', 7) ?? 7,
      currentAge: getSetting(settings, 'retirement_current_age', null),
      retirementAge: getSetting(settings, 'retirement_age', null),
      monthlyLivingCost: livingMonthly,
      statementMonth,
      statementYear,
    };

    const firstSalaryYear = earliestSalaryYear(salaryRows);
    const networthByYear = new Map<number, typeof networthCurr>([
      [currentYear, networthCurr],
      [currentYear - 1, networthPrev],
      [currentYear - 2, networthStart],
    ]);
    if (firstSalaryYear != null && firstSalaryYear < currentYear) {
      const extraYears: number[] = [];
      for (let year = firstSalaryYear - 1; year <= currentYear; year++) {
        if (!networthByYear.has(year)) extraYears.push(year);
      }
      if (extraYears.length > 0) {
        const extraRes = await Promise.all(
          extraYears.map((year) =>
            internalApiFetch(request, `/api/networth-report?year=${year}`)
          )
        );
        for (let i = 0; i < extraYears.length; i++) {
          const res = extraRes[i];
          networthByYear.set(extraYears[i], res.ok ? await res.json() : null);
        }
      }
    }

    const inflation = assumptions.expenseInflationPct / 100;
    const historicalRows: FreedomIncomeProjectionRow[] = [];
    const historyFrom = firstSalaryYear != null ? firstSalaryYear : currentYear;
    for (let year = historyFrom; year < currentYear; year++) {
      const computed = computeAssetFreedomIncome({
        networthCurr: networthByYear.get(year) ?? null,
        networthPrev: networthByYear.get(year - 1) ?? null,
        networthStart: networthByYear.get(year - 2) ?? null,
        trackerCurr: trackerEntries,
        trackerPrev: trackerEntries,
        currentYear: year,
        currentMonth: 12,
        allowPriorYearFallback: false,
      });
      const netWorth = netWorthFromReport(
        networthByYear.get(year) ?? null,
        computed.statementMonth
      );
      const expenses =
        annualExpenses != null
          ? annualExpenses / Math.pow(1 + inflation, currentYear - year)
          : 0;
      const ratio = expenses > 0 ? (computed.freedomAnnual / expenses) * 100 : null;
      const salaryRequired = Math.max(0, expenses - computed.freedomAnnual);
      historicalRows.push({
        year,
        age:
          assumptions.currentAge != null
            ? assumptions.currentAge + (year - currentYear)
            : null,
        projectedNetWorth: Number(netWorth.toFixed(2)),
        projectedFreedomIncome: Number(computed.freedomAnnual.toFixed(2)),
        projectedFreedomMonthly: Number((computed.freedomAnnual / 12).toFixed(2)),
        projectedAnnualExpenses: Number(expenses.toFixed(2)),
        freedomRatio: ratio != null ? Number(ratio.toFixed(1)) : null,
        salaryRequired: Number(salaryRequired.toFixed(2)),
        isWorkOptional: ratio != null && ratio >= 100,
      });
    }

    const { rows: projections, workOptionalYear } = projectFreedomIncome({
      currentFreedomAnnual: freedomAnnual,
      currentNetWorth,
      annualExpenses: annualExpenses ?? 0,
      assumptions,
      historicalRows,
    });

    return NextResponse.json({
      statementYear,
      statementMonth,
      freedomAnnual,
      freedomMonthly,
      freedomRatio,
      salaryRequired,
      annualSalary,
      monthlySalary,
      salarySource,
      annualExpenses,
      monthlyLivingCost: livingMonthly,
      currentNetWorth,
      workOptionalYear,
      breakdown,
      wageTypeNames: types
        .filter((t: { Is247wage?: boolean | null }) => t.Is247wage === true)
        .map((t: { name?: string }) => String(t.name || '').trim())
        .filter(Boolean),
      projections,
      assumptions,
      salaryHistory: salaryRows,
      notes: {
        freedomDefinition:
          'Freedom Income = Stock Value change this year − investment tracker contributions this year + Business Cash change this year (networth-report categories). Work/salary is excluded.',
        expensesDefinition:
          'Annual expenses from MONTHLY_RETIERMENT_VALUE (or MONTHLY_RETIREMENT_VALUE / retirement_required_cashflow) × 12.',
        projectionDefinition:
          'Freedom Income grows at retirement_cashflow_increase; expenses at retirement_inflation; net worth at retirement_return_rate (existing settings).',
      },
    });
  } catch (error: unknown) {
    console.error('freedom-income GET failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Freedom Income' },
      { status: 500 }
    );
  }
}
