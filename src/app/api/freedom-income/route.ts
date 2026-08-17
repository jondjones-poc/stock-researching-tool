import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../utils/db';
import { internalApiFetch } from '../../utils/internalApiFetch';
import {
  buildFreedomBreakdown,
  projectFreedomIncome,
  wageMonthlyTotal,
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

function latestStatementMonth(
  monthsWithData: number[] | undefined,
  year: number,
  currentYear: number,
  currentMonth: number
): { month: number; year: number } | null {
  if (!monthsWithData?.length) return null;
  const eligible = monthsWithData
    .map(Number)
    .filter((m) => Number.isFinite(m) && m >= 1 && m <= 12)
    .filter((m) => year < currentYear || m <= currentMonth)
    .sort((a, b) => b - a);
  if (!eligible.length) return null;
  return { month: eligible[0], year };
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
      incomeCurrRes,
      incomePrevRes,
    ] = await Promise.all([
      internalApiFetch(request, '/api/settings'),
      internalApiFetch(request, '/api/income-types'),
      internalApiFetch(request, '/api/income-sources'),
      query(
        `SELECT id, year, month, monthly_salary, notes, created_at, updated_at
         FROM salary_history
         ORDER BY year DESC, month DESC
         LIMIT 24`
      ).catch(() => ({ rows: [] as Array<Record<string, unknown>> })),
      internalApiFetch(request, `/api/networth-report?year=${currentYear}`),
      internalApiFetch(request, `/api/networth-report?year=${currentYear - 1}`),
      internalApiFetch(request, `/api/income-entries?year=${currentYear}`),
      internalApiFetch(request, `/api/income-entries?year=${currentYear - 1}`),
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

    // Statement month: prefer latest income entry month, else networth monthsWithData
    let statementYear = currentYear;
    let statementMonth = currentMonth > 1 ? currentMonth - 1 : 12;
    if (currentMonth === 1) statementYear = currentYear - 1;

    let bestYm = 0;
    for (const e of entries) {
      const y = parseInt(String(e.year), 10);
      const m = parseInt(String(e.month), 10);
      if (!Number.isFinite(y) || !Number.isFinite(m)) continue;
      if (y > currentYear || (y === currentYear && m > currentMonth)) continue;
      const ym = y * 100 + m;
      if (ym > bestYm) {
        bestYm = ym;
        statementYear = y;
        statementMonth = m;
      }
    }
    if (bestYm === 0) {
      const fromNw =
        latestStatementMonth(
          networthCurr?.monthsWithData,
          networthCurr?.year ?? currentYear,
          currentYear,
          currentMonth
        ) ||
        latestStatementMonth(
          networthPrev?.monthsWithData,
          networthPrev?.year ?? currentYear - 1,
          currentYear,
          currentMonth
        );
      if (fromNw) {
        statementYear = fromNw.year;
        statementMonth = fromNw.month;
      }
    }

    const breakdown = buildFreedomBreakdown(
      types,
      sources,
      entries,
      statementYear,
      statementMonth
    );
    const freedomMonthly = breakdown.reduce((s, r) => s + r.monthly, 0);
    const freedomAnnual = freedomMonthly * 12;

    const salaryRows = salaryRes.rows || [];
    const latestSalary = salaryRows[0] as
      | { year: number; month: number; monthly_salary: string | number }
      | undefined;
    const wageFallback = wageMonthlyTotal(
      types,
      sources,
      entries,
      statementYear,
      statementMonth
    );
    const monthlySalary =
      latestSalary != null
        ? parseFloat(String(latestSalary.monthly_salary))
        : wageFallback > 0
          ? wageFallback
          : null;
    const annualSalary = monthlySalary != null ? monthlySalary * 12 : null;
    const salarySource =
      latestSalary != null
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
    let currentNetWorth = 0;
    if (nwData?.monthData) {
      const monthTotals = nwData.monthData[statementMonth] || {};
      let hnwiCategory = (nwData.categories || []).find(
        (c: string) =>
          c.toLowerCase().includes('hnwi') || c.toLowerCase().includes('high net worth')
      );
      if (!hnwiCategory && nwData.categoryRules) {
        const networthName = (nwData.categories || []).find(
          (c: string) =>
            c.toLowerCase().includes('networth') || c.toLowerCase().includes('net worth')
        );
        if (networthName && nwData.categoryRules[networthName]) {
          const rule = String(nwData.categoryRules[networthName]);
          const parts = rule.split('+').map((s: string) => s.trim());
          if (parts.length === 2) hnwiCategory = parts[1];
        }
      }
      if (hnwiCategory != null && monthTotals[hnwiCategory] !== undefined) {
        currentNetWorth = Number(monthTotals[hnwiCategory]) || 0;
      } else {
        const networthCat = (nwData.categories || []).find(
          (c: string) =>
            c.toLowerCase().includes('networth') || c.toLowerCase().includes('net worth')
        );
        if (networthCat) currentNetWorth = Number(monthTotals[networthCat]) || 0;
      }
    }

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

    const { rows: projections, workOptionalYear } = projectFreedomIncome({
      currentFreedomAnnual: freedomAnnual,
      currentNetWorth,
      annualExpenses: annualExpenses ?? 0,
      assumptions,
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
      projections,
      assumptions,
      salaryHistory: salaryRows,
      notes: {
        freedomDefinition:
          'Freedom Income = sum of income types where Is247wage is not true (excludes wage/salary types). Annualised as statement-month total × 12.',
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
