import { NextResponse } from 'next/server';
import { loadYouTubeChannelsFromDb } from '../../utils/youtubeChannelsDb';
import { fetchMergedYouTubeFeed } from '../../utils/youtubeFeed';

export async function GET() {
  try {
    const channels = await loadYouTubeChannelsFromDb();
    const videos = await fetchMergedYouTubeFeed(
      channels.map((c) => ({ channelId: c.channelId, displayName: c.displayName }))
    );

    return NextResponse.json({
      channels,
      videos,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '42P01') {
      return NextResponse.json(
        {
          error: 'youtube_channels table does not exist',
          hint: 'Run node scripts/apply-youtube-channels.mjs',
        },
        { status: 500 }
      );
    }
    const message = err.message ?? 'Unknown error';
    return NextResponse.json({ error: 'Failed to load YouTube feed', details: message }, { status: 500 });
  }
}
