'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { prisma } from '@/lib/db/prisma';

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
