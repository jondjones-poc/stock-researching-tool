import { query } from './db';

export interface YouTubeChannelRow {
  id: number;
  channelId: string;
  displayName: string;
  channelUrl: string | null;
  displayOrder: number;
}

interface DbRow {
  id: number;
  channel_id: string;
  display_name: string;
  channel_url: string | null;
  display_order: number;
}

function rowToChannel(row: DbRow): YouTubeChannelRow {
  return {
    id: row.id,
    channelId: row.channel_id,
    displayName: row.display_name,
    channelUrl: row.channel_url,
    displayOrder: row.display_order,
  };
}

export async function loadYouTubeChannelsFromDb(): Promise<YouTubeChannelRow[]> {
  const result = await query(
    `SELECT id, channel_id, display_name, channel_url, display_order
     FROM youtube_channels
     WHERE is_active = true
     ORDER BY display_order, display_name`
  );
  return result.rows.map((row) => rowToChannel(row as DbRow));
}

export async function insertYouTubeChannel(input: {
  channelId: string;
  displayName: string;
  channelUrl?: string | null;
}): Promise<YouTubeChannelRow> {
  const orderResult = await query(
    'SELECT COALESCE(MAX(display_order), 0) + 1 AS next_order FROM youtube_channels'
  );
  const displayOrder = Number(orderResult.rows[0]?.next_order ?? 1);

  const result = await query(
    `INSERT INTO youtube_channels (channel_id, display_name, channel_url, display_order, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING id, channel_id, display_name, channel_url, display_order`,
    [
      input.channelId,
      input.displayName.trim(),
      input.channelUrl?.trim() || `https://www.youtube.com/channel/${input.channelId}`,
      displayOrder,
    ]
  );

  return rowToChannel(result.rows[0] as DbRow);
}

export async function deleteYouTubeChannel(channelId: string): Promise<boolean> {
  const result = await query(
    `UPDATE youtube_channels
     SET is_active = false, updated_at = CURRENT_TIMESTAMP
     WHERE channel_id = $1
     RETURNING channel_id`,
    [channelId]
  );
  return result.rows.length > 0;
}
