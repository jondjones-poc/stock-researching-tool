import { NextRequest, NextResponse } from 'next/server';
import {
  getCompanyFinderFacets,
  getCompanyFinderStats,
  getLatestCompanyFinderRun,
  listCompanyFinder,
} from '@/app/utils/companyFinderDb';

function parseNum(v: string | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** GET /api/company-finder — list cached deep-value candidates. */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const minCashToMarketPct = parseNum(sp.get('minCashToMarketPct')) ?? 90;
    const minFcfToMarketPct = parseNum(sp.get('minFcfToMarketPct')) ?? 20;
    const minNetCashToMarketPct = parseNum(sp.get('minNetCashToMarketPct')) ?? 0;
    const includeMissingNetCash = sp.get('includeMissingNetCash') === 'true';
    const minConfidenceStars = parseNum(sp.get('minConfidenceStars')) ?? 5;
    const sector = sp.get('sector')?.trim() || null;
    const country = sp.get('country')?.trim() || null;
    const result = await listCompanyFinder({
      minCashToMarketPct,
      minNetCashToMarketPct,
      includeMissingNetCash,
      q: sp.get('q') ?? undefined,
      sector,
      country,
      minMarketCap: parseNum(sp.get('minMarketCap')),
      maxMarketCap: parseNum(sp.get('maxMarketCap')),
      minCash: parseNum(sp.get('minCash')),
      minOcfYtd: parseNum(sp.get('minOcfYtd')),
      minFcfYtd: parseNum(sp.get('minFcfYtd')),
      minFcfToMarketPct,
      minConfidenceStars,
      maxScore: parseNum(sp.get('maxScore')),
      limit: parseNum(sp.get('limit')) ?? 100,
      offset: parseNum(sp.get('offset')) ?? 0,
    });
    const [stats, latestRun, facets] = await Promise.all([
      getCompanyFinderStats(),
      getLatestCompanyFinderRun(),
      getCompanyFinderFacets(),
    ]);

    return NextResponse.json({
      disclaimer:
        'Deep value here means cash (and short-term investments when available) covers a large share of market value. Not investment advice.',
      filters: {
        minCashToMarketPct,
        minNetCashToMarketPct,
        includeMissingNetCash,
        minFcfToMarketPct,
        minConfidenceStars,
        q: sp.get('q'),
        sector,
        country,
        minMarketCap: parseNum(sp.get('minMarketCap')),
        maxMarketCap: parseNum(sp.get('maxMarketCap')),
        minCash: parseNum(sp.get('minCash')),
        minOcfYtd: parseNum(sp.get('minOcfYtd')),
        minFcfYtd: parseNum(sp.get('minFcfYtd')),
        maxScore: parseNum(sp.get('maxScore')),
      },
      facets,
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
