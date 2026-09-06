import 'server-only';

import type { YouTubeChannel } from '@prisma/client';

import { youtubeConfig } from '@/config/youtube.config';
import { raise } from '@/features/notifications/notify';
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
  /** Videos removed because YouTube no longer lists them. */
  deleted?: number;
  /**
   * True when a deletion pass found more missing than `MAX_DELETION_SHARE` and
   * refused to act. Surfaced so it can be reported rather than buried in a log.
   */
  deletionRefused?: boolean;
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
): Promise<{ imported: number; updated: number; nextPageToken?: string; seen: Set<string> }> {
  let pageToken = startToken;
  let imported = 0;
  let updated = 0;
  /*
   * Every video id this walk saw on YouTube.
   *
   * Collected so a COMPLETED walk can name what is missing — a video the
   * playlist no longer offers has been deleted or made private. Ids only, not
   * rows: 1,700 short strings is nothing to hold, where the video objects
   * would be megabytes.
   */
  const seen = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const result = await fetchUploadsPage(channel.uploadsPlaylistId, pageToken);
    for (const video of result.videos) seen.add(video.videoId);
    const counts = await importVideos(channel, result.videos);
    imported += counts.imported;
    updated += counts.updated;

    // End of the playlist. This is the only place a channel is declared
    // complete, and it is why the token is returned rather than a page count.
    if (!result.nextPageToken) return { imported, updated, nextPageToken: undefined, seen };

    /*
     * A token that hands back itself would loop forever. Treating it as the
     * end is wrong — there may genuinely be more — so it stops and keeps the
     * token, which leaves the channel marked as still importing rather than
     * silently declaring it done.
     */
    if (result.nextPageToken === pageToken) {
      log.warn(`${channel.name}: YouTube repeated a page token, stopping this run`);
      return { imported, updated, nextPageToken: result.nextPageToken, seen };
    }

    pageToken = result.nextPageToken;

    // Checked AFTER a page is safely stored, so the budget can only cost us
    // the next request, never work already done.
    if (Date.now() >= deadline) {
      log.info(`${channel.name}: time budget reached after ${page + 1} pages, will resume`);
      return { imported, updated, nextPageToken: pageToken, seen };
    }
  }

  return { imported, updated, nextPageToken: pageToken, seen };
}

/**
 * How much of a channel may disappear in one run before the deletion pass
 * refuses to act.
 *
 * A completed walk that returns far fewer videos than the database holds is far
 * more likely to be YouTube serving a truncated playlist than the label having
 * deleted a third of its catalogue overnight. The pass stops and records the
 * fact instead, leaving a person to decide.
 */
const MAX_DELETION_SHARE = 0.2;

/**
 * Whether a deletion pass should stand down.
 *
 * Its own function so the rule can be tested without a database or a network:
 * it is the one thing standing between a truncated response from YouTube and an
 * emptied catalogue, and "I reasoned about it carefully" is not the same as
 * knowing.
 */
export function refusesDeletion(held: number, gone: number): boolean {
  if (held === 0 || gone === 0) return false;
  return gone / held > MAX_DELETION_SHARE;
}

/**
 * Remove videos that are no longer on YouTube.
 *
 * ONLY EVER CALLED WITH A COMPLETED WALK. `seen` has to be the whole uploads
 * playlist, because the rule is "in the database and not on YouTube" — run
 * against a partial walk it would delete everything the run did not reach.
 * `syncChannel` is the only caller and it checks that first.
 *
 * Deleting rather than hiding is what Rejoice asked for: a video taken off
 * YouTube leaves the website entirely. The cost is that a video made private
 * for a day is deleted here and re-imported as a new one when it comes back,
 * losing any custom title or thumbnail it carried — which is the reason the
 * guard above exists.
 */
async function removeDeletedVideos(
  channel: YouTubeChannel,
  seen: Set<string>,
): Promise<{ deleted: number; refused: boolean }> {
  const held = await prisma.youTubeVideo.findMany({
    where: { channelId: channel.id },
    select: { id: true, youtubeVideoId: true },
  });

  const gone = held.filter((video) => !seen.has(video.youtubeVideoId));
  if (gone.length === 0) return { deleted: 0, refused: false };

  if (refusesDeletion(held.length, gone.length)) {
    log.error(
      `${channel.name}: refusing to delete ${gone.length} of ${held.length} videos — ` +
        'the playlist looks truncated, not emptied',
    );
    return { deleted: 0, refused: true };
  }

  const { count } = await prisma.youTubeVideo.deleteMany({
    where: { id: { in: gone.map((video) => video.id) } },
  });

  log.info(`${channel.name}: removed ${count} video(s) no longer on YouTube`);
  return { deleted: count, refused: false };
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
    let deleted = 0;
    let deletionRefused = false;
    let cursor = channel.importCursor;

    if (cursor === null && full) {
      // A complete pass: from the newest video to the end of the catalogue.
      const run = await importPages(channel, undefined, youtubeConfig.maxPagesPerRun, deadline);
      imported += run.imported;
      updated += run.updated;
      cursor = run.nextPageToken ?? null;

      /*
       * THE DELETION PASS RUNS ONLY HERE, AND ONLY WHEN THE WALK FINISHED.
       *
       * Both halves matter. This branch is the one that starts at the newest
       * video, so `seen` is the whole playlist rather than a slice of it; and
       * an absent `nextPageToken` is the single place a channel is declared
       * complete. A walk that stopped for time, for a repeated token, or for an
       * error leaves the cursor set and is skipped — it cannot tell "deleted"
       * from "not reached yet", and acting on that guess would empty the
       * catalogue.
       */
      if (cursor === null) {
        /*
         * Its own try/catch: a failure here must not discard the import that
         * just succeeded. `syncChannel`'s outer catch returns the zeroed base
         * result, so without this a broken deletion pass would report "0 new
         * videos" after importing two thousand — and, worse, would leave
         * `lastSyncedAt` unstamped and the channel looking never-synced.
         */
        try {
          const removal = await removeDeletedVideos(channel, run.seen);
          deleted = removal.deleted;
          deletionRefused = removal.refused;
        } catch (error) {
          log.error(`${channel.name}: deletion pass failed, import kept`, error);
        }
      }
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
      `Synced ${channel.name}: ${imported} new, ${updated} refreshed, ${deleted} removed` +
        (cursor ? ' (back catalogue still importing)' : ''),
    );
    return { ...base, imported, updated, deleted, deletionRefused, importing: cursor !== null };
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
  await announce(results);
  return results;
}

/**
 * Tell the administrator, but ONLY WHEN SOMETHING CHANGED.
 *
 * Imported or deleted, nothing else. The refreshed count is deliberately not a
 * change: the daily run now walks the whole catalogue and refreshes all 1,755
 * videos every night by design, so counting that would post a notification
 * every single day saying nothing happened — which is exactly how a bell stops
 * being read.
 *
 * Never throws: `raise` swallows its own errors, and a note about a sync must
 * not be able to fail the sync.
 */
async function announce(results: SyncResult[]): Promise<void> {
  const imported = results.reduce((n, r) => n + r.imported, 0);
  const deleted = results.reduce((n, r) => n + (r.deleted ?? 0), 0);

  if (imported === 0 && deleted === 0) return;

  const parts: string[] = [];
  if (imported > 0) parts.push(`${imported} new video${imported === 1 ? '' : 's'}`);
  if (deleted > 0) parts.push(`${deleted} removed from YouTube`);

  await raise({
    kind: 'SYNC',
    title: parts.join(' · '),
    /*
     * Says what to do next, because a new video is not on the website yet:
     * imports arrive hidden by default, which is the one thing an administrator
     * has to know on reading this.
     */
    body:
      imported > 0
        ? 'New videos arrive hidden. Open YouTube Content to show them on the website.'
        : 'Videos taken down on YouTube have been removed from the website.',
    href: '/admin/youtube-content',
  });
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
