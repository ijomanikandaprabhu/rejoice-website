import { Bell, Mail, RefreshCw, Trash2 } from 'lucide-react';
import Link from 'next/link';

import { ActionButton, ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { BulkProvider, RowCheckbox, SelectAllCheckbox } from '@/components/admin/BulkSelection';
import { NotificationBulkBar } from '@/components/admin/NotificationBulkBar';
import { Panel } from '@/components/admin/Panels';
import {
  bulkDeleteNotificationsAction,
  deleteNotificationAction,
  markAllReadAction,
} from '@/features/notifications/actions';
import { listNotifications, unreadCount } from '@/features/notifications/queries';
import { NOTIFICATION_TTL_DAYS } from '@/features/notifications/notify';
import { cn, externalLinkProps, formatDateTime } from '@/lib/utils';

/**
 * The full notification history — what the bell's drop-down is a glance at.
 *
 * SEPARATE FROM ENQUIRIES on purpose. An enquiry is correspondence: it is kept,
 * worked and replied to on its own screen. A notification is a note that
 * something happened, and reading it is the whole of its life — which is why
 * this page says outright that they are cleared after a week rather than
 * leaving someone to wonder where last month's went.
 */

export const dynamic = 'force-dynamic';

const icons = {
  ENQUIRY: Mail,
  SYNC: RefreshCw,
} as const;

export default async function NotificationsPage() {
  const [unread, items] = await Promise.all([unreadCount(), listNotifications(100)]);

  return (
    /*
     * The provider wraps the HEADER as well as the list: "Select all" lives up
     * beside "Mark all read", and a selection component outside the provider
     * throws rather than degrading — which is exactly what it did.
     */
    <BulkProvider>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            New enquiries and what the nightly sync changed. Cleared automatically after{' '}
            {NOTIFICATION_TTL_DAYS} days.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {items.length > 0 ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <SelectAllCheckbox ids={items.map((item) => item.id)} />
              Select all
            </label>
          ) : null}

          {unread > 0 ? (
            <ActionForm action={markAllReadAction}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Marking…">
                Mark all read
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      </div>

      <NotificationBulkBar deleteAction={bulkDeleteNotificationsAction} />

      <Panel>
        {items.length === 0 ? (
          <div className="grid place-items-center gap-2 py-16 text-center">
            <Bell aria-hidden className="size-8 text-panel-muted" />
            <p className="text-sm text-panel-muted">
              Nothing yet. New enquiries and video imports appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => {
              const Icon = icons[item.kind];

              const inner = (
                <div className="flex items-start gap-3 py-3">
                  <span
                    className={cn(
                      'mt-0.5 grid size-9 shrink-0 place-items-center rounded-[10px]',
                      item.readAt
                        ? 'bg-panel-alt text-panel-muted'
                        : 'bg-panel-accent/15 text-panel-accent',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm',
                        item.readAt ? 'text-panel-muted' : 'font-medium text-panel-fg',
                      )}
                    >
                      {item.title}
                    </p>
                    {item.body ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-panel-muted">{item.body}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-panel-muted">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>

                  {/* A dot, not the word "unread": the row is already weighted
                      differently, and this only has to confirm it. */}
                  {item.readAt ? null : (
                    <span
                      aria-label="Unread"
                      className="mt-2 size-2 shrink-0 rounded-pill bg-panel-accent"
                    />
                  )}
                </div>
              );

              /*
               * The link wraps the TEXT, not the row. It used to wrap
               * everything, and a checkbox or a button inside an anchor is both
               * invalid HTML and unusable — every click would navigate instead
               * of ticking or deleting. So the three sit side by side and only
               * the middle one is a link.
               */
              return (
                <li key={item.id} className="flex items-center gap-2 px-2">
                  <RowCheckbox id={item.id} />

                  {item.href ? (
                    <Link
                      href={item.href}
                      className="min-w-0 flex-1 rounded-sm2 px-1 transition-colors hover:bg-white/[0.04]"
                      {...externalLinkProps(item.href)}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="min-w-0 flex-1 px-1">{inner}</div>
                  )}

                  {/* No confirmation for one: it is a note, it points at
                      something this does not touch, and it would have cleared
                      itself within the week anyway. */}
                  <ActionButton
                    action={deleteNotificationAction}
                    hiddenFields={{ id: item.id }}
                    variant="ghost"
                    size="sm"
                    pendingLabel="…"
                    label="Delete notification"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </BulkProvider>
  );
}
