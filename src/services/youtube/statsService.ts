import 'server-only';

import { fetchChannelById, fetchVideosByIds } from './youtubeClient';
import { createLogger } from '@/lib/logger';
import { prisma } from '@/lib/db/prisma';

/**
 * Statistics upkeep: keeping view/like/comment counts fresh, and recording one
 * snapshot per channel per day.
 *
 * Why this exists separately from videoSyncService: that service is driven by
 * the uploads playlist and therefore only ever touches videos it can reach in
 * its page budget — i.e. the newest ones. A video published in 2022 would be
 * imported once and its view count frozen forever. Statistics are the one
 * mirror that changes for videos nothing else revisits.
 *
 * Quota: `videos.list` costs 1 unit per request regardless of how many IDs or
 * parts it carries, so a full pass over ~1,750 videos is ~35 units against a
 * 10,000/day allowance. The batch cap below exists to bound WALL CLOCK on a
 * serverless invocation, not to protect quota.
 */

const log = createLogger('youtubeStats');

/** 50 is the YouTube maximum for a single `videos.list` id list. */
const BATCH_SIZE = 50;

/**
 * Videos re-read per run.
 *
 * Bounded by the route's `maxDuration = 60`, not by quota: 300 videos is 6
 * YouTube requests plus 300 row updates, which fits comfortably. At one run a
 * day the ~1,750-video catalogue turns over roughly every six days — fine for
 * numbers that are read as trends rather than live counters.
 */
const DEFAULT_LIMIT = 300;

export type StatsRefreshResult = {
  scanned: number;
  updated: number;
};

/**
 * Re-read statistics for the videos whose numbers are stalest.
 *
 * Ordered `statsSyncedAt` ascending with nulls first, so a video that has never
 * had statistics read is always served before one that merely has old ones.
 */
export async function refreshVideoStats(
  limit = DEFAULT_LIMIT,
  /**
   * When to stop fetching. The scheduled run passes the point by which the
   * whole invocation must be done, because the import ahead of this may have
   * spent its own budget first — without it a backfilling channel and a full
   * statistics pass together outlast the function and it is killed mid-write.
   */
  deadline = Number.POSITIVE_INFINITY,
): Promise<StatsRefreshResult> {
  const stale = await prisma.youTubeVideo.findMany({
    orderBy: { statsSyncedAt: { sort: 'asc', nulls: 'first' } },
    take: limit,
    select: { youtubeVideoId: true },
  });

  if (stale.length === 0) return { scanned: 0, updated: 0 };

  const now = new Date();
  let updated = 0;

  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    // Checked between batches, so a partial refresh keeps every batch it
    // completed. `statsSyncedAt` orders the queue, so the videos this run did
    // not reach are simply first in line tomorrow.
    if (Date.now() >= deadline) {
      log.info(`Statistics refresh stopped early at ${i} of ${stale.length}`);
      break;
    }

    const batch = stale.slice(i, i + BATCH_SIZE).map((v) => v.youtubeVideoId);
    const details = await fetchVideosByIds(batch);

    const writes = details
      // Same rule as the sync: only write what was actually learned. A video
      // with likes hidden must keep its stored likeCount rather than gain a
      // fabricated zero.
      .filter((detail) => detail.viewCount !== null)
      .map((detail) =>
        prisma.youTubeVideo.update({
          where: { youtubeVideoId: detail.videoId },
          data: {
            viewCount: detail.viewCount,
            ...(detail.likeCount !== null ? { likeCount: detail.likeCount } : {}),
            ...(detail.commentCount !== null ? { commentCount: detail.commentCount } : {}),
            statsSyncedAt: now,
          },
        }),
      );

    // One round trip per batch of 50 rather than 50 — the difference between
    // this pass fitting inside the route's 60s budget and not.
    await prisma.$transaction(writes);
    updated += writes.length;
  }

  log.info(`Refreshed statistics for ${updated} of ${stale.length} videos`);
  return { scanned: stale.length, updated };
}

/**
 * Record today's channel totals — one row per channel per day.
 *
 * The Data API only ever reports the CURRENT total, so without this history no
 * growth line can be drawn. Re-running on the same day overwrites that day's
 * row rather than adding a second one, which is what makes the daily cron safe
 * to retry and a manual "Sync Now" harmless.
 */
export async function recordDailyChannelStats(): Promise<number> {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true },
    select: { id: true, name: true, youtubeChannelId: true },
  });

  // Midnight UTC: the column is a DATE, and building it from local time would
  // land two servers in different time zones on different days.
  const today = new Date();
  const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  let written = 0;

  for (const channel of channels) {
    try {
      const info = await fetchChannelById(channel.youtubeChannelId);
      if (info.viewCount === null || info.subscriberCount === null) {
        // A snapshot with a missing number is worse than no snapshot: it would
        // read as a cliff on the growth chart.
        log.warn(`Skipping snapshot for ${channel.name}: statistics not reported`);
        continue;
      }

      const values = {
        views: BigInt(info.viewCount),
        subscribers: info.subscriberCount,
        videos: info.videoCount ?? 0,
      };

      await prisma.channelStatDaily.upsert({
        where: { channelId_date: { channelId: channel.id, date } },
        create: { channelId: channel.id, date, ...values },
        update: values,
      });

      await prisma.youTubeChannel.update({
        where: { id: channel.id },
        data: {
          subscriberCount: info.subscriberCount,
          channelViewCount: BigInt(info.viewCount),
          ...(info.videoCount !== null ? { videoCount: info.videoCount } : {}),
        },
      });

      written++;
    } catch (error) {
      // One channel failing must not stop the others (section 36).
      const message = error instanceof Error ? error.message : 'Unknown error';
      log.error(`Snapshot failed for ${channel.name}`, message);
    }
  }

  return written;
}
