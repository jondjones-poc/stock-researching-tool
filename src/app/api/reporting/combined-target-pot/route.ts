import { NextRequest, NextResponse } from 'next/server';

/** GET - Combined pre-retirement (Cashflow Income, Portfolio Value, Total Portfolio Value) + drawdown (Portfolio Value, Withdrawal Amount) for Summary-style graph */
export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const previousMonth = currentMonth - 1 >= 1 ? currentMonth - 1 : 12;
    const previousYear = previousMonth === 12 ? currentYear - 1 : currentYear;

    const [settingsRes, networthRes, currentYearRes, prevYearRes, typesRes, sourcesRes] = await Promise.all([
      fetch(`${origin}/api/settings`),
      fetch(`${origin}/api/networth-report?year=${previousYear}`),
      fetch(`${origin}/api/income-entries?year=${currentYear}`),
      fetch(`${origin}/api/income-entries?year=${currentYear - 1}`),
      fetch(`${origin}/api/income-types`),
      fetch(`${origin}/api/income-sources`),
    ]);
    if (!settingsRes.ok) throw new Error('Failed to fetch settings');
    const settingsData = await settingsRes.json();
    const settings = settingsData.data || [];
    const getSetting = (key: string, def: number) => {
      const s = settings.find((x: { key: string }) => x.key === key);
      return s && s.value != null && s.value !== '' ? parseFloat(String(s.value)) : def;
    };
    const targetPot = getSetting('retirement_target_pot', 2000000);
    const returnRate = getSetting('retirement_return_rate', 7);
    const safeWithdrawalRate = getSetting('retirement_withdrawal_rate', 4);
    const inflation = getSetting('retirement_inflation', 3);
    const tax = getSetting('retirement_tax', 20);
    const currentAge = getSetting('retirement_current_age', 44);
    const retirementAge = getSetting('retirement_age', 68);
    const deathAge = getSetting('retirement_death_age', 85);
    const cashflowIncrease = getSetting('retirement_cashflow_increase', 5);

    let currentNetworth = 0;
    if (networthRes.ok) {
      const data = await networthRes.json();
      const monthTotals = data.monthData?.[previousMonth] || {};
      let hnwiCategory = data.categories?.find((c: string) => c.toLowerCase().includes('hnwi') || c.toLowerCase().includes('high net worth'));
      if (!hnwiCategory && data.categoryRules) {
        const networthName = data.categories?.find((c: string) => c.toLowerCase().includes('networth') || c.toLowerCase().includes('net worth'));
        if (networthName && data.categoryRules[networthName]) {
          const rule = data.categoryRules[networthName] as string;
          const parts = rule.split('+').map((s: string) => s.trim());
          if (parts.length === 2) hnwiCategory = parts[1];
        }
      }
      if (hnwiCategory != null && monthTotals[hnwiCategory] !== undefined) {
        currentNetworth = monthTotals[hnwiCategory] || 0;
      } else {
        const networthCat = data.categories?.find((c: string) => c.toLowerCase().includes('networth') || c.toLowerCase().includes('net worth'));
        if (networthCat) currentNetworth = monthTotals[networthCat] || 0;
        else currentNetworth = (data.categories || []).reduce((sum: number, cat: string) => sum + (monthTotals[cat] || 0), 0);
      }
    }

    let averageMonthlyCashflow = 0;
    const typesData = typesRes.ok ? await typesRes.json() : { data: [] };
    const sourcesData = sourcesRes.ok ? await sourcesRes.json() : { data: [] };
    const businessTypes = typesData.data.filter((t: { isbusinessincome?: boolean }) => t.isbusinessincome === true);
    const sources = sourcesData.data || [];
    const currentYearData = currentYearRes.ok ? await currentYearRes.json() : { data: [] };
    const prevYearData = prevYearRes.ok ? await prevYearRes.json() : { data: [] };
    const allEntries = [...(currentYearData.data || []), ...(prevYearData.data || [])];
    const getEntry = (sourceId: number, month: number, y: number) =>
      allEntries.find(
        (e: { income_source_id: number; month: number | string; year: number | string }) =>
          e.income_source_id === sourceId && parseInt(String(e.month)) === month && parseInt(String(e.year)) === y
      );
    const getMonthlyTotal = (month: number, y: number) => {
      let total = 0;
      let hasAny = false;
      businessTypes.forEach((type: { id: number }) => {
        sources.filter((s: { income_type_id: number }) => s.income_type_id === type.id).forEach((src: { id: number }) => {
          const entry = getEntry(src.id, month, y);
          if (entry) {
            hasAny = true;
            if (entry.account_id != null && entry.current_month_balance != null && entry.previous_month_balance != null)
              total += parseFloat(String(entry.current_month_balance)) - parseFloat(String(entry.previous_month_balance));
            else total += parseFloat(String(entry.price));
          }
        });
      });
      return hasAny ? total : null;
    };
    let month1 = currentMonth - 1;
    let month2 = currentMonth - 2;
    let year1 = currentYear;
    let year2 = currentYear;
    if (month1 < 1) {
      month1 = 12;
      year1 = currentYear - 1;
    }
    if (month2 < 1) {
      month2 = 12;
      year2 = currentYear - 1;
    }
    const v1 = getMonthlyTotal(month1, year1);
    const v2 = getMonthlyTotal(month2, year2);
    const count = (v1 != null ? 1 : 0) + (v2 != null ? 1 : 0);
    if (count > 0) averageMonthlyCashflow = ((v1 ?? 0) + (v2 ?? 0)) / count;

    const annualGrowthRate = returnRate / 100;
    const cashflowIncreaseRate = cashflowIncrease / 100;
    const retirementYearByAge = currentYear + (retirementAge - currentAge);

    type Row = { year: number; age: number; cashflowIncome: number | null; portfolioValue: number; totalPortfolioValue: number | null; withdrawalAmount: number | null; portfolioWithBusiness: number | null };
    const data: Row[] = [];

    if (currentNetworth <= 0) {
      return NextResponse.json({ data: [] });
    }

    let portfolioValueWithoutCashflow = currentNetworth;
    let totalPortfolioValue = currentNetworth;
    let currentMonthlyCashflow = averageMonthlyCashflow;
    const yearsToRetirement = Math.max(0, retirementAge - currentAge);

    for (let i = 0; i <= yearsToRetirement; i++) {
      const year = currentYear + i;
      const age = currentAge + i;
      if (age > deathAge) break;

      if (i === 0) {
        const yearlyCashflow = currentMonthlyCashflow * 12;
        data.push({
          year,
          age,
          cashflowIncome: yearlyCashflow,
          portfolioValue: portfolioValueWithoutCashflow,
          totalPortfolioValue,
          withdrawalAmount: null,
          portfolioWithBusiness: null,
        });
        if (totalPortfolioValue >= targetPot) break;
      } else {
        currentMonthlyCashflow = currentMonthlyCashflow * (1 + cashflowIncreaseRate);
        const yearlyCashflow = currentMonthlyCashflow * 12;
        portfolioValueWithoutCashflow = portfolioValueWithoutCashflow * (1 + annualGrowthRate);
        totalPortfolioValue = totalPortfolioValue * (1 + annualGrowthRate) + yearlyCashflow;
        data.push({
          year,
          age,
          cashflowIncome: yearlyCashflow,
          portfolioValue: Number(portfolioValueWithoutCashflow.toFixed(2)),
          totalPortfolioValue: Number(totalPortfolioValue.toFixed(2)),
          withdrawalAmount: null,
          portfolioWithBusiness: null,
        });
        if (totalPortfolioValue >= targetPot) break;
      }
    }

    const targetReached = data.find((p) => p.totalPortfolioValue != null && p.totalPortfolioValue >= targetPot);
    const retirementYear = targetReached ? targetReached.year : null;
    const actualRetirementAge = retirementYear != null ? currentAge + (retirementYear - currentYear) : null;

    if (retirementYear != null && actualRetirementAge != null && actualRetirementAge < deathAge) {
      const withdrawalRate = safeWithdrawalRate / 100;
      const inflationRate = inflation / 100;
      const yearsInRetirement = deathAge - actualRetirementAge;
      const retirementRow = data.find((p) => p.year === retirementYear);
      const startValue = retirementRow?.totalPortfolioValue ?? targetPot;
      let portfolioValue: number = startValue;
      const baseWithdrawal = portfolioValue * withdrawalRate;
      const retirementAgeYear = currentYear + (retirementAge - currentAge);
      const baselineYearlyCashflow = (retirementRow?.cashflowIncome != null ? retirementRow.cashflowIncome : 0);
      let portfolioWithBusiness: number = portfolioValue;

      for (let i = 1; i <= yearsInRetirement; i++) {
        const year = retirementYear + i;
        const age = currentAge + (year - currentYear);
        if (age > deathAge) break;
        const withdrawal = baseWithdrawal * Math.pow(1 + inflationRate, i);
        const yearsSinceRetirement = year - retirementYear;
        const yearsUntilRetirementAge = retirementAgeYear - retirementYear;
        let businessCashflowThisYear: number;
        if (year < retirementAgeYear) {
          businessCashflowThisYear = baselineYearlyCashflow * Math.pow(1 + cashflowIncreaseRate, yearsSinceRetirement);
        } else {
          const cashflowAtRetirementAge = baselineYearlyCashflow * Math.pow(1 + cashflowIncreaseRate, yearsUntilRetirementAge);
          businessCashflowThisYear = cashflowAtRetirementAge;
        }
        portfolioValue = portfolioValue * (1 + annualGrowthRate) - withdrawal;
        if (portfolioValue < 0) portfolioValue = 0;
        const portfolioAfterGrowth = portfolioWithBusiness * (1 + annualGrowthRate);
        portfolioWithBusiness = portfolioAfterGrowth + businessCashflowThisYear - withdrawal;
        if (portfolioWithBusiness < 0) portfolioWithBusiness = 0;
        data.push({
          year,
          age,
          cashflowIncome: null,
          portfolioValue: Number(portfolioValue.toFixed(2)),
          totalPortfolioValue: null,
          withdrawalAmount: Number(withdrawal.toFixed(2)),
          portfolioWithBusiness: Number(portfolioWithBusiness.toFixed(2)),
        });
      }
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    console.error('Combined target pot error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute' },
      { status: 500 }
    );
  }
}
