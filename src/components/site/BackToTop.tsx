'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * How far down the button appears, as a fraction of the viewport height.
 *
 * Viewport-relative rather than a fixed pixel count because the heroes differ
 * per page — the Music hero is 68vh, the Channels one is taller — and 0.8 of a
 * screen puts the button in reach just as the first section gives way to the
 * content below it, whichever page it is.
 */
const SHOW_AFTER = 0.8;

/**
 * Return to the top of the page.
 *
 * Fixed, bottom right, and hidden until the visitor is past the hero — a
 * control that is only useful once there is something to scroll back from.
 *
 * It replaces the copy that used to sit in the footer's bottom bar, rather than
 * joining it: that one only appeared once you had already reached the bottom,
 * and keeping both would put two identical buttons on screen together the
 * moment the footer came into view.
 */
export function BackToTop() {
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * SHOW_AFTER);

    onScroll(); // A reload partway down the page should not need a scroll first.
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  function toTop() {
    /*
     * The global reduced-motion rule forces `scroll-behavior: auto`, but that
     * governs CSS-driven scrolling — this is a JS call and would animate anyway
     * unless asked not to.
     */
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      /*
       * `pointer-events-none` while hidden, or an invisible button would keep
       * intercepting taps in the corner of every page.
       *
       * `aria-hidden` and `tabIndex={-1}` follow the same state, so it does not
       * sit in the tab order announcing itself while off screen.
       */
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={cn(
        'footer-glass-pill group fixed bottom-6 right-5 z-40 grid size-12 place-items-center rounded-pill',
        'text-site-muted transition-opacity duration-300 hover:text-site-fg sm:right-6',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent',
        shown ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <svg
        className="size-5 transition-transform duration-300 group-hover:-translate-y-1"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    </button>
  );
}

export default BackToTop;
