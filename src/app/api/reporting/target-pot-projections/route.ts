import { NextRequest, NextResponse } from 'next/server';

/** GET - Projection data for Retirement by Target Pot: accumulation (years, portfolioValue) and drawdown (years, portfolioValue, withdrawalAmount) */
export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const previousMonth = currentMonth - 1 >= 1 ? currentMonth - 1 : 12;
    const previousYear = previousMonth === 12 ? currentYear - 1 : currentYear;
    const [settingsRes, networthRes] = await Promise.all([
      fetch(`${origin}/api/settings`),
      fetch(`${origin}/api/networth-report?year=${previousYear}`),
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
    const statePensionWeekly = getSetting('retirement_state_pension_weekly', 221.2);
    const deathAge = getSetting('retirement_death_age', 85);
    let currentNetworth = 0;
    if (networthRes.ok) {
      const data = await networthRes.json();
      const monthTotals = data.monthData?.[previousMonth] || {};
      let hnwiCategory = data.categories?.find((cat: string) => {
        const c = cat.toLowerCase().trim();
        return c.includes('hnwi') || c.includes('high net worth');
      });
      if (!hnwiCategory && data.categoryRules) {
        const networthName = data.categories?.find((cat: string) => {
          const c = cat.toLowerCase().trim();
          return c.includes('networth') || c.includes('net worth');
        });
        if (networthName && data.categoryRules[networthName]) {
          const rule = data.categoryRules[networthName] as string;
          const parts = rule.split('+').map((s: string) => s.trim());
          if (parts.length === 2) hnwiCategory = parts[1];
        }
      }
      if (hnwiCategory != null && monthTotals[hnwiCategory] !== undefined) {
        currentNetworth = monthTotals[hnwiCategory] || 0;
      } else {
        const networthCat = data.categories?.find((cat: string) => {
          const c = cat.toLowerCase().trim();
          return c.includes('networth') || c.includes('net worth');
        });
        if (networthCat) currentNetworth = monthTotals[networthCat] || 0;
        else
          currentNetworth = (data.categories || []).reduce(
            (sum: number, cat: string) => sum + (monthTotals[cat] || 0),
            0
          );
      }
    }
    const accumulationYears: number[] = [];
    const accumulationPortfolioValue: number[] = [];
    const annualGrowthRate = returnRate / 100;
    let projectedValue = currentNetworth;
    const maxYears = 100;
    let targetYear: number | null = null;
    for (let year = currentYear; year <= currentYear + maxYears; year++) {
      const age = currentAge + (year - currentYear);
      accumulationYears.push(year);
      accumulationPortfolioValue.push(Number(projectedValue.toFixed(2)));
      if (projectedValue >= targetPot) {
        targetYear = year;
        break;
      }
      if (age >= deathAge) break;
      projectedValue = projectedValue * (1 + annualGrowthRate);
    }
    const drawdownYears: number[] = [];
    const drawdownPortfolioValue: number[] = [];
    const withdrawalAmount: number[] = [];
    if (targetYear != null && retirementAge < deathAge) {
      const withdrawalRate = safeWithdrawalRate / 100;
      const inflationRate = inflation / 100;
      const taxRate = tax / 100;
      const yearsInRetirement = deathAge - retirementAge;
      let portfolioValue = targetPot;
      const baseWithdrawal = portfolioValue * withdrawalRate;
      for (let i = 0; i <= yearsInRetirement; i++) {
        const year = targetYear + i;
        const withdrawal = baseWithdrawal * Math.pow(1 + inflationRate, i);
        drawdownYears.push(year);
        drawdownPortfolioValue.push(Number(portfolioValue.toFixed(2)));
        withdrawalAmount.push(Number(withdrawal.toFixed(2)));
        portfolioValue = portfolioValue * (1 + returnRate / 100) - withdrawal;
        if (portfolioValue < 0) portfolioValue = 0;
      }
    }
    return NextResponse.json({
      accumulation: { years: accumulationYears, portfolioValue: accumulationPortfolioValue },
      drawdown: { years: drawdownYears, portfolioValue: drawdownPortfolioValue, withdrawalAmount },
    });
  } catch (err: unknown) {
    console.error('Target pot projections error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute projections' },
      { status: 500 }
    );
  }
}
