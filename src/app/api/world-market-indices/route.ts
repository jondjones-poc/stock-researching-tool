import { NextRequest, NextResponse } from 'next/server';
import {
  type WorldMarketDataSource,
  parseCountryCodesInput,
  centroidFromCountryCodes,
} from '../../config/worldMarkets';
import {
  deleteWorldMarketIndex,
  insertWorldMarketIndex,
  loadWorldMarketIndicesFromDb,
} from '../../utils/worldMarketIndicesDb';

export async function GET() {
  try {
    const indices = await loadWorldMarketIndicesFromDb();
    return NextResponse.json({ data: indices });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load indices', details: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      indexName,
      symbol,
      dataSource,
      fredSeriesId,
      countryCodes,
      countryCodesText,
      lat,
      lng,
      icon,
      note,
    } = body as {
      name?: string;
      indexName?: string;
      symbol?: string;
      dataSource?: WorldMarketDataSource;
      fredSeriesId?: string;
      countryCodes?: string[];
      countryCodesText?: string;
      lat?: number;
      lng?: number;
      icon?: string;
      note?: string;
    };

    if (!name?.trim() || !indexName?.trim()) {
      return NextResponse.json({ error: 'name and indexName are required' }, { status: 400 });
    }

    if (dataSource !== 'FMP' && dataSource !== 'FRED') {
      return NextResponse.json({ error: 'dataSource must be FMP or FRED' }, { status: 400 });
    }

    if (!symbol?.trim()) {
      return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    if (dataSource === 'FRED' && !fredSeriesId?.trim()) {
      return NextResponse.json({ error: 'fredSeriesId is required for FRED data source' }, { status: 400 });
    }

    const codes = Array.isArray(countryCodes)
      ? countryCodes.map((c) => String(c).trim().toUpperCase()).filter((c) => /^[A-Z]{3}$/.test(c))
      : parseCountryCodesInput(countryCodesText ?? '');

    if (codes.length === 0) {
      return NextResponse.json(
        {
          error: 'At least one country code is required',
          hint: 'Use ISO 3166-1 alpha-3 codes (e.g. USA, GBR, DEU) to colour countries on the map',
        },
        { status: 400 }
      );
    }

    const centroid = centroidFromCountryCodes(codes);
    const finalLat = typeof lat === 'number' && Number.isFinite(lat) ? lat : centroid.lat;
    const finalLng = typeof lng === 'number' && Number.isFinite(lng) ? lng : centroid.lng;

    const created = await insertWorldMarketIndex({
      name: name.trim(),
      indexName: indexName.trim(),
      symbol: symbol.trim(),
      dataSource,
      fredSeriesId: fredSeriesId?.trim() || null,
      lat: finalLat,
      lng: finalLng,
      countryCodes: codes,
      icon: icon?.trim() || centroid.icon,
      note: note?.trim() || null,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      return NextResponse.json({ error: 'An index with this region name already exists' }, { status: 409 });
    }
    if (err.code === '42P01') {
      return NextResponse.json(
        { error: 'world_market_indices table does not exist', hint: 'Run scripts/apply-world-market-indices.mjs' },
        { status: 500 }
      );
    }
    const message = err.message ?? 'Unknown error';
    return NextResponse.json({ error: 'Failed to add index', details: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const slug = request.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ error: 'slug parameter is required' }, { status: 400 });
  }

  try {
    const ok = await deleteWorldMarketIndex(slug);
    if (!ok) {
      return NextResponse.json({ error: 'Index not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Index removed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to remove index', details: message }, { status: 500 });
  }
}
