import { NextResponse } from 'next/server';

import { youtubeConfig } from '@/config/youtube.config';
import { isYouTubeConfigured } from '@/config/youtube.config';
import { isAuthenticated } from '@/lib/auth/guard';
import { clearOldNotifications } from '@/features/notifications/notify';
import { createLogger } from '@/lib/logger';
import { refreshAllAnalytics } from '@/services/youtube/analyticsService';
import { recordDailyChannelStats, refreshVideoStats } from '@/services/youtube/statsService';
import { getLastSyncRecord, syncAllChannels } from '@/services/youtube/videoSyncService';

/**
 * The safety net under the daily schedule.
 *
 * WHY THIS EXISTS. The scheduled sync is a Vercel cron, and on this project it
 * has never fired: the site ran for a week with the job registered, the secret
 * in place and the endpoint healthy, and produced exactly one daily snapshot —
 * the one from the initial setup. Running the same work by hand took fourteen
 * seconds and imported six missing videos, so the code was never the problem.
 *
 * Nothing in this repository can make Vercel's scheduler fire. What it can do
 * is notice that a day has passed without a sync and do it anyway, the next
 * time an administrator is present. The cron stays exactly as it was — if it
 * starts working, this finds the site already fresh and does nothing.
 *
 * IT IS A NET, NOT A SCHEDULE. If nobody opens the admin for a week, nothing is
 * fetched for a week. It is the difference between "usually up to date" and
 * "never updates on its own", not a replacement for 6pm.
 *
 * Guarded by the ADMIN SESSION rather than `CRON_SECRET`. The cron's secret is
 * held by Vercel and cannot be put in a browser; a signed-in administrator is
 * the right authority for work the admin screens are about to display anyway.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const log = createLogger('syncCatchUp');

/**
 * How stale the last sync must be before this steps in.
 *
 * Twenty hours, not twenty-four. The schedule is daily, so a threshold of a
 * full day would leave a four-hour window in which a missed 6pm run still looks
 * current and nothing catches it. Twenty hours is comfortably longer than the
 * gap between two successful daily runs and short enough to catch the first
 * missed one.
 */
const STALE_AFTER_MS = 20 * 60 * 60 * 1000;

export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  if (!isYouTubeConfigured()) {
    return NextResponse.json({ ran: false, reason: 'not-configured' });
  }

  /*
   * `lastOkAt`, not `at`. `at` is the last ATTEMPT: after one failed night it
   * would read as recent and this net would stand down for a day at exactly the
   * moment it is needed. The fallback to `at` covers records written before
   * `lastOkAt` existed.
   */
  const last = await getLastSyncRecord();
  const lastOk = last?.lastOkAt ?? (last?.ok ? last.at : null);
  const ageMs = lastOk ? Date.now() - new Date(lastOk).getTime() : Infinity;

  if (ageMs < STALE_AFTER_MS) {
    return NextResponse.json({ ran: false, reason: 'fresh', ageMinutes: Math.round(ageMs / 60_000) });
  }

  log.info(
    `Last successful sync was ${lastOk ? `${Math.round(ageMs / 3_600_000)}h ago` : 'never'} — catching up`,
  );

  try {
    const runDeadline = Date.now() + youtubeConfig.runTimeBudgetMs;

    /*
     * The same complete pass the schedule does, so a catch-up is not a lesser
     * sync — deletions and back-catalogue edits are exactly what gets missed
     * when the schedule does not fire.
     */
    const results = await syncAllChannels(true);
    const imported = results.reduce((n, r) => n + r.imported, 0);
    const deleted = results.reduce((n, r) => n + (r.deleted ?? 0), 0);

    // Each is allowed to fail on its own: new videos reaching the website is
    // the job that matters, and a stale view count is not worth failing over.
    const snapshots = await recordDailyChannelStats().catch((error: unknown) => {
      log.error('Daily channel snapshot failed', error);
      return 0;
    });

    const analytics = await refreshAllAnalytics().catch((error: unknown) => {
      log.error('Analytics refresh failed', error);
      return { refreshed: 0, failed: 0 };
    });

    /*
     * Housekeeping, beside the rest of it: notifications older than seven days
     * are swept here rather than by a second cron. One scheduled job is enough,
     * and this runs in the catch-up route too — sweeping only from a job that
     * has not been firing would leave the list growing forever.
     */
    await clearOldNotifications();

    const stats = await refreshVideoStats(undefined, runDeadline).catch((error: unknown) => {
      log.error('Video statistics refresh failed', error);
      return { scanned: 0, updated: 0 };
    });

    return NextResponse.json({
      ran: true,
      ok: results.every((r) => r.ok),
      imported,
      deleted,
      snapshots,
      analytics,
      stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Catch-up sync failed';
    log.error('Catch-up sync failed', message);
    return NextResponse.json({ ran: true, ok: false, message }, { status: 500 });
  }
}
