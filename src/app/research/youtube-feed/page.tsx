'use client';

import { useCallback, useEffect, useState } from 'react';
import type { YouTubeFeedVideo } from '../../utils/youtubeFeed';
import type { YouTubeChannelRow } from '../../utils/youtubeChannelsDb';
import { buildYouTubeChannelsReviewPrompt } from '../../utils/buildYouTubeChannelsReviewPrompt';

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

interface YouTubeAddChannelFormProps {
  onAdded: () => void;
  onCancel: () => void;
}

function YouTubeAddChannelForm({ onAdded, onCancel }: YouTubeAddChannelFormProps) {
  const [urlOrId, setUrlOrId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/youtube-channels', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urlOrId }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to add channel');
      }
      setUrlOrId('');
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add channel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white">Subscribe to a channel</h3>
        <button
          type="button"
          onClick={() => {
            onCancel();
            setError(null);
          }}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        Paste a channel URL, @handle, or channel ID (UC…). Latest videos are pulled via YouTube RSS.
      </p>
      {error && (
        <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      <input
        required
        value={urlOrId}
        onChange={(e) => setUrlOrId(e.target.value)}
        placeholder="https://www.youtube.com/@channel or UCxxxxxxxxxxxxxxxxxxxxxx"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />
      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium"
      >
        {saving ? 'Adding…' : 'Add channel'}
      </button>
    </form>
  );
}

interface YouTubeVideoCardProps {
  video: YouTubeFeedVideo;
}

function YouTubeVideoCard({ video }: YouTubeVideoCardProps) {
  return (
    <a
      href={video.watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group block cursor-pointer"
    >
      <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-200 dark:bg-gray-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={video.thumbnailUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          loading="lazy"
        />
      </div>
      <div className="mt-3 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400">
          {video.title}
        </h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">{video.channelName}</p>
        <p className="text-xs text-gray-500 dark:text-gray-500">{formatRelativeTime(video.publishedAt)}</p>
      </div>
    </a>
  );
}

export default function YouTubeFeedPage() {
  const [channels, setChannels] = useState<YouTubeChannelRow[]>([]);
  const [videos, setVideos] = useState<YouTubeFeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [askAiCopied, setAskAiCopied] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/youtube-feed', { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.hint ? `${data.error}. ${data.hint}` : data.details || data.error || 'Failed to load feed');
      }
      setChannels(data.channels || []);
      setVideos(data.videos || []);
      setFetchedAt(data.fetchedAt || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      setChannels([]);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleAskAi = async () => {
    try {
      setAskAiCopied(true);
      const prompt = buildYouTubeChannelsReviewPrompt(channels, videos);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(prompt);
        setTimeout(() => setAskAiCopied(false), 3000);
      } else {
        setAskAiCopied(false);
        setError('Could not access clipboard.');
      }
    } catch (err: unknown) {
      setAskAiCopied(false);
      setError(err instanceof Error ? err.message : 'Failed to copy prompt');
    }
  };

  const handleRemoveChannel = async (channelId: string) => {
    setRemovingId(channelId);
    try {
      const response = await fetch(`/api/youtube-channels?channelId=${encodeURIComponent(channelId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.details || data.error || 'Failed to remove channel');
      }
      await loadFeed();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove channel');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">📺 YouTube Feed</h1>
          {!addChannelOpen && (
            <button
              type="button"
              onClick={() => setAddChannelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              Add channel
            </button>
          )}
        </div>

        <div className="mb-6 space-y-4">
          {addChannelOpen && (
            <YouTubeAddChannelForm
              onAdded={() => {
                setAddChannelOpen(false);
                loadFeed();
              }}
              onCancel={() => setAddChannelOpen(false)}
            />
          )}

          {channels.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <button
                type="button"
                onClick={() => void handleAskAi()}
                disabled={askAiCopied}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  askAiCopied
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                    : 'border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/20 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                }`}
              >
                {askAiCopied ? '✓ Copied!' : '🤖 Ask AI'}
              </button>
              {channels.map((channel) => (
                <span
                  key={channel.channelId}
                  className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200"
                >
                  <a
                    href={channel.channelUrl ?? `https://www.youtube.com/channel/${channel.channelId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-red-600 dark:hover:text-red-400"
                  >
                    {channel.displayName}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveChannel(channel.channelId)}
                    disabled={removingId === channel.channelId}
                    className="w-5 h-5 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 disabled:opacity-50"
                    title="Unsubscribe"
                    aria-label={`Remove ${channel.displayName}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-video rounded-xl bg-gray-200 dark:bg-gray-800" />
                <div className="mt-3 space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-full" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400 mb-2">No channels yet.</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Add a YouTube channel above to build your feed.
            </p>
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-12 text-center">
            <p className="text-gray-600 dark:text-gray-400">No recent videos found for your channels.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
            {videos.map((video) => (
              <YouTubeVideoCard key={`${video.channelId}-${video.videoId}`} video={video} />
            ))}
          </div>
        )}

        {fetchedAt && !loading && (
          <p className="mt-6 text-xs text-gray-500 dark:text-gray-400 text-right">
            Updated {new Date(fetchedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
