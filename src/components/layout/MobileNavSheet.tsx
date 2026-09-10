'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import type { NavItem } from '@/config/app.config';
import { EASE_HOUSE, sheetEnter, sheetExit, sheetLinkDelay, sheetLinkStagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

/**
 * The menu on a phone: the whole screen, in the header's own glass.
 *
 * ## What it replaces
 *
 * A bare `{open ? <nav/> : null}` under the header. Measured on the live site
 * before this: `animationName: none` — it snapped in and out; an opaque
 * `rgb(30,27,29)` slab sitting directly beneath a header that is translucent
 * with a 24px blur, so two different materials were stacked; `document.body`
 * overflow still `visible`, so the page scrolled away behind the open menu; and
 * six links at 15px with no press feedback. It was the only part of the site
 * with no motion at all.
 *
 * ## Why Radix rather than a `useState` and a div
 *
 * Everything hard about a full-screen menu is the part nobody sees: focus has to
 * be trapped inside it, Escape has to close it, the page behind has to go inert
 * for a screen reader, and the scroll has to lock without the layout jumping as
 * the scrollbar disappears. `@radix-ui/react-dialog` was already a dependency
 * and does all four. `globals.css` already neutralises the margin Radix adds
 * during a scroll lock, so that interaction was solved before this existed.
 *
 * The primitives directly, not `components/ui/dialog.tsx`: that wrapper is a
 * centred `max-w-lg` card with its own close button in the corner, which is the
 * opposite of this.
 */
export function MobileNavSheet({ items, siteName }: { items: NavItem[]; siteName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const reduce = useReducedMotion() ?? false;

  /*
   * Close on navigation.
   *
   * The links call `setOpen(false)` themselves, but that covers only the ones
   * inside here. A route change from anywhere else — the browser's back button
   * out of a page reached from this menu — would otherwise leave the sheet open
   * over a page the visitor did not choose from it.
   *
   * Adjusted DURING render rather than from an effect, which is the shape React
   * documents for "reset state when a prop changes" and the one the search
   * fields and the carousel picker in this codebase already use. An effect would
   * close it one paint later — the new page visible behind a sheet still on
   * screen — and `react-hooks/set-state-in-effect` is an error here for exactly
   * that reason.
   */
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger
        aria-label="Open menu"
        className="-mr-2 grid size-11 place-items-center rounded-pill text-site-fg transition-colors hover:text-site-accent md:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5 stroke-current"
          fill="none"
          strokeWidth="1.75"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 8h16M4 16h16" />
        </svg>
      </DialogPrimitive.Trigger>

      {/*
        `AnimatePresence` with `forceMount` on the Radix parts: Radix would
        otherwise unmount the content the instant it closes and there would be
        nothing left to animate out. This is the standard pairing, and it is why
        the close is a real animation rather than a disappearance.
      */}
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/40 md:hidden"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={reduce ? { duration: 0 } : sheetExit}
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                /*
                 * The same glass as the header, one step deeper. Opening the
                 * menu should read as the bar expanding to fill the screen, not
                 * as a different panel arriving on top of it.
                 */
                className="fixed inset-0 z-50 flex flex-col bg-site-bg/95 backdrop-blur-2xl md:hidden"
                initial={reduce ? false : { opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: -8 }}
                transition={reduce ? { duration: 0 } : sheetEnter}
              >
                <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>

                {/*
                  A row matching the header's own height and padding, so the
                  logo does not move and the close button lands exactly where
                  the thumb just tapped the opener.
                */}
                <div className="container-page flex h-[4.5rem] shrink-0 items-center justify-between">
                  <Link href="/" onClick={() => setOpen(false)} aria-label={siteName}>
                    {/* The file's real dimensions, matching SiteHeader. With
                        `h-7 w-auto` the rendered width comes from this ratio,
                        so a made-up pair here would stretch the wordmark. */}
                    <Image
                      src="/brand/logo-wordmark-light.png"
                      alt={siteName}
                      width={687}
                      height={169}
                      priority
                      className="h-7 w-auto"
                    />
                  </Link>

                  <DialogPrimitive.Close
                    aria-label="Close menu"
                    className="-mr-2 grid size-11 place-items-center rounded-pill text-site-fg transition-colors hover:text-site-accent"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="size-5 stroke-current"
                      fill="none"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </DialogPrimitive.Close>
                </div>

                {/*
                  The links are the content, so they get the room. Centred
                  vertically in what is left, at heading size rather than the
                  15px they were — six items at body size in a full screen is
                  what made this look unfinished.
                */}
                <nav
                  aria-label="Mobile"
                  className="container-page flex flex-1 flex-col justify-center gap-1 pb-16"
                >
                  {items.map((item, index) => (
                    <motion.div
                      key={item.href}
                      initial={reduce ? false : { opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduce
                          ? { duration: 0 }
                          : {
                              duration: 0.32,
                              ease: EASE_HOUSE,
                              delay: sheetLinkDelay + index * sheetLinkStagger,
                            }
                      }
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={isActive(item.href) ? 'page' : undefined}
                        className={cn(
                          /* `active:` rather than `hover:` first — this is a
                             touch surface, and a press that does nothing until
                             the page changes feels broken on a slow network. */
                          'flex min-h-[3.25rem] items-center rounded-sm2 px-4 text-[1.5rem] font-light tracking-[-0.01em] transition-colors duration-200 active:bg-white/[0.06]',
                          isActive(item.href)
                            ? 'text-site-accent'
                            : 'text-site-fg/80 hover:text-site-fg',
                        )}
                      >
                        {item.label}
                      </Link>
                    </motion.div>
                  ))}
                </nav>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
