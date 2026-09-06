'use client';

import { ExternalLink, LogOut, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NotificationBell } from '@/components/admin/NotificationBell';
import { adminNav } from '@/config/app.config';
import type { NotificationRow } from '@/features/notifications/queries';
import { cn } from '@/lib/utils';

/**
 * Admin top bar: logo mark, nav tabs, icon buttons, avatar.
 *
 * Nav order comes from `config/app.config.ts` so the sitemap, the public header
 * and this bar all derive from one source.
 */
export function AdminTopBar({
  email,
  logout,
  notifications,
  markAllRead,
}: {
  email: string;
  logout: () => Promise<void>;
  /*
   * Read in the LAYOUT and passed down. This bar is a client component and
   * cannot query the database, and the badge has to be right on every admin
   * screen — the layout already looks the administrator up for the email
   * beside it, so the count rides along rather than adding a second trip.
   */
  notifications: { unread: number; items: NotificationRow[] };
  markAllRead: () => Promise<void>;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-panel-bg/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[86rem] items-center gap-4 px-4 sm:px-6">
        <Link href="/admin" className="flex shrink-0 items-center">
          <Image
            src="/brand/logo-wordmark-light.png"
            alt="Rejoice"
            width={687}
            height={169}
            priority
            className="h-6 w-auto"
          />
        </Link>

        <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Admin">
          {adminNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn(
                'rounded-pill px-3.5 py-2 text-sm transition-colors duration-200',
                isActive(item.href)
                  ? 'bg-panel-alt text-panel-fg'
                  : 'text-panel-muted hover:text-panel-fg',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/*
         * ONE provider for the whole cluster, not one per icon: it also shares
         * the open/close timing, so moving along the row does not re-pay the
         * opening delay at every icon.
         *
         * The `aria-label`s below stay. Radix ties tooltip content to its
         * trigger with `aria-describedby` — a DESCRIPTION, not the accessible
         * name — so dropping the labels because "the tooltip says it now" would
         * leave screen readers with four unnamed buttons.
         */}
        <TooltipProvider delayDuration={200}>
          <div className="ml-auto flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/admin/youtube-content"
                  aria-label="Search content"
                  className="grid size-9 place-items-center rounded-pill text-panel-muted transition-colors hover:bg-panel-alt hover:text-panel-fg"
                >
                  <Search className="size-[18px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Search content</TooltipContent>
            </Tooltip>

            {/*
             * The bell is NOTIFICATIONS now, not a second door to enquiries.
             * Enquiries keep their place in the nav above; see
             * `NotificationBell` for why the two are separate things.
             */}
            <NotificationBell
              unread={notifications.unread}
              items={notifications.items}
              onMarkAllRead={markAllRead}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="View website"
                  className="grid size-9 place-items-center rounded-pill text-panel-muted transition-colors hover:bg-panel-alt hover:text-panel-fg"
                >
                  <ExternalLink className="size-[18px]" />
                </a>
              </TooltipTrigger>
              {/* Says where it goes AND that it leaves the admin, which the icon
                  alone does not. */}
              <TooltipContent>View website (opens in a new tab)</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Account menu"
                      className="grid size-9 place-items-center overflow-hidden rounded-pill bg-panel-alt outline-none transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-panel-accent"
                    >
                      {/*
                       * The brand mark rather than the account's initials. There
                       * is exactly one administrator, so initials identified
                       * nobody — the address is still in the menu below, which
                       * is where it is actually useful.
                       *
                       * `alt=""` deliberately: the button already carries
                       * `aria-label="Account menu"`, and naming the image too
                       * would have a screen reader announce the control twice.
                       * The artwork is white on transparent and this button is
                       * `bg-panel-alt`, so it needs no ground of its own.
                       */}
                      <Image
                        src="/brand/logo-icon.svg"
                        alt=""
                        width={36}
                        height={36}
                        className="size-5"
                      />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Account</TooltipContent>
              </Tooltip>
              <DropdownMenuContent
                align="end"
                className="admin-theme w-56 rounded-sm2 border border-white/[0.08] bg-panel-alt p-2 text-panel-fg shadow-panel"
              >
                <DropdownMenuLabel className="truncate px-3 py-2 text-xs font-normal text-panel-muted">
                  {email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/[0.08]" />
                <form action={logout}>
                  <DropdownMenuItem
                    asChild
                    className="cursor-pointer rounded-input px-3 py-2 text-sm text-panel-fg outline-none focus:bg-white/[0.1] focus:text-panel-fg focus-visible:outline-none"
                  >
                    <button type="submit" className="flex w-full items-center gap-2">
                      <LogOut className="size-4" />
                      Log out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TooltipProvider>
      </div>

      {/* Nav collapses to a scrolling row rather than disappearing on tablet. */}
      <nav
        className="flex gap-1 overflow-x-auto border-t border-white/[0.06] px-4 py-2 lg:hidden"
        aria-label="Admin sections"
      >
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'shrink-0 rounded-pill px-3.5 py-1.5 text-sm transition-colors',
              isActive(item.href)
                ? 'bg-panel-alt text-panel-fg'
                : 'text-panel-muted hover:text-panel-fg',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
