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

export async function markReadAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get('id') ?? '');
  if (!id) return;

  await prisma.notification.updateMany({
    // `updateMany` rather than `update`: an id that no longer exists — swept by
    // the seven-day clear between the page rendering and the click — is a
    // no-op here, where `update` would throw.
    where: { id, readAt: null },
    data: { readAt: new Date() },
  });

  revalidatePath('/admin', 'layout');
}
