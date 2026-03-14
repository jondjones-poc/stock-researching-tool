import { NextRequest, NextResponse } from 'next/server';

/** GET - Projection data for Retirement by Cashflow: years, projectedMonthlyCashflow */
export async function GET(request: NextRequest) {
  try {
    const origin = request.nextUrl.origin;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
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
    const [settingsRes, currentYearRes, prevYearRes, typesRes, sourcesRes] = await Promise.all([
      fetch(`${origin}/api/settings`),
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
    const currentAge = Math.floor(getSetting('retirement_current_age', 44));
    const requiredCashflow = getSetting('retirement_required_cashflow', 5000);
    const cashflowIncrease = getSetting('retirement_cashflow_increase', 5);
    const currentYearData = currentYearRes.ok ? await currentYearRes.json() : { data: [] };
    const prevYearData = prevYearRes.ok ? await prevYearRes.json() : { data: [] };
    const typesData = typesRes.ok ? await typesRes.json() : { data: [] };
    const sourcesData = sourcesRes.ok ? await sourcesRes.json() : { data: [] };
    const businessTypes = typesData.data.filter((t: { isbusinessincome?: boolean }) => t.isbusinessincome === true);
    const sources = sourcesData.data || [];
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
            if (
              entry.account_id != null &&
              entry.current_month_balance != null &&
              entry.previous_month_balance != null
            ) {
              total += parseFloat(String(entry.current_month_balance)) - parseFloat(String(entry.previous_month_balance));
            } else {
              total += parseFloat(String(entry.price));
            }
          }
        });
      });
      return hasAny ? total : null;
    };
    const v1 = getMonthlyTotal(month1, year1);
    const v2 = getMonthlyTotal(month2, year2);
    const count = (v1 != null ? 1 : 0) + (v2 != null ? 1 : 0);
    const averageMonthlyCashflow = count > 0 ? ((v1 ?? 0) + (v2 ?? 0)) / count : 0;
    if (averageMonthlyCashflow <= 0) {
      return NextResponse.json({ years: [], ages: [], projectedMonthlyCashflow: [] });
    }
    const annualIncreaseRate = cashflowIncrease / 100;
    const years: number[] = [];
    const ages: number[] = [];
    const projectedMonthlyCashflow: number[] = [];
    let projectedCashflow = averageMonthlyCashflow;
    const maxYears = 100;
    for (let year = currentYear; year <= currentYear + maxYears; year++) {
      years.push(year);
      ages.push(currentAge + (year - currentYear));
      projectedMonthlyCashflow.push(Number(projectedCashflow.toFixed(2)));
      if (projectedCashflow >= requiredCashflow) break;
      projectedCashflow = projectedCashflow * (1 + annualIncreaseRate);
    }
    return NextResponse.json({ years, ages, projectedMonthlyCashflow });
  } catch (err: unknown) {
    console.error('Cashflow projections error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to compute projections' },
      { status: 500 }
    );
  }
}
