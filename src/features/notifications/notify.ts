import 'server-only';

import type { NotificationKind } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';

/**
 * Raising a notification, and clearing old ones.
 *
 * NOTHING HERE THROWS. Every caller is doing something that matters more than
 * the note about it: a visitor's enquiry is already stored, a sync has already
 * imported videos. The enquiry path established this rule for its email — the
 * enquiry is saved before the mail is attempted, so a mail problem cannot turn
 * a successful submission into an error for the visitor — and a notification
 * has no better claim than that.
 */

const log = createLogger('notifications');

/** How long a notification is kept. Rejoice asked for seven days. */
export const NOTIFICATION_TTL_DAYS = 7;

export async function raise(input: {
  kind: NotificationKind;
  title: string;
  body?: string;
  /** Where clicking it goes. Absent means it is a note with nowhere to be. */
  href?: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
      },
    });
  } catch (error) {
    log.error('Could not raise a notification', error);
  }
}

/**
 * Delete notifications older than the retention window.
 *
 * Called from the daily sync and from the catch-up route beside the other
 * upkeep, rather than from a cron of its own — one scheduled job is enough, and
 * this is housekeeping that belongs beside the rest of it.
 *
 * IN THE CATCH-UP TOO, not only the cron, because the cron on this project has
 * not been firing. Sweeping only from a job that may never run would leave the
 * list growing forever.
 */
export async function clearOldNotifications(): Promise<number> {
  try {
    const cutoff = new Date(Date.now() - NOTIFICATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await prisma.notification.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    if (count > 0) log.info(`Cleared ${count} notification(s) older than ${NOTIFICATION_TTL_DAYS} days`);
    return count;
  } catch (error) {
    log.error('Could not clear old notifications', error);
    return 0;
  }
}
