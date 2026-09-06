import { NextResponse } from 'next/server';

import { isYouTubeConfigured, youtubeConfig } from '@/config/youtube.config';
import { createLogger } from '@/lib/logger';
import { refreshAllAnalytics } from '@/services/youtube/analyticsService';
import { recordDailyChannelStats, refreshVideoStats } from '@/services/youtube/statsService';
import { syncAllChannels } from '@/services/youtube/videoSyncService';

/**
 * Scheduled synchronization — the backup mechanism (section 12).
 *
 * Runs on the cron defined in vercel.json. Requires CRON_SECRET so the endpoint
 * cannot be triggered by anyone who finds the URL (section 37).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const log = createLogger('syncRoute');

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Refuse rather than run unprotected if the secret was never configured.
  if (!secret) return false;

  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;
}

async function runSync(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!isYouTubeConfigured()) {
    return NextResponse.json(
      { message: 'YOUTUBE_API_KEY is not configured.' },
      { status: 503 },
    );
  }

  try {
    // Everything below shares one invocation. The import has its own budget;
    // this is the point by which the statistics work must stop too.
    const runDeadline = Date.now() + youtubeConfig.runTimeBudgetMs;

    /*
     * A COMPLETE pass, not just the newest pages.
     *
     * It used to walk six pages per channel — enough to catch new uploads and
     * nothing else. Rejoice asked for the whole catalogue to be checked daily,
     * so that a title edited on YouTube, a video taken down, or anything
     * changed deep in the back catalogue is reflected here within a day rather
     * than never.
     *
     * `true` is the same complete walk a manual "Sync Now" does, and it is
     * bounded by time rather than by pages: if the catalogue is too large to
     * finish inside one invocation the run stores its place and the next one
     * continues, so nothing is lost and no page count has to be guessed.
     */
    const results = await syncAllChannels(true);
    const imported = results.reduce((n, r) => n + r.imported, 0);
    const deleted = results.reduce((n, r) => n + (r.deleted ?? 0), 0);
    log.info(
      `Scheduled sync complete: ${imported} new, ${deleted} removed across ${results.length} channels`,
    );

    /*
     * Statistics upkeep rides on the same run rather than a second cron.
     *
     * Both are deliberately allowed to fail without failing the sync: new
     * videos reaching the website is the job that matters, and a stale view
     * count is not worth a 500 that makes the run look broken.
     */
    const snapshots = await recordDailyChannelStats().catch((error: unknown) => {
      log.error('Daily channel snapshot failed', error);
      return 0;
    });

    /*
     * Analytics BEFORE the statistics pass, and outside its own failure.
     *
     * It is a fixed, small amount of work — a handful of API calls per
     * connected channel — where the statistics refresh expands to fill whatever
     * time is left. Running it second meant it would be the thing squeezed out
     * on a long night, which is the opposite of what a nightly reading is for.
     *
     * `refreshed: 0` is the normal answer until a channel is connected: the
     * analytics API needs a Google sign-in per channel that the API key cannot
     * stand in for.
     */
    const analytics = await refreshAllAnalytics().catch((error: unknown) => {
      log.error('Analytics refresh failed', error);
      return { refreshed: 0, failed: 0 };
    });

    const stats = await refreshVideoStats(undefined, runDeadline).catch((error: unknown) => {
      log.error('Video statistics refresh failed', error);
      return { scanned: 0, updated: 0 };
    });

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      channels: results.length,
      imported,
      deleted,
      snapshots,
      analytics,
      stats,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Synchronization failed';
    log.error('Scheduled sync failed', message);
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export const GET = runSync;
export const POST = runSync;
