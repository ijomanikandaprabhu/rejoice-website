import { NextResponse } from 'next/server';

import { isYouTubeConfigured, youtubeConfig } from '@/config/youtube.config';
import { createLogger } from '@/lib/logger';
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

    const results = await syncAllChannels(false);
    const imported = results.reduce((n, r) => n + r.imported, 0);
    log.info(`Scheduled sync complete: ${imported} new videos across ${results.length} channels`);

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

    const stats = await refreshVideoStats(undefined, runDeadline).catch((error: unknown) => {
      log.error('Video statistics refresh failed', error);
      return { scanned: 0, updated: 0 };
    });

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      channels: results.length,
      imported,
      snapshots,
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
