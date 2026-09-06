'use client';

import { Bell, Mail, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { NotificationRow } from '@/features/notifications/queries';
import { cn, formatDateTime } from '@/lib/utils';

/**
 * The bell, and what is behind it.
 *
 * IT USED TO BE A LINK TO ENQUIRIES. A bell means notifications, so it promised
 * something the admin did not have — and it gave enquiries two front doors
 * while the nightly sync, which changes the website without anyone asking, had
 * none at all.
 *
 * Enquiries and notifications stay separate. An enquiry is correspondence with
 * a person: it is kept, worked and replied to, and it still has its own screen
 * in the nav. A notification is a note that something happened; reading it is
 * the whole of its life, and it is swept after seven days.
 *
 * A drop-down for the glance, a page behind it for the history — which is what
 * a bell does everywhere else, and why nobody has to be taught it.
 */

/** Enough to answer "anything new?" without becoming a page in a menu. */
const PREVIEW = 6;

const icons = {
  ENQUIRY: Mail,
  SYNC: RefreshCw,
} as const;

export function NotificationBell({
  unread,
  items,
  onMarkAllRead,
}: {
  unread: number;
  items: NotificationRow[];
  /** Server action, passed down so this file holds no data access. */
  onMarkAllRead: () => Promise<void>;
}) {
  const preview = items.slice(0, PREVIEW);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            className="relative grid size-9 place-items-center rounded-pill text-panel-muted outline-none transition-colors hover:bg-panel-alt hover:text-panel-fg focus-visible:ring-2 focus-visible:ring-panel-accent"
          >
            <Bell className="size-[18px]" />

            {/*
             * shadcn's `Badge`, not a hand-rolled span — it is the component
             * this codebase already uses for a count or a state, and the
             * `default` variant is `bg-primary`, which is the admin's lime.
             *
             * The overrides earn their place: a badge on a bell is a small
             * round dot rather than the rounded rectangle a table row wants.
             * `rounded-pill` and a fixed 18px square make it circular, and
             * `border-0` matters more than it looks — `Badge` carries a
             * transparent 1px border, which measured the dot at 18x20 and read
             * as a slight oval.
             *
             * Capped at 9+. A three-digit badge is wider than the button it
             * sits on, and the exact number stops mattering long before then —
             * the answer is "a lot, go and look".
             */}
            {unread > 0 ? (
              <Badge className="absolute -right-0.5 -top-0.5 size-[18px] min-w-[18px] justify-center rounded-pill border-0 p-0 text-[10px] leading-none">
                {unread > 9 ? '9+' : unread}
              </Badge>
            ) : null}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="admin-theme w-[min(22rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-sm font-semibold text-panel-fg">Notifications</span>

          {unread > 0 ? (
            /*
             * A form, not an onClick: this is a server action, and a form is
             * what makes it work before hydration and without JavaScript.
             */
            <form action={onMarkAllRead}>
              <button
                type="submit"
                className="text-xs text-panel-muted transition-colors hover:text-panel-fg"
              >
                Mark all read
              </button>
            </form>
          ) : null}
        </div>

        <DropdownMenuSeparator className="my-0" />

        {preview.length === 0 ? (
          /* Empty reads as empty, not as broken. */
          <p className="px-3 py-6 text-center text-xs text-panel-muted">
            Nothing yet. New enquiries and video imports appear here.
          </p>
        ) : (
          <ul>
            {preview.map((item) => {
              const Icon = icons[item.kind];

              return (
                <li key={item.id}>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-none px-3 py-2.5">
                    <Link href={item.href ?? '/admin/notifications'} className="flex gap-2.5">
                      <span
                        className={cn(
                          'mt-0.5 grid size-7 shrink-0 place-items-center rounded-pill',
                          item.readAt
                            ? 'bg-panel-alt text-panel-muted'
                            : 'bg-panel-accent/15 text-panel-accent',
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-sm',
                            item.readAt ? 'text-panel-muted' : 'font-medium text-panel-fg',
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-panel-muted">
                          {formatDateTime(item.createdAt)}
                        </span>
                      </span>
                    </Link>
                  </DropdownMenuItem>
                </li>
              );
            })}
          </ul>
        )}

        <DropdownMenuSeparator className="my-0" />

        <DropdownMenuItem asChild className="cursor-pointer justify-center rounded-none py-2.5">
          <Link href="/admin/notifications" className="text-xs text-panel-muted">
            See all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
