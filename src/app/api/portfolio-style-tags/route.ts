import { NextRequest, NextResponse } from 'next/server';
import {
  loadPortfolioStyleCategories,
  loadPortfolioStyleTags,
  styleTagsMigrationResponse,
  upsertPortfolioStyleTag,
} from '../../utils/portfolioStyleTags';

export async function GET() {
  try {
    const [categories, tags] = await Promise.all([
      loadPortfolioStyleCategories(),
      loadPortfolioStyleTags(),
    ]);
    return NextResponse.json({ categories, tags });
  } catch (error: unknown) {
    const migration = styleTagsMigrationResponse(error);
    if (migration) {
      return NextResponse.json(migration.body, { status: migration.status });
    }
    const message = error instanceof Error ? error.message : 'Failed to load style tags';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const symbol = String(body.symbol || '').trim().toUpperCase();
    const rawCategory = body.category;
    const category =
      rawCategory == null || rawCategory === '' || rawCategory === 'UNCATEGORIZED'
        ? null
        : String(rawCategory).trim();

    if (!symbol) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const result = await upsertPortfolioStyleTag(symbol, category);
    return NextResponse.json({ data: result });
  } catch (error: unknown) {
    const migration = styleTagsMigrationResponse(error);
    if (migration) {
      return NextResponse.json(migration.body, { status: migration.status });
    }
    const err = error as Error & { status?: number };
    const status = err.status === 400 ? 400 : 500;
    return NextResponse.json(
      { error: err.message || 'Failed to save style tag' },
      { status }
    );
  }
}
