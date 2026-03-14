import { NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type InvestmentEntry = { month: string; invested: number | string };

/** GET - Current year: cumulative invested by month + target monthly average (amount_to_invest_per_year / 12) */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const currentYear = new Date().getFullYear();

    const [trackerRes, settingsRes] = await Promise.all([
      fetch(`${origin}/api/investment-tracker?year=${currentYear}`),
      fetch(`${origin}/api/settings`),
    ]);
    if (!trackerRes.ok) throw new Error('Failed to fetch investment tracker');
    if (!settingsRes.ok) throw new Error('Failed to fetch settings');

    const trackerJson = await trackerRes.json();
    const entries: InvestmentEntry[] = trackerJson.data || [];
    const settingsData = await settingsRes.json();
    const settings: { key: string; value: unknown }[] = settingsData.data || [];
    const getSetting = (keys: string[], def: number): number => {
      for (const key of keys) {
        const s = settings.find((x: { key: string }) => x.key === key);
        if (s && s.value != null && s.value !== '') {
          const n = parseFloat(String(s.value).replace(/,/g, ''));
          if (Number.isFinite(n)) return n;
        }
      }
      return def;
    };
    const amountToInvestPerYear = getSetting(['amount_to_invest_per_year', 'amountToInvestPerYear'], 0);
    const targetPerMonth = amountToInvestPerYear / 12;

    // Per-month invested (sum of entries for that month) + cumulative for reference
    const yearPrefix = String(currentYear);
    const monthlyInvested: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthlyInvested[m] = 0;
    entries.forEach((entry: InvestmentEntry) => {
      const entryMonth = entry.month; // YYYY-MM
      if (!entryMonth.startsWith(yearPrefix)) return;
      const mm = parseInt(entryMonth.slice(5, 7), 10);
      if (mm >= 1 && mm <= 12) {
        const amount = typeof entry.invested === 'string' ? parseFloat(entry.invested) : entry.invested;
        monthlyInvested[mm] += Number.isFinite(amount) ? amount : 0;
      }
    });

    const data: {
      monthLabel: string;
      month: number;
      investedThisMonth: number;
      cumulativeInvested: number;
      targetPerMonth: number;
      cumulativeTarget: number;
    }[] = [];
    let cumulative = 0;
    for (let m = 1; m <= 12; m++) {
      cumulative += monthlyInvested[m];
      // Target line: (amount_to_invest_per_year / 12) × month = cumulative target at that month
      const cumulativeTarget = (amountToInvestPerYear / 12) * m;
      data.push({
        monthLabel: `${MONTH_NAMES[m - 1]} ${currentYear}`,
        month: m,
        investedThisMonth: Number(monthlyInvested[m].toFixed(2)),
        cumulativeInvested: Number(cumulative.toFixed(2)),
        targetPerMonth: Number(targetPerMonth.toFixed(2)),
        cumulativeTarget: Number(cumulativeTarget.toFixed(2)),
      });
    }

    return NextResponse.json({
      data,
      amountToInvestPerYear: Number(amountToInvestPerYear.toFixed(2)),
      targetPerMonth: Number(targetPerMonth.toFixed(2)),
    });
  } catch (err: unknown) {
    console.error('Investment tracker current year error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load' },
      { status: 500 }
    );
  }
}
