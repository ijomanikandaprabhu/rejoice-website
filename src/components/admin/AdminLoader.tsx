'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

/**
 * The admin's opening screen: the wordmark, and nothing else.
 *
 * `site/SiteLoader.tsx` is the same idea for the public site and is the version
 * that has already been through the mistakes — the ceiling, the phase machine
 * and the `<noscript>` escape hatch below are all copied from it deliberately.
 * Two things are dropped:
 *
 *   1. NO RE-ARM ON NAVIGATION. `SiteLoader` watches `usePathname` and shows
 *      itself again on every route change, which reads well on a marketing site.
 *      This is a tool someone clicks through all day; a second added to every
 *      move between Songs and Enquiries would be a tax, not a flourish. This
 *      appears once, when the admin is opened or refreshed.
 *
 *   2. NO VINYL DISC, and no `data-loading` on the document. Nothing in the
 *      admin reads that attribute — its only consumers are public rules in
 *      globals.css and `site/TextReveal.tsx` — so setting it would tie this to
 *      behaviour that cannot apply here.
 */

/** Shown for at least this long, so it reads as a pause rather than a flicker. */
const HOLD_MS = 1000;

/**
 * And never longer, whatever happens.
 *
 * A loader that can outstay the content it hides is worse than no loader: if
 * `load` never fires — a hung request, a blocked asset — this is what still
 * takes the overlay away.
 */
const MAX_MS = 4000;

/** The dissolve, once the page is ready. */
const FADE_MS = 420;

export function AdminLoader() {
  const [phase, setPhase] = useState<'holding' | 'fading' | 'gone'>('holding');

  useEffect(() => {
    if (phase !== 'holding') return;

    /*
     * No ref-guard around these timers, and that is not an oversight.
     * `SiteLoader` records what happens with one: under StrictMode the first
     * pass armed them, cleanup cleared them, the second pass saw the guard and
     * returned early, and the screen never opened at all.
     */
    let resolved = false;
    const go = () => {
      if (resolved) return;
      resolved = true;
      setPhase('fading');
      window.setTimeout(() => setPhase('gone'), FADE_MS);
    };

    /* `performance.now()` is already the document's age, so the hold counts
       from navigation start without anything needing to be recorded. */
    const elapsed = () => performance.now();

    const floor = window.setTimeout(() => {
      if (document.readyState === 'complete') go();
      else window.addEventListener('load', go, { once: true });
    }, Math.max(0, HOLD_MS - elapsed()));

    const ceiling = window.setTimeout(go, Math.max(0, MAX_MS - elapsed()));

    return () => {
      window.clearTimeout(floor);
      window.clearTimeout(ceiling);
      window.removeEventListener('load', go);
    };
  }, [phase]);

  // A screen you can scroll past is just a panel in the way.
  useEffect(() => {
    if (phase === 'gone') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [phase]);

  /*
   * UNMOUNTED, not merely transparent. A full-screen element left in the tree
   * swallows every click underneath it, which would break the admin end-to-end
   * suite outright — Playwright hit-tests before it clicks — and, far worse,
   * would quietly make the real portal unusable.
   */
  if (phase === 'gone') return null;

  const fading = phase === 'fading';

  return (
    <div
      data-admin-loader=""
      aria-hidden="true"
      style={{ transitionDuration: `${FADE_MS}ms` }}
      className={`fixed inset-0 z-[1000] grid place-items-center bg-panel-bg transition-opacity ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <Image
        src="/brand/logo-wordmark-light.png"
        alt=""
        width={687}
        height={169}
        priority
        className="admin-loader-logo h-8 w-auto sm:h-9"
      />
    </div>
  );
}
