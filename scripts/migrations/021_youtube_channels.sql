-- YouTube channels subscribed for the Research YouTube feed.

CREATE TABLE IF NOT EXISTS youtube_channels (
  id SERIAL PRIMARY KEY,
  channel_id VARCHAR(24) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  channel_url VARCHAR(512),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT youtube_channels_channel_id_format CHECK (channel_id ~ '^UC[A-Za-z0-9_-]{22}$')
);

CREATE INDEX IF NOT EXISTS idx_youtube_channels_active_order
  ON youtube_channels (is_active, display_order, display_name);

COMMENT ON TABLE youtube_channels IS 'YouTube channels shown on the Research YouTube feed page';
