import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Try to get cookies - this can fail in some Next.js contexts
    let cookieStore;
    try {
      cookieStore = await cookies();
    } catch (cookieError: any) {
      console.error('Error accessing cookies:', cookieError);
      // If cookies() fails, return not authenticated
      return NextResponse.json({ authenticated: false });
    }

    if (!cookieStore) {
      return NextResponse.json({ authenticated: false });
    }

    const username = cookieStore.get('username')?.value;

    if (username === 'jondjones') {
      return NextResponse.json({ authenticated: true });
    } else {
      return NextResponse.json({ authenticated: false });
    }
  } catch (error: any) {
    console.error('Error in auth check:', error);
    console.error('Error stack:', error?.stack);
    // Return false on any error, don't crash - always return 200 so frontend can handle
    return NextResponse.json({ 
      authenticated: false,
      error: error?.message || 'Authentication check failed'
    }, { status: 200 });
  }
}

