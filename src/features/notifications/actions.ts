'use server';

import { revalidatePath } from 'next/cache';

import { requireAdmin } from '@/lib/auth/guard';
import { prisma } from '@/lib/db/prisma';

/**
 * Marking notifications read.
 *
 * `requireAdmin()` first, like every other action in the codebase: middleware
 * already blocks unauthenticated navigation, but a server action is its own
 * endpoint and must check for itself (section 37).
 */

export async function markAllReadAction(): Promise<void> {
  await requireAdmin();

  await prisma.notification.updateMany({
    where: { readAt: null },
    data: { readAt: new Date() },
  });

  /*
   * `layout` scope: the badge lives in the top bar, which is part of the admin
   * LAYOUT rather than any page. Revalidating the notifications page alone
   * would leave the bell still showing a count on every other screen.
   */
  revalidatePath('/admin', 'layout');
}
