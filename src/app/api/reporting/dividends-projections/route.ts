import { NextRequest, NextResponse } from 'next/server';

/** GET - Projection data for Retirement by Dividends: years, monthlyLivingCost, monthlyDividendIncome */
export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const [settingsRes, portfolioRes, gbpRes] = await Promise.all([
      fetch(`${origin}/api/settings`),
      fetch(`${origin}/api/etoro/portfolio/load?activeOnly=false`),
      fetch(`${origin}/api/usd-to-gbp`),
    ]);
    if (!settingsRes.ok) throw new Error('Failed to fetch settings');
    if (!portfolioRes.ok) throw new Error('Failed to fetch portfolio');
    const settingsData = await settingsRes.json();
    const portfolioData = await portfolioRes.json();
    const gbpData = gbpRes.ok ? await gbpRes.json() : { rate: 0.8 };
    const rate = Number(gbpData?.rate) || 0.8;
    const settings = settingsData.data || [];
    const getSetting = (key: string, def: number) => {
      const s = settings.find((x: { key: string }) => x.key === key);
      return s && s.value != null && s.value !== '' ? parseFloat(String(s.value)) : def;
    };
    const projCurrentAge = Math.floor(getSetting('retirement_current_age', 44));
    const deathAge = Math.floor(getSetting('retirement_death_age', 85));
    const projMonthlyRetirement = getSetting('MONTHLY_RETIERMENT_VALUE', NaN) || getSetting('MONTHLY_RETIREMENT_VALUE', 5000) || 5000;
    const projMonthlyContribution = getSetting('monthly_contribution', 500);
    const projInflationPct = getSetting('retirement_inflation', 3);
    const projDividendGrowthPct = getSetting('dividend_growth_rate', 3);
    const stocks = portfolioData.stocks ?? [];
    const isDividend = (s: { isDividend?: boolean | string | null }) => s.isDividend !== false && s.isDividend !== 'false';
    const dividendStocks = stocks.filter(isDividend);
    let portfolioValue = 0;
    let totalAnnualDividend = 0;
    for (const s of dividendStocks) {
      const price = Number(s.currentPrice);
      const shares = Number(s.sharesOwned);
      const dps = Number(s.dividendPerShare);
      if (Number.isFinite(price) && Number.isFinite(shares)) portfolioValue += price * shares;
      if (Number.isFinite(dps) && Number.isFinite(shares)) totalAnnualDividend += dps * shares;
    }
    const portfolioYieldPct = portfolioValue > 0 ? (totalAnnualDividend / portfolioValue) * 100 : 0;
    const yieldPctDecimal = portfolioYieldPct / 100;
    const currentYear = new Date().getFullYear();
    const monthlyDividendsYear0 = totalAnnualDividend / 12;
    const years: number[] = [];
    const ages: number[] = [];
    const monthlyLivingCost: number[] = [];
    const monthlyDividendIncome: number[] = [];
    let year = currentYear;
    let monthlyDiv = monthlyDividendsYear0;
    const monthlyContrib = projMonthlyContribution;
    let previousYearlyDividends = 0;
    const maxYears = 80;
    for (let i = 0; i < maxYears; i++) {
      const yearlyDividends = monthlyDiv * 12;
      const yearlyDividendsBase = i === 0 ? yearlyDividends : previousYearlyDividends;
      const yearlyDividendGrowthAmount = i === 0 ? 0 : previousYearlyDividends * (projDividendGrowthPct / 100);
      const totalContribUsd = monthlyDiv + (rate > 0 ? monthlyContrib / rate : 0);
      const dividendsFromNewContributions = totalContribUsd * 12 * yieldPctDecimal;
      const totalContributionUsd = yearlyDividendsBase + dividendsFromNewContributions + yearlyDividendGrowthAmount;
      const monthlyAmountGbp = (totalContributionUsd / 12) * rate;
      const monthlyCostWithInflation = projMonthlyRetirement * Math.pow(1 + projInflationPct / 100, i);
      const age = projCurrentAge + i;
      years.push(year);
      ages.push(age);
      monthlyLivingCost.push(Number(monthlyCostWithInflation.toFixed(2)));
      monthlyDividendIncome.push(Number(monthlyAmountGbp.toFixed(2)));
      const canLive = monthlyAmountGbp >= monthlyCostWithInflation;
      if (canLive || age >= deathAge) break;
      previousYearlyDividends = yearlyDividends;
      const yearlyDividendsNext = yearlyDividends * (1 + projDividendGrowthPct / 100) + dividendsFromNewContributions;
      monthlyDiv = yearlyDividendsNext / 12;
      year += 1;
    }
    return NextResponse.json({ years, ages, monthlyLivingCost, monthlyDividendIncome });
  } catch (err: unknown) {
    console.error('Dividends projections error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute projections' },
      { status: 500 }
    );
  }
}
