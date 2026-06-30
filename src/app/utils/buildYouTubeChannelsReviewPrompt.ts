import type { YouTubeChannelRow } from './youtubeChannelsDb';
import type { YouTubeFeedVideo } from './youtubeFeed';

export function buildYouTubeChannelsReviewPrompt(
  channels: YouTubeChannelRow[],
  videos: YouTubeFeedVideo[] = []
): string {
  const channelLines = channels
    .map((channel, i) => {
      const url = channel.channelUrl ?? `https://www.youtube.com/channel/${channel.channelId}`;
      return `${i + 1}. ${channel.displayName} — ${url}`;
    })
    .join('\n');

  const recentVideos = videos.slice(0, 20);
  const videoSection =
    recentVideos.length > 0
      ? `\nRecent videos from my feed:\n${recentVideos
          .map((v) => `- "${v.title}" (${v.channelName})`)
          .join('\n')}\n`
      : '';

  return `I use YouTube for investment and stock market research. Please review my current channel subscriptions and help me improve my feed.

My subscribed channels:
${channelLines}
${videoSection}
Please:
1. Review this channel lineup — quality, overlap, blind spots, and whether I'm getting balanced coverage
2. Flag any channels I'm subscribed to that may be low quality, redundant, or not worth my time — and why
3. Recommend better or complementary YouTube channels I should add, split into these three sections:
   - **US stocks** — US equities, sectors, earnings, macro affecting US markets
   - **Dividend stocks** — dividend investing, income, REITs, dividend growth, yield
   - **Rest of the world stock insights** — international markets, emerging markets, global macro, non-US exchanges

For each recommended channel:
- Include channel name and URL or @handle
- Explain why it would improve my feed and what gap it fills
- Give an **Add score out of 10** (10 = strongly recommend adding), based on:
  - **Subscriber count** — reach and established audience (estimate if needed)
  - **Online feedback** — reputation, reviews, community sentiment, quality of discussion
  - **Positive news** — recent favourable coverage, awards, notable endorsements, or consistent praise from credible sources
- Briefly note how you weighted those three factors for the score

Be specific and practical. Prioritise channels with consistent, evidence-based content over hype.`;
}
