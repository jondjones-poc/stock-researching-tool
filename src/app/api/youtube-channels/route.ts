import { NextRequest, NextResponse } from 'next/server';
import {
  deleteYouTubeChannel,
  insertYouTubeChannel,
  loadYouTubeChannelsFromDb,
} from '../../utils/youtubeChannelsDb';
import { fetchChannelVideos, resolveYouTubeChannelId } from '../../utils/youtubeFeed';

export async function GET() {
  try {
    const channels = await loadYouTubeChannelsFromDb();
    return NextResponse.json({ data: channels });
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
    return NextResponse.json({ error: 'Failed to load channels', details: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urlOrId } = body as { urlOrId?: string };

    if (!urlOrId?.trim()) {
      return NextResponse.json({ error: 'urlOrId is required' }, { status: 400 });
    }

    const resolved = await resolveYouTubeChannelId(urlOrId.trim());
    const feed = await fetchChannelVideos(resolved.channelId, resolved.displayName);
    const displayName = resolved.displayName ?? feed.channelTitle ?? resolved.channelId;

    const created = await insertYouTubeChannel({
      channelId: resolved.channelId,
      displayName,
      channelUrl: resolved.channelUrl,
    });

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === '23505') {
      return NextResponse.json({ error: 'That channel is already subscribed' }, { status: 409 });
    }
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
    return NextResponse.json({ error: 'Failed to add channel', details: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const channelId = request.nextUrl.searchParams.get('channelId');
  if (!channelId) {
    return NextResponse.json({ error: 'channelId parameter is required' }, { status: 400 });
  }

  try {
    const ok = await deleteYouTubeChannel(channelId);
    if (!ok) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Channel removed' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to remove channel', details: message }, { status: 500 });
  }
}
