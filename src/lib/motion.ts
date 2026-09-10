/**
 * The house motion values, in one place.
 *
 * These already existed twice — `tailwind.config.ts` defines the `riseIn`
 * keyframe as `600ms cubic-bezier(0.22, 1, 0.36, 1)`, and `ui/reveal.tsx`
 * re-states both inline with a comment saying it matches `riseIn`. Framer Motion
 * needs the curve as a tuple rather than a CSS string, so without a shared
 * module it would have become a third copy.
 */

/** easeOutQuint — fast to start, long settle. The site's one curve. */
export const EASE_HOUSE = [0.22, 1, 0.36, 1] as const;

/** Matching `riseIn` in tailwind.config.ts. */
export const RISE_MS = 600;
export const RISE_PX = 14;

/** An admin screen arriving. */
export const screenEnter = {
  duration: RISE_MS / 1000,
  ease: EASE_HOUSE,
} as const;

/**
 * The active pill gliding between nav items.
 *
 * A tween rather than a spring: the pill and the screen beneath it move at the
 * same time, and a spring's overshoot against the screen's steady settle reads
 * as two separate animations rather than one gesture. Shorter than the screen,
 * because the pill is what confirms the click.
 */
export const pillTransition = {
  type: 'tween',
  duration: 0.32,
  ease: EASE_HOUSE,
} as const;

/**
 * The mobile menu taking over the screen.
 *
 * Quicker than a screen arriving (`screenEnter`) and slower than the pill: this
 * is a surface the thumb just summoned, so it has to feel answered rather than
 * animated. The close is faster still — a menu you have finished with should get
 * out of the way, the same reasoning as the admin dropdowns.
 */
export const sheetEnter = {
  duration: 0.34,
  ease: EASE_HOUSE,
} as const;

export const sheetExit = {
  duration: 0.22,
  ease: EASE_HOUSE,
} as const;

/**
 * The links following the sheet in.
 *
 * `0.045` between items, which over six links finishes 0.27s after the first —
 * inside the sheet's own 0.34s, so the stagger lands with the surface rather
 * than trailing after it. `0.06` delay lets the glass establish first; without
 * it the links appear to arrive through a wall that is still building.
 */
export const sheetLinkStagger = 0.045;
export const sheetLinkDelay = 0.06;
