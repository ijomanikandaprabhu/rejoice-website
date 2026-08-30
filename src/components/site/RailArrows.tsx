'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** How long a single step takes to glide, in ms. */
const STEP_MS = 450;

/** easeOutCubic — the same curve `scrolling-animation.tsx` uses. */
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Step buttons for a marquee rail.
 *
 * ## Why this scrubs an animation instead of scrolling
 *
 * The rails move by a CSS `transform`, not by scrolling, so there is no
 * `scrollLeft` for a button to nudge. Replacing the marquee with a scroll
 * container to get one was tried and reverted — the auto-motion is wanted.
 *
 * The way out is that the marquee is `linear` and `infinite`, which makes it
 * PERIODIC and so scrubbable: the track's animation is reachable through
 * `getAnimations()`, and setting `currentTime` puts the row exactly where it
 * would have been at that instant. Advancing by `duration / cardsPerCopy` is
 * one card precisely — 196px on the Shorts rail, 272px on the channel rails.
 *
 * So nothing about the rail itself changes. It keeps looping without a seam and
 * keeps pausing on hover; these buttons only move its clock.
 *
 * ## Why the step is tweened rather than assigned
 *
 * Setting `currentTime` once teleports the row a card's width. The same value
 * eased over `STEP_MS` frames reads as the row being pushed along, which is the
 * point of a step control.
 *
 * Because the arrows only appear on hover, and hover pauses the marquee, the
 * animation is always paused by the time one is clicked — the tween seeks a
 * stopped animation, and the drift resumes from wherever it was left.
 *
 * ## Reduced motion
 *
 * The global rule in globals.css applies `animation: none` under
 * `prefers-reduced-motion`, which removes the marquee — `getAnimations()` comes
 * back empty and there is nothing to scrub. The same media query makes
 * `.rail-viewport` genuinely scrollable, so the click falls back to scrolling it
 * by one card. Without that branch these buttons would be dead for exactly the
 * people least able to use an auto-scrolling row.
 *
 * ## Why it finds the track through the DOM
 *
 * The rails are server components and cannot hold a ref. Rather than turn both
 * into client components for the sake of one, the handler walks up from the
 * button to the `[data-rail]` wrapper and back down to `[data-rail-track]`.
 *
 * The buttons also sit OUTSIDE `.rail-viewport`: that element carries the edge
 * mask, which fades its first and last few rem to transparent and would leave an
 * arrow parked in the faded strip almost invisible.
 *
 * Neither arrow is ever disabled — a loop has no start or end.
 */
export function RailArrows({
  cardsPerCopy,
  label,
}: {
  /** Cards in ONE copy of the doubled track; one card is `duration / this`. */
  cardsPerCopy: number;
  /** Names what the buttons move, e.g. "Rejoice Gospel Music videos". */
  label: string;
}) {
  const rafRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function step(event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) {
    const rail = event.currentTarget.closest('[data-rail]');
    const track = rail?.querySelector<HTMLElement>('[data-rail-track]');
    if (!rail || !track || !cardsPerCopy) return;

    /*
     * Read at click time rather than cached at mount: on a slow first paint the
     * animation may not exist yet when this mounts, and a cached empty result
     * would leave the buttons permanently dead.
     */
    const animation = track.getAnimations()[0];

    // No animation means reduced motion stripped it. The viewport scrolls there.
    if (!animation) {
      const viewport = rail.querySelector<HTMLElement>('.rail-viewport');
      const pitch = track.getBoundingClientRect().width / 2 / cardsPerCopy;
      viewport?.scrollBy({ left: direction * pitch });
      return;
    }

    const duration = Number(animation.effect?.getTiming().duration ?? 0);
    if (!duration) return;

    // A second click must not fight the first over `currentTime` every frame.
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);

    const from = Number(animation.currentTime ?? 0);
    const delta = direction * (duration / cardsPerCopy);

    const settle = (value: number) => {
      /*
       * A left step near zero would drive `currentTime` negative, which parks an
       * infinite animation in its before-phase. One full period back is the same
       * frame on a loop, so the wrap is invisible and keeps it in phase.
       */
      animation.currentTime = value < 0 ? value + duration : value;
    };

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settle(from + delta);
      return;
    }

    const start = performance.now();
    const frame = (now: number) => {
      const t = Math.min((now - start) / STEP_MS, 1);
      settle(from + delta * ease(t));
      rafRef.current = t < 1 ? requestAnimationFrame(frame) : null;
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  return (
    <>
      <Arrow side="left" label={`Previous ${label}`} onClick={(e) => step(e, -1)} />
      <Arrow side="right" label={`Next ${label}`} onClick={(e) => step(e, 1)} />
    </>
  );
}

function Arrow({
  side,
  label,
  onClick,
}: {
  side: 'left' | 'right';
  label: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        // Desktop only: these are pointer affordances, and the rails are
        // unchanged on a phone.
        'absolute top-1/2 z-20 hidden size-10 -translate-y-1/2 place-items-center rounded-pill sm:grid',
        'border border-white/10 bg-site-bg/70 text-site-fg backdrop-blur',
        'hover:border-white/30 hover:bg-site-bg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent',
        side === 'left' ? 'left-2' : 'right-2',
        /*
         * Revealed on hover of the rail (`group` lives on the row, and is what
         * the marquee's hover-pause already uses).
         *
         * `pointer-events-none` while hidden is not decoration: an arrow
         * overlaps the outermost card, so an invisible but clickable button
         * would swallow clicks meant for it.
         *
         * `focus-visible` gets the same reveal, or tabbing here would move focus
         * to something nobody can see. Keyboard activation still works while
         * `pointer-events` is off — that property only governs the pointer.
         */
        'opacity-0 transition-opacity duration-200 pointer-events-none',
        'group-hover:opacity-100 group-hover:pointer-events-auto',
        'focus-visible:opacity-100 focus-visible:pointer-events-auto',
      )}
    >
      <Icon aria-hidden="true" className="size-5" />
    </button>
  );
}

export default RailArrows;
