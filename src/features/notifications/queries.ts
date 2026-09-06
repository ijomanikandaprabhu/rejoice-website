import 'server-only';

import { prisma } from '@/lib/db/prisma';

/** Reads for the notification bell and its page. */

export type NotificationRow = {
  id: string;
  kind: 'ENQUIRY' | 'SYNC';
  title: string;
  body: string | null;
  href: string | null;
  createdAt: Date;
  readAt: Date | null;
};

/**
 * How many the bell's badge shows.
 *
 * A count, not a list — the badge needs one number, and the top bar renders on
 * every admin page, so this runs constantly.
 */
export async function unreadCount(): Promise<number> {
  return prisma.notification.count({ where: { readAt: null } });
}

/** Newest first. `take` is small for the drop-down, larger for the page. */
export async function listNotifications(take = 50): Promise<NotificationRow[]> {
  return prisma.notification.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      kind: true,
      title: true,
      body: true,
      href: true,
      createdAt: true,
      readAt: true,
    },
  });
}
