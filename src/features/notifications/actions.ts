'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { isMissingRow } from '@/lib/db/errors';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';

const log = createLogger('notifications');

/** Declared here rather than imported, as every other actions file does. */
export type ActionState = { ok: boolean; message?: string; errors?: Record<string, string> };

/**
 * Marking notifications read.
 *
 * `requireAdmin()` first, like every other action in the codebase: middleware
 * already blocks unauthenticated navigation, but a server action is its own
 * endpoint and must check for itself (section 37).
 */

/*
 * Takes the standard `(prev, formData)` pair, unused, because it is
 * dispatched through `useActionState` like every other action — the pair is
 * what that hook passes, not something this action needs.
 */
export async function markAllReadAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const { count } = await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  /*
   * `layout` scope: the badge lives in the top bar, which is part of the admin
   * LAYOUT rather than any page. Revalidating the notifications page alone
   * would leave the bell still showing a count on every other screen.
   */
  revalidatePath('/admin', 'layout');

  /*
   * Says the number, because "Marked as read" leaves the one useful fact out.
   * The bell may have been showing 39; clearing it silently is the same as not
   * saying whether anything happened at all.
   */
  return {
    ok: true,
    message: `${count} ${plural(count, 'notification', 'notifications')} marked as read.`,
  };
}

/** Because "1 notifications" undermines every other word on the screen. */
function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/**
 * Removing notifications.
 *
 * They already expire on their own after a week (`clearOldNotifications`), so
 * this is not about storage — it is about a list of forty notes that have all
 * been read and are in the way of the two that have not.
 *
 * Nothing a notification points AT is touched. Deleting the note about an
 * enquiry leaves the enquiry exactly where it was; the note is a record that
 * something happened, not the thing itself.
 */

const BULK_ID_LIMIT = 100;

export async function deleteNotificationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return { ok: false, message: 'That notification could not be deleted.' };

  try {
    await prisma.notification.delete({ where: { id } });
  } catch (error) {
    /*
     * A row that has already gone is a success, not a failure. The seven-day
     * sweep runs on the sync schedule and can remove a notification while this
     * page sits open, and the administrator does not need to hear about a race
     * whose outcome is the one they asked for.
     */
    if (!isMissingRow(error)) {
      log.error(`Failed to delete notification ${id}`, error);
      return { ok: false, message: 'Could not delete that notification. Please try again.' };
    }
  }

  // `layout` scope, for the same reason as marking read: deleting an UNREAD
  // notification changes the badge, and the badge is in the top bar.
  revalidatePath('/admin', 'layout');

  return { ok: true, message: 'Notification deleted.' };
}

export async function bulkDeleteNotificationsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const ids = formData.getAll('ids').map(String).filter(Boolean);
  if (ids.length === 0 || ids.length > BULK_ID_LIMIT) {
    return { ok: false, message: 'Nothing was deleted — the selection was not valid.' };
  }

  const { count } = await prisma.notification.deleteMany({ where: { id: { in: ids } } });
  log.info(`Deleted ${count} notifications`);

  revalidatePath('/admin', 'layout');

  return {
    ok: true,
    message: `${count} ${plural(count, 'notification', 'notifications')} deleted.`,
  };
}
