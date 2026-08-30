'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { VinylDisc } from './VinylDisc';

/**
 * Shown for at least this long, on every page and every navigation.
 *
 * On the first load this is measured from NAVIGATION START, not from this
 * component mounting — the visitor started looking at the screen when they
 * asked for the page, not when React finished hydrating. Measured from mount, a
 * slow hydration would be charged twice: once waiting for it, then the full
 * hold on top. On a link click there is no new document, so it is measured from
 * the moment the route changed.
 */
const HOLD_MS = 1000;

/**
 * And never longer than this. `load` waits on every image and the hero film; on
 * a slow connection that is far too long to hold a blank screen, and a loader
 * that can outstay the content it hides is worse than none.
 */
const MAX_MS = 4000;

/** The dissolve, once the page is ready. */
const FADE_MS = 420;

/**
 * The loading screen.
 *
 * Every public page shows the same record, held for `HOLD_MS` and then dissolved —
 * on the first load and again on every link click.
 * The page is behind it, ready — this covers the load, it does not perform.
 *
 * ## Why it cannot hide the site
 *
 * This is the one thing a loading screen must never get wrong, and it has gone
 * wrong here twice, so the guards are worth naming:
 *
 *   1. A `<noscript>` rule (see `(public)/layout.tsx`) removes it outright when
 *      JavaScript is off — the served HTML holds the overlay, so without that
 *      rule nothing would ever dismiss it.
 *   2. `MAX_MS`. Even if `load` never fires — a hung image, a blocked request —
 *      the overlay leaves on its own.
 *
 * ## A development-only trap
 *
 * An earlier version guarded this effect with a ref so it could only ever arm
 * once. **React StrictMode runs effects twice in development** — mount, cleanup,
 * mount — so the first pass armed the timers, the cleanup cleared them, and the
 * second pass returned early at the guard. Nothing re-armed, and the site never
 * opened. It passed on a production build, which has no double-invoke.
 *
 * There is no such guard now. The effect is safe to run repeatedly: it arms
 * timers, the cleanup clears them, and `resolved` stops a second dissolve.
 */
export function SiteLoader() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'holding' | 'fading' | 'gone'>('holding');

  /*
   * When the current hold began. Zero means the first page load, because
   * `performance.now()` is already the document's age — so the hold is counted
   * from navigation start without needing to record anything.
   */
  const startedAt = useRef(0);

  /*
   * Show the loader again on every route change.
   *
   * A LAYOUT effect, not a passive one. `usePathname` updates in the same
   * commit that renders the new page, and a layout effect runs before the
   * browser paints that commit — so the overlay covers the new page in the same
   * frame it arrives. As a passive effect this shows one frame of the new page
   * before the loader lands on top of it, which reads as a flicker.
   *
   * The comparison is against the last pathname rather than a "first render"
   * boolean: StrictMode runs this twice on mount, and a boolean would treat the
   * second run as a navigation and re-hold on the initial load.
   *
   * Only the PATH is watched. `ChannelPageBody` pushes query-string changes for
   * pagination, and a loading screen between pages of the same list would be
   * noise.
   */
  const lastPath = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (lastPath.current === null) {
      lastPath.current = pathname;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    startedAt.current = performance.now();
    setPhase('holding');
  }, [pathname]);

  useEffect(() => {
    if (phase !== 'holding') return;

    let resolved = false;
    const go = () => {
      if (resolved) return;
      resolved = true;
      setPhase('fading');
      window.setTimeout(() => setPhase('gone'), FADE_MS);
    };

    const elapsed = () => performance.now() - startedAt.current;

    const floor = window.setTimeout(
      () => {
        // Already true for a link click — there is no new document to wait for.
        if (document.readyState === 'complete') go();
        else window.addEventListener('load', go, { once: true });
      },
      Math.max(0, HOLD_MS - elapsed()),
    );
    const ceiling = window.setTimeout(go, Math.max(0, MAX_MS - elapsed()));

    return () => {
      window.clearTimeout(floor);
      window.clearTimeout(ceiling);
      window.removeEventListener('load', go);
    };
  }, [phase]);

  /*
   * A reload starts at the top of the page.
   *
   * Browsers restore the previous scroll position on reload, so refreshing
   * halfway down a page left you halfway down it. Opting out is scoped to
   * reloads specifically — `history.scrollRestoration = 'manual'` would
   * otherwise also stop the back button from returning you to where you were,
   * which is restoration working correctly.
   *
   * The flag is put back once the loader clears, so only this one navigation is
   * affected. A URL with a hash is left alone: that visitor asked for a
   * particular place on the page.
   *
   * Both halves are needed. `manual` alone can be too late — restoration may
   * already have happened by the time this hydrates — and `scrollTo` alone can
   * be undone by a restoration that lands after it.
   */
  const priorRestoration = useRef<ScrollRestoration | null>(null);
  useLayoutEffect(() => {
    const [nav] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (nav?.type !== 'reload' || window.location.hash) return;
    priorRestoration.current = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    /*
     * `behavior: 'instant'` overrides the `scroll-behavior: smooth` this site
     * sets globally. Without it the correction ANIMATES from wherever the
     * browser restored to, which was measured taking about 1.2s and finishing
     * underneath the loader — a scroll nobody asked for, racing the overlay.
     */
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (phase !== 'gone' || priorRestoration.current === null) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    history.scrollRestoration = priorRestoration.current;
    priorRestoration.current = null;
  }, [phase]);

  /*
   * One flag on the document while the overlay is up.
   *
   * `site/TextReveal.tsx` waits for it, so the first screenful reveals in front
   * of the visitor rather than behind a panel. It also pauses the marquee rails
   * (see `globals.css`), whose tracks measure 27,200px and 19,600px and were
   * animating underneath something nobody could see through.
   */
  useEffect(() => {
    if (phase === 'gone') {
      delete document.documentElement.dataset.loading;
      return;
    }
    document.documentElement.dataset.loading = 'true';
    return () => {
      delete document.documentElement.dataset.loading;
    };
  }, [phase]);

  /* A loader you can scroll past is just a panel in the way. */
  useEffect(() => {
    if (phase === 'gone') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  if (phase === 'gone') return null;

  const fading = phase === 'fading';

  return (
    <div
      data-site-loader=""
      aria-hidden="true"
      /*
       * Promoted for the dissolve only. A full-viewport opacity change is
       * otherwise a repaint of everything beneath it on every frame.
       */
      style={{ willChange: fading ? 'opacity' : undefined, transitionDuration: `${FADE_MS}ms` }}
      /*
       * Above EVERYTHING. At `z-[100]` the coverflow carousel's prev/next
       * buttons (`ui/coverflow-carousel.tsx`, `z-[200]`) punched through the
       * overlay on `/creations` — neither element sits in a stacking context of
       * its own, so 200 simply beat 100. A loading screen with page controls
       * floating on top of it is worse than no loading screen.
       */
      className={`fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-8 bg-site-bg transition-opacity ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/*
       * The same record on every public page.
       *
       * This used to be the disc on the home page and a generic spinning ring
       * everywhere else, which meant the loading screen looked like a different
       * site depending on where you entered — and most arrivals from search or
       * a shared link do not land on the home page. The record is the brand, so
       * it is what every entrance shows.
       */}
      <div className="size-[132px] sm:size-[164px]">
        <VinylDisc playing />
      </div>

      {/*
       * The wordmark sits BELOW.
       *
       * Above, the mark reads as a heading and the disc as its illustration.
       * Below, the disc is the subject and the mark signs it — which is the
       * right order, because the disc is what the page is about.
       */}
      <Image
        src="/brand/logo-wordmark-light.png"
        alt=""
        width={687}
        height={169}
        priority
        className="h-5 w-auto opacity-70 sm:h-6"
      />
    </div>
  );
}

export default SiteLoader;
