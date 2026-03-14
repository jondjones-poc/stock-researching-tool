import { NextResponse } from 'next/server';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS_PER_MONTH = 730;

type IncomeType = { id: number; name: string; Is247wage?: boolean | null };
type IncomeSource = { id: number; name: string; income_type_id: number };
type IncomeEntry = {
  income_source_id: number;
  income_type_id: number;
  year: number;
  month: number;
  price: number | string;
  account_id?: number | null;
  current_month_balance?: number | string | null;
  previous_month_balance?: number | string | null;
};

/** Return trailing 12 months ending at (endYear, endMonth), inclusive */
function getTrailing12Months(endYear: number, endMonth: number): { year: number; month: number }[] {
  const out: { year: number; month: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    let m = endMonth - i;
    let y = endYear;
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    out.push({ year: y, month: m });
  }
  return out;
}

/** GET - 24/7 Wage hourly rate: trailing 12 months ending at current month (same logic as finances/24-7-wage page) */
export async function GET(request: Request) {
  try {
    const origin = request.headers.get('origin') || new URL(request.url).origin;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    const monthsToShow = getTrailing12Months(currentYear, currentMonth);
    const yearsToFetch = [...new Set(monthsToShow.map((m) => m.year))].sort((a, b) => a - b);

    const [typesRes, sourcesRes] = await Promise.all([
      fetch(`${origin}/api/income-types`),
      fetch(`${origin}/api/income-sources`),
    ]);
    if (!typesRes.ok) throw new Error('Failed to fetch income types');
    if (!sourcesRes.ok) throw new Error('Failed to fetch income sources');

    const typesData = await typesRes.json();
    const types: IncomeType[] = typesData.data || [];
    const sourcesData = await sourcesRes.json();
    const sources: IncomeSource[] = sourcesData.data || [];
    const typeIds247 = new Set(types.filter((t: IncomeType) => t.Is247wage === true).map((t: IncomeType) => t.id));
    const sourcesByTypeId = new Map<number, IncomeSource[]>();
    sources.forEach((s: IncomeSource) => {
      if (!sourcesByTypeId.has(s.income_type_id)) sourcesByTypeId.set(s.income_type_id, []);
      sourcesByTypeId.get(s.income_type_id)!.push(s);
    });

    const getTypeTotal = (entries: IncomeEntry[], typeId: number, month: number, year: number) => {
      const typeSources = sourcesByTypeId.get(typeId) || [];
      return typeSources.reduce((sum, src) => {
        const entry = entries.find(
          (e) =>
            e.income_source_id === src.id &&
            parseInt(String(e.month)) === month &&
            parseInt(String(e.year)) === year
        );
        if (!entry) return sum;
        if (
          entry.account_id != null &&
          entry.current_month_balance != null &&
          entry.previous_month_balance != null
        ) {
          const cur = parseFloat(String(entry.current_month_balance));
          const prev = parseFloat(String(entry.previous_month_balance));
          return sum + (cur - prev);
        }
        return sum + parseFloat(String(entry.price));
      }, 0);
    };

    const entriesByYear = new Map<number, IncomeEntry[]>();
    for (const year of yearsToFetch) {
      const entriesRes = await fetch(`${origin}/api/income-entries?year=${year}`);
      if (!entriesRes.ok) continue;
      const entriesJson = await entriesRes.json();
      entriesByYear.set(year, entriesJson.data || []);
    }

    const data: { monthLabel: string; year: number; month: number; hourlyWage: number }[] = [];

    for (const { year, month } of monthsToShow) {
      const entries = entriesByYear.get(year) || [];
      let sum247 = 0;
      typeIds247.forEach((typeId) => {
        sum247 += getTypeTotal(entries, typeId, month, year);
      });
      const hourlyWage = sum247 / HOURS_PER_MONTH;
      data.push({
        monthLabel: `${MONTH_NAMES[month - 1]} ${year}`,
        year,
        month,
        hourlyWage: Number(hourlyWage.toFixed(2)),
      });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    console.error('Wage247 history error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load 24/7 wage history' },
      { status: 500 }
    );
  }
}
