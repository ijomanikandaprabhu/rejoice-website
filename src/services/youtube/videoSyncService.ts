import 'server-only';

import type { YouTubeChannel } from '@prisma/client';

import { youtubeConfig } from '@/config/youtube.config';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import {
  YouTubeApiError,
  YouTubeNotConfiguredError,
  fetchUploadsPage,
  fetchVideosByIds,
  type YouTubeVideoInfo,
} from './youtubeClient';

/**
 * Video import and synchronization (sections 11, 12, 36).
 *
 * The one rule that governs this whole module:
 *
 *     A sync may create records and may refresh the `youtube*` mirror fields.
 *     It must NEVER modify an administrator's website overrides or publishing
 *     decisions (Rule 7).
 *
 * Both sync entry points — the scheduled cron and the WebSub webhook — and the
 * admin "Sync Now" button all funnel through `importVideos` below, so that rule
 * is enforced in exactly one place.
 */

const log = createLogger('videoSync');

export type SyncResult = {
  channelId: string;
  channelName: string;
  imported: number;
  updated: number;
  skipped: number;
  ok: boolean;
  error?: string;
  /** True when this channel's back catalogue is only partly imported so far. */
  importing?: boolean;
};

/**
 * Persist a batch of videos for one channel.
 *
 * New video  -> insert, with visibility taken from the channel default (section 15).
 * Known video -> refresh only the YouTube mirror fields (section 36).
 */
async function importVideos(
  channel: YouTubeChannel,
  videos: YouTubeVideoInfo[],
): Promise<{ imported: number; updated: number }> {
  if (videos.length === 0) return { imported: 0, updated: 0 };

  // One query to find which of these we already hold. `youtubeVideoId` is unique,
  // so this is the duplicate guard (Rule 8 / section 36).
  const existing = await prisma.youTubeVideo.findMany({
    where: { youtubeVideoId: { in: videos.map((v) => v.videoId) } },
    select: { youtubeVideoId: true },
  });
  const known = new Set(existing.map((v) => v.youtubeVideoId));

  const startVisible = channel.defaultVideoVisibility === 'AUTO_SHOW';
  const now = new Date();

  /*
   * Writes are BATCHED rather than issued one row at a time.
   *
   * The previous loop did a Prisma round-trip per video. Against the local
   * embedded Postgres that is imperceptible; against a hosted database it is a
   * network round-trip each, and a full 2,000-video sync would spend well over
   * a minute in latency alone — past the serverless function ceiling, leaving
   * the import half-finished with no error to show for it.
   *
   * New rows go in a single `createMany`; existing rows still need per-row data
   * so they are chunked into transactions, which is one round-trip per chunk.
   * `statsService.refreshVideoStats` already does the same thing for the same
   * reason.
   */
  const CHUNK = 50;

  const fresh = videos.filter((v) => !known.has(v.videoId));
  const stale = videos.filter((v) => known.has(v.videoId));

  let imported = 0;

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const { count } = await prisma.youTubeVideo.createMany({
      // A concurrent sync (cron and webhook firing together) may have inserted
      // one of these between our read and this write. Skipping duplicates is
      // the batched equivalent of the unique-violation catch this replaces.
      skipDuplicates: true,
      data: fresh.slice(i, i + CHUNK).map((video) => ({
        youtubeVideoId: video.videoId,
        channelId: channel.id,
        youtubeTitle: video.title,
        youtubeDescription: video.description,
        youtubeThumbnail: video.thumbnail,
        youtubePublishedAt: video.publishedAt,
        youtubeUrl: video.url,
        durationSeconds: video.durationSeconds,
        // On create there is nothing to preserve, so an unknown shape takes
        // the column default of "not a Short" until a later sync learns it.
        isShort: video.isShort ?? false,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        statsSyncedAt: video.viewCount !== null ? now : null,
        isVisible: startVisible,
        importedAt: now,
        lastSyncedAt: now,
      })),
    });
    imported += count;
  }

  // Anything skipped as a duplicate was already there, so it counts as refreshed.
  let updated = fresh.length - imported;

  for (let i = 0; i < stale.length; i += CHUNK) {
    const writes = stale.slice(i, i + CHUNK).map((video) =>
      // Refresh the mirror of YouTube only. Every display*/publishing column is
      // absent from this update on purpose — see the module comment.
      prisma.youTubeVideo.update({
        where: { youtubeVideoId: video.videoId },
        data: {
          youtubeTitle: video.title,
          youtubeDescription: video.description,
          youtubeThumbnail: video.thumbnail,
          youtubePublishedAt: video.publishedAt,
          youtubeUrl: video.url,
          /*
           * Both of these are only written when we actually LEARNED a value.
           *
           * They are mirrors of YouTube rather than administrator decisions, so
           * unlike the display and publishing columns they are refreshed here
           * (Rule 7) — but a video missing from the detail lookup arrives with
           * both unset, and writing that through turned "we don't know" into
           * "it's a landscape video of unknown length", silently reclassifying
           * Shorts on every sync that hit a gap.
           */
          ...(video.durationSeconds !== null ? { durationSeconds: video.durationSeconds } : {}),
          ...(video.isShort !== null ? { isShort: video.isShort } : {}),
          /*
           * Statistics follow the same "only write what we learned" rule. An
           * owner who hides the like count makes YouTube omit the property
           * entirely; writing that through as 0 would report a real number we
           * do not have. `statsSyncedAt` is stamped only alongside a view
           * count, because it is what the refresh pass orders by — stamping it
           * on a lookup that returned nothing would push the row to the back of
           * the queue without having learned anything.
           */
          ...(video.viewCount !== null ? { viewCount: video.viewCount, statsSyncedAt: now } : {}),
          ...(video.likeCount !== null ? { likeCount: video.likeCount } : {}),
          ...(video.commentCount !== null ? { commentCount: video.commentCount } : {}),
          lastSyncedAt: now,
        },
      }),
    );

    await prisma.$transaction(writes);
    updated += writes.length;
  }

  return { imported, updated };
}

/**
 * Walk the uploads playlist, importing each page as it arrives.
 *
 * Returns where it stopped: `nextPageToken` is undefined only when the last
 * page of the playlist was read, so the caller can tell "finished" from "ran
 * out of time" — the two look identical from the outside otherwise.
 *
 * Importing page by page rather than collecting everything first is what makes
 * an interrupted run useful: whatever was fetched is already in the database.
 */
async function importPages(
  channel: YouTubeChannel,
  startToken: string | undefined,
  maxPages: number,
  deadline: number,
): Promise<{ imported: number; updated: number; nextPageToken?: string }> {
  let pageToken = startToken;
  let imported = 0;
  let updated = 0;

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchUploadsPage(channel.uploadsPlaylistId, pageToken);
    const counts = await importVideos(channel, result.videos);
    imported += counts.imported;
    updated += counts.updated;

    // End of the playlist. This is the only place a channel is declared
    // complete, and it is why the token is returned rather than a page count.
    if (!result.nextPageToken) return { imported, updated, nextPageToken: undefined };

    /*
     * A token that hands back itself would loop forever. Treating it as the
     * end is wrong — there may genuinely be more — so it stops and keeps the
     * token, which leaves the channel marked as still importing rather than
     * silently declaring it done.
     */
    if (result.nextPageToken === pageToken) {
      log.warn(`${channel.name}: YouTube repeated a page token, stopping this run`);
      return { imported, updated, nextPageToken: result.nextPageToken };
    }

    pageToken = result.nextPageToken;

    // Checked AFTER a page is safely stored, so the budget can only cost us
    // the next request, never work already done.
    if (Date.now() >= deadline) {
      log.info(`${channel.name}: time budget reached after ${page + 1} pages, will resume`);
      return { imported, updated, nextPageToken: pageToken };
    }
  }

  return { imported, updated, nextPageToken: pageToken };
}

/**
 * Synchronize one channel.
 *
 * `full` asks for the whole back catalogue — used by the first import after
 * connecting a channel and by a manual "Sync Now". It is bounded by time, not
 * by a page count: if the catalogue is too large to finish inside one
 * serverless invocation, the run stores its place in `importCursor` and the
 * next run picks up from there. Nothing is lost and nothing needs a number
 * chosen in advance, so a channel of any size eventually imports in full.
 *
 * The scheduled run only needs the newest page or two — except while a
 * catalogue is still being backfilled, when it does both: the newest pages so
 * fresh uploads are not held up behind the backlog, then more of the backlog.
 */
export async function syncChannel(
  channelDbId: string,
  full = false,
  /**
   * When this run must stop fetching. Defaults to a budget of its own for a
   * single-channel sync, but `syncAllChannels` passes ONE deadline shared by
   * every channel — see there for why.
   */
  deadline = Date.now() + youtubeConfig.syncTimeBudgetMs,
): Promise<SyncResult> {
  const channel = await prisma.youTubeChannel.findUnique({ where: { id: channelDbId } });
  if (!channel) throw new Error(`Channel ${channelDbId} not found`);

  const base: SyncResult = {
    channelId: channel.id,
    channelName: channel.name,
    imported: 0,
    updated: 0,
    skipped: 0,
    ok: true,
  };

  if (!channel.isActive) {
    return { ...base, skipped: 1 };
  }

  try {
    let imported = 0;
    let updated = 0;
    let cursor = channel.importCursor;

    if (cursor === null && full) {
      // Fresh deep import: from the newest video to the end of the catalogue.
      const run = await importPages(channel, undefined, youtubeConfig.maxPagesPerRun, deadline);
      imported += run.imported;
      updated += run.updated;
      cursor = run.nextPageToken ?? null;
    } else {
      // The newest pages, always — a backfill in progress must not delay a
      // video published this morning.
      const head = await importPages(channel, undefined, youtubeConfig.maxPagesPerSync, deadline);
      imported += head.imported;
      updated += head.updated;

      /*
       * The backfill is skipped once the run is out of time. The head pass
       * above is always allowed its page — a video published this morning must
       * not wait behind a backlog — but the backlog itself has no such claim,
       * and starting a pass that is guaranteed to stop after one page is how a
       * shared budget would still overrun across several channels.
       */
      if (cursor !== null && Date.now() < deadline) {
        try {
          const rest = await importPages(channel, cursor, youtubeConfig.maxPagesPerRun, deadline);
          imported += rest.imported;
          updated += rest.updated;
          cursor = rest.nextPageToken ?? null;
        } catch (error) {
          /*
           * A page token YouTube no longer accepts would otherwise deadlock the
           * channel: the run fails, the cursor is kept precisely so the next run
           * can resume, and that run fails on the same token forever. Dropping
           * it restarts the backfill from the newest video, which costs a
           * re-read of pages already held — every one of them deduplicates —
           * and is the only way out that does not need a person to notice.
           *
           * Narrowed to 400 on purpose. A quota or network failure says nothing
           * about the token, and throwing away a large catalogue's progress
           * over a bad night would be far worse than waiting a day.
           */
          if (error instanceof YouTubeApiError && error.status === 400) {
            log.warn(`${channel.name}: stored page token rejected, restarting the backfill`);
            cursor = null;
          } else {
            throw error;
          }
        }
      }
    }

    // lastSyncedAt is only stamped on success, so the admin screen never claims a
    // sync that failed (section 36).
    await prisma.youTubeChannel.update({
      where: { id: channel.id },
      data: { lastSyncedAt: new Date(), lastSyncError: null, importCursor: cursor },
    });

    log.info(
      `Synced ${channel.name}: ${imported} new, ${updated} refreshed` +
        (cursor ? ' (back catalogue still importing)' : ''),
    );
    return { ...base, imported, updated, importing: cursor !== null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown synchronization error';
    log.error(`Sync failed for ${channel.name}`, message);

    /*
     * `importCursor` is deliberately NOT written here. A failed run leaves it
     * exactly as it was, so the next attempt resumes from the last page that
     * actually landed rather than restarting the whole catalogue.
     */
    await prisma.youTubeChannel.update({
      where: { id: channel.id },
      data: { lastSyncError: message.slice(0, 500) },
    });

    return { ...base, ok: false, error: message };
  }
}

/**
 * Synchronize every connected channel.
 *
 * One channel failing must not stop the others (section 36), so each is wrapped
 * individually and failures are reported rather than thrown.
 */
export async function syncAllChannels(full = false): Promise<SyncResult[]> {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });

  /*
   * ONE deadline for the whole run, not one per channel.
   *
   * The budget exists to stay inside a single serverless invocation, and the
   * channels are synced one after another inside that same invocation. Giving
   * each its own fresh budget would let two backfilling channels spend 80
   * seconds against a 60-second ceiling — the run would be killed part way,
   * losing the channels it had not reached yet and the `recordSyncRun` stamp
   * with them. Sharing it means a long backfill simply yields to the next
   * channel and resumes tomorrow.
   *
   * Every channel still gets its newest page regardless of the clock:
   * `importPages` checks the deadline only after a page has been stored, so a
   * video published this morning is never starved by a backlog elsewhere.
   */
  const deadline = Date.now() + youtubeConfig.syncTimeBudgetMs;

  const results: SyncResult[] = [];

  for (const { id } of channels) {
    try {
      results.push(await syncChannel(id, full, deadline));
    } catch (error) {
      if (error instanceof YouTubeNotConfiguredError) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      results.push({
        channelId: id,
        channelName: id,
        imported: 0,
        updated: 0,
        skipped: 0,
        ok: false,
        error: message,
      });
    }
  }

  await recordSyncRun(results);
  return results;
}

/** Import specific video IDs — the push-notification path (section 12). */
export async function importVideosByIds(videoIds: string[]): Promise<number> {
  const videos = await fetchVideosByIds(videoIds);
  if (videos.length === 0) return 0;

  // Group by channel so each video is created with its own channel's default
  // visibility rather than a guess.
  const byChannel = new Map<string, YouTubeVideoInfo[]>();
  for (const video of videos) {
    const list = byChannel.get(video.channelId) ?? [];
    list.push(video);
    byChannel.set(video.channelId, list);
  }

  let imported = 0;

  for (const [youtubeChannelId, list] of byChannel) {
    const channel = await prisma.youTubeChannel.findUnique({ where: { youtubeChannelId } });
    if (!channel) {
      // A push for a channel Rejoice has not connected. Ignore it.
      log.warn(`Push notification for unconnected channel ${youtubeChannelId}`);
      continue;
    }
    const result = await importVideos(channel, list);
    imported += result.imported;
  }

  return imported;
}

const LAST_SYNC_KEY = 'youtube.lastSync';

export type LastSyncRecord = {
  at: string;
  ok: boolean;
  imported: number;
  updated: number;
  failures: Array<{ channel: string; error: string }>;
  /**
   * When synchronization last actually SUCCEEDED.
   *
   * `at`/`ok` describe the most recent attempt, so after one bad night they say
   * nothing about the month of good ones before it — and the Settings screen,
   * which is labelled "last successful synchronization", was reduced to saying
   * "None recorded". Carried forward across failures so that history survives.
   */
  lastOkAt?: string | null;
};

/**
 * Stamp the global "last synchronization" record shown in the admin portal.
 *
 * Called by the scheduled run and by a manual "Sync now" alike — a sync the
 * administrator triggered by hand is still a synchronization, and if only the
 * cron recorded it the dashboard would keep claiming none had ever run.
 */
export async function recordSyncRun(results: SyncResult[]): Promise<void> {
  const previous = await getLastSyncRecord();
  const now = new Date().toISOString();
  const ok = results.every((r) => r.ok);

  const failures = results
    .filter((r) => !r.ok)
    .map((r) => ({ channel: r.channelName, error: r.error ?? 'Unknown' }));

  /*
   * Carry forward failures for channels this run did not touch.
   *
   * A single-channel "Sync now" calls this with one result. Rebuilding the list
   * from that alone erased a recorded failure for every OTHER channel, so the
   * dashboard went quiet while the per-channel badge still showed the error —
   * two screens disagreeing about the same fact.
   */
  const syncedNames = new Set(results.map((r) => r.channelName));
  const carried = (previous?.failures ?? []).filter((f) => !syncedNames.has(f.channel));

  const record: LastSyncRecord = {
    at: now,
    ok,
    imported: results.reduce((n, r) => n + r.imported, 0),
    updated: results.reduce((n, r) => n + r.updated, 0),
    failures: [...failures, ...carried],
    lastOkAt: ok ? now : (previous?.lastOkAt ?? null),
  };

  await prisma.siteSetting.upsert({
    where: { key: LAST_SYNC_KEY },
    create: { key: LAST_SYNC_KEY, value: record },
    update: { value: record },
  });
}

export async function getLastSyncRecord(): Promise<LastSyncRecord | null> {
  const row = await prisma.siteSetting.findUnique({ where: { key: LAST_SYNC_KEY } });
  return (row?.value as LastSyncRecord | undefined) ?? null;
}
