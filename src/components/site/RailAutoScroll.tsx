'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import * as React from 'react';

/**
 * The viewport for a marquee rail, and the thing that moves it on a phone.
 *
 * ## Why this exists
 *
 * A rail is a doubled track translated by `-50%` inside `overflow: hidden`. That
 * is a transform, not a scroll, so a finger on a phone does nothing at all — and
 * the arrows that rescue a desktop visitor are `hidden sm:grid`. Every card past
 * the first two was unreachable except by waiting.
 *
 * So below `sm` the viewport becomes a REAL scroller (see `.rail-viewport` in
 * globals.css) and this component drives `scrollLeft` frame by frame. Auto-motion
 * and swipe then share one mechanism instead of fighting: the loop moves the same
 * property the finger does.
 *
 * `sm:` and up is untouched. The CSS marquee still runs there, `RailArrows` still
 * scrubs its `currentTime`, and this effect deliberately does not start — which is
 * why the breakpoint query below is the exact complement of Tailwind's `sm`.
 *
 * It renders the viewport element itself and takes the track as `children`, so
 * `ChannelRails` and `ShortsRail` stay server components.
 */

/**
 * Quiet time before auto-motion returns after the visitor last touched the rail.
 *
 * Long enough that it does not lurch back while a finger is still hovering mid
 * swipe, short enough that a rail left alone starts drifting again on its own.
 */
const IDLE_MS = 1200;

export function RailAutoScroll({
  seconds,
  children,
}: {
  /**
   * Seconds for ONE copy of the doubled track to pass — the same number the
   * track's `animationDuration` gets. Both must come from a single `const` at
   * the call site: if they drift apart the rail changes pace at the breakpoint.
   */
  seconds: number;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  /* Off-screen rails do not move. Same call as `ChannelSpotlight`, and the same
     hook, so there is one answer to "is this section worth animating". */
  const inView = useInView(ref, { margin: '200px 0px' });
  const reduceMotion = useReducedMotion();

  /*
   * Starts false so the server render and the first client render agree. The
   * markup is identical either way — only this effect differs — so there is
   * nothing to mismatch.
   */
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    /* `639.98px`, not `639px`: this has to be the exact complement of Tailwind's
       `min-width: 640px`, or a fractional-DPI viewport at 639.5px matches both
       rules or neither. */
    const query = window.matchMedia('(max-width: 639.98px)');
    const sync = () => setIsMobile(query.matches);

    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  React.useEffect(() => {
    const el = ref.current;
    // Desktop keeps the CSS marquee; reduced motion keeps a plain scrollable row.
    if (!el || !isMobile || reduceMotion || !inView) return;

    let raf = 0;
    let last = performance.now();
    /* Kept as a float. At the tuned pace (~30px/s, about half a pixel a frame) an
       integer accumulator would round most of the motion away and the rail would
       crawl or stall outright. */
    let pos = el.scrollLeft;
    /*
     * The value the browser actually took, last time we wrote one.
     *
     * Everything that asks "did the visitor move this?" compares against THIS,
     * never against `pos`. A browser snaps `scrollLeft` to its own pixel grid, so
     * the value that comes back is never quite the float that went in — and
     * measuring that difference against `pos` reads the rounding as a swipe,
     * which resets the accumulator every frame and leaves the rail crawling at a
     * pixel a second instead of thirty.
     */
    let lastWritten = el.scrollLeft;
    /* One copy of the doubled track — the distance `translateX(-50%)` covers, and
       therefore the distance that wraps invisibly. */
    let half = el.scrollWidth / 2;
    let resumeAt = 0;
    let pointerDown = false;
    let needsRephase = false;

    /* Images land after mount and widen the track, so this is measured again
       rather than read once. */
    const measure = () => {
      half = el.scrollWidth / 2;
    };
    const observer = new ResizeObserver(measure);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    /*
     * A DEADLINE, NOT A LATCH.
     *
     * `ChannelSpotlight` shipped the other version of this and it was a bug worth
     * remembering: a `pointerdown` handler that set `paused` and never cleared it
     * killed that carousel on nearly every mobile visit, because the touch that
     * scrolls the page fires pointerdown on whatever is under the finger. Here
     * every interaction only pushes a deadline forward, so the rail always comes
     * back on its own.
     */
    const nudge = () => {
      resumeAt = performance.now() + IDLE_MS;
      needsRephase = true;
    };

    const onPointerDown = () => {
      pointerDown = true;
      nudge();
    };
    const onRelease = () => {
      pointerDown = false;
      nudge();
    };
    /*
     * Their scrolling, or ours? Anything that has moved the scroller away from
     * the exact value we last wrote is the visitor — including the whole
     * momentum tail of a fling, which is precisely the part that must not be
     * interrupted.
     *
     * This debounce is also why `scrollend` is not used: it would only shorten
     * the wait, it is unsupported on older Safari, and it is not typed in this
     * TypeScript's DOM lib.
     */
    const movedByVisitor = () => Math.abs(el.scrollLeft - lastWritten) > 2;

    const onScroll = () => {
      if (movedByVisitor()) nudge();
    };

    el.addEventListener('pointerdown', onPointerDown, { passive: true });
    el.addEventListener('touchstart', nudge, { passive: true });
    el.addEventListener('wheel', nudge, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    /* On `window`, so a finger released past the edge of the rail still clears
       the flag rather than freezing it down forever. */
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('touchend', onRelease, { passive: true });
    window.addEventListener('touchcancel', onRelease, { passive: true });

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);

      /* Clamped so a tab returning from the background does not apply the whole
         time it spent hidden in one jump. */
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;

      /*
       * WHILE THE VISITOR OWNS THE SCROLLER, TOUCH NOTHING.
       *
       * Assigning `scrollLeft` during an iOS fling cancels or visibly jerks the
       * momentum. The duplicated content makes a `half` jump identical in pixels
       * but it does not preserve the scroller's internal velocity, so there is no
       * clever version of this — the loop simply keeps its own position in step
       * and waits.
       */
      if (pointerDown || now < resumeAt) {
        pos = el.scrollLeft;
        lastWritten = el.scrollLeft;
        return;
      }

      /* Mirrors `html[data-loading] .animate-marquee` in globals.css, which no
         longer matches down here because there is no animation to pause. Skipped
         rather than cancelled, so it carries on from where it stopped. */
      if (document.documentElement.hasAttribute('data-loading')) return;

      /*
       * Not enough track to loop through. With one or two videos the doubled
       * track is barely wider than the screen, so the wrap below would fire
       * almost every frame and read as a twitch. A row this short does not need
       * to move; it stays a plain swipeable one.
       */
      if (half < el.clientWidth + 24) return;

      /*
       * Re-phase, once, now that everything has settled.
       *
       * A native scroller clamps at 0, so a visitor who swipes back to the start
       * hits a wall — and wrapping under a fling to avoid that is exactly the
       * momentum-killing write ruled out above. Instead, on the way back to
       * auto-motion, move to the position one full copy away if that sits further
       * from both ends. The content repeats with period `half`, so this is
       * invisible, and it hands back a whole copy of room in both directions.
       */
      if (needsRephase) {
        const max = el.scrollWidth - el.clientWidth;
        const base = ((el.scrollLeft % half) + half) % half;
        const next =
          [base, base + half]
            .filter((candidate) => candidate >= 0 && candidate <= max)
            .sort((a, b) => Math.min(b, max - b) - Math.min(a, max - a))[0] ?? base;

        el.scrollLeft = next;
        /* Both set before the scroll event this assignment queues, so `onScroll`
           sees its own handiwork and does not mistake it for the visitor. */
        pos = next;
        lastWritten = el.scrollLeft;
        needsRephase = false;
      }

      /* They moved it since our last write — carry on from wherever they left it
         rather than yanking the row back. */
      if (movedByVisitor()) pos = el.scrollLeft;

      pos += (half / seconds) * delta;
      if (pos >= half) pos -= half;
      el.scrollLeft = pos;
      lastWritten = el.scrollLeft;
    };

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('touchstart', nudge);
      el.removeEventListener('wheel', nudge);
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
      window.removeEventListener('touchend', onRelease);
      window.removeEventListener('touchcancel', onRelease);
    };
  }, [isMobile, reduceMotion, inView, seconds]);

  return (
    <div ref={ref} className="rail-viewport">
      {children}
    </div>
  );
}
