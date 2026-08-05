import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyFinderStats,
  getLatestCompanyFinderRun,
  listCompanyFinder,
} from '@/app/utils/companyFinderDb';

function parseNum(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** GET /api/company-finder — list cached companies with buy-candidate filters. */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const candidatesOnly = sp.get('candidatesOnly') !== '0' && sp.get('candidatesOnly') !== 'false';
    const result = await listCompanyFinder({
      candidatesOnly,
      q: sp.get('q') ?? undefined,
      minMarketCap: parseNum(sp.get('minMarketCap')),
      maxMarketCap: parseNum(sp.get('maxMarketCap')),
      minCash: parseNum(sp.get('minCash')),
      minOcfYtd: parseNum(sp.get('minOcfYtd')),
      maxScore: parseNum(sp.get('maxScore')),
      limit: parseNum(sp.get('limit')) ?? 100,
      offset: parseNum(sp.get('offset')) ?? 0,
    });
    const [stats, latestRun] = await Promise.all([
      getCompanyFinderStats(),
      getLatestCompanyFinderRun(),
    ]);

    return NextResponse.json({
      disclaimer:
        'Score = market cap − cash − operating cash flow (YTD/TTM). Negative means cash + OCF exceed equity value. Not investment advice.',
      filters: {
        candidatesOnly,
        q: sp.get('q'),
        minMarketCap: parseNum(sp.get('minMarketCap')),
        maxMarketCap: parseNum(sp.get('maxMarketCap')),
        minCash: parseNum(sp.get('minCash')),
        minOcfYtd: parseNum(sp.get('minOcfYtd')),
        maxScore: parseNum(sp.get('maxScore')),
      },
      stats,
      latestRun,
      total: result.total,
      rows: result.rows,
    });
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'Company Finder tables missing',
          hint: 'Run scripts/migrations/030_company_finder.sql or node scripts/apply-company-finder.mjs',
        },
        { status: 500 }
      );
    }
    console.error('company-finder GET error:', e);
    return NextResponse.json(
      { error: err.message || 'Failed to load Company Finder' },
      { status: 500 }
    );
  }
}
