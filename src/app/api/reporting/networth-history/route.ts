import { NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** GET - Networth time series from first to last available month (uses networth-report per year) */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get('origin') || new URL(request.url).origin;

    const yearsRes = await fetch(`${origin}/api/monthly-account-balances/years`);
    if (!yearsRes.ok) throw new Error('Failed to fetch years');
    const yearsData = await yearsRes.json();
    const years: number[] = yearsData.years || [];
    if (years.length === 0) return NextResponse.json({ data: [] });

    const data: { monthLabel: string; year: number; month: number; networth: number }[] = [];

    for (const year of years.sort((a, b) => a - b)) {
      const res = await fetch(`${origin}/api/networth-report?year=${year}`);
      if (!res.ok) continue;
      const json = await res.json();
      const monthData: Record<number, Record<string, number>> = json.monthData || {};
      const categories: string[] = json.categories || [];
      const monthsWithData: number[] = json.monthsWithData || [];

      // Use the single "Networth" category (id 10) value, not sum of all categories (which double-counts derived totals)
      const networthCategory = categories.find(
        (c: string) => c.toLowerCase().replace(/\s/g, '') === 'networth'
      );

      for (const month of monthsWithData.length > 0 ? monthsWithData : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
        const totals = monthData[month];
        if (!totals) continue;
        const networth =
          networthCategory != null && totals[networthCategory] != null
            ? totals[networthCategory]
            : categories.reduce((sum: number, cat: string) => sum + (totals[cat] || 0), 0);
        data.push({
          monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
          year,
          month,
          networth: Number(networth.toFixed(2)),
        });
      }
    }

    data.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
    return NextResponse.json({ data });
  } catch (err: unknown) {
    console.error('Networth history error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load networth history' },
      { status: 500 }
    );
  }
}
