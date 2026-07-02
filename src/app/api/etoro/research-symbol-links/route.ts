import { NextResponse } from 'next/server';
import { loadResearchSymbolLinks } from '@/app/utils/researchSymbolLinks';

/** GET - Serializable research symbol links for client-side matching. */
export async function GET() {
  try {
    const links = await loadResearchSymbolLinks();
    const serialized: Record<string, string[]> = {};
    for (const [key, values] of links) {
      serialized[key] = [...values];
    }
    return NextResponse.json({ links: serialized });
  } catch (e: unknown) {
    console.error('research-symbol-links GET error:', e);
    return NextResponse.json(
      { error: 'Failed to load research symbol links', details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
