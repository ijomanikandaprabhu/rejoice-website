import { cn } from '@/lib/utils';

import { VINYL_DOTS_PATH } from './vinylPath';

/**
 * The vinyl record artwork, on its own.
 *
 * Extracted from `HeroRecord` so the loading screen can show the SAME disc that
 * the hero ends up with — the loader hands over to the real control, and two
 * hand-copied SVGs would drift apart the first time either was touched.
 *
 * Purely presentational: no audio, no button, `aria-hidden`. `HeroRecord` wraps
 * it in the control and `SiteLoader` wraps it in the overlay.
 *
 * Two things here are load-bearing and easy to "tidy" into breakage:
 *
 *   1. The spin is applied permanently and toggled with `animation-play-state`,
 *      never by adding and removing the animation class. `paused` freezes the
 *      disc at its current angle and resumes from there; removing the animation
 *      would snap it back to 0deg every time you pause, which no record does.
 *
 *   2. The label carries an off-centre arc mark. A disc of concentric dot rings
 *      is rotationally near-symmetric, so without one asymmetric feature the
 *      spin is invisible — the rings just shimmer and the whole thing looks
 *      broken. The mark is what makes the rotation legible.
 */
export function VinylDisc({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className="size-full" aria-hidden="true">
      {/* Everything inside this group turns. The tonearm stays outside it. */}
      <g
        className={cn(
          'vinyl-disc animate-spinRecord',
          playing ? '[animation-play-state:running]' : '[animation-play-state:paused]',
        )}
      >
        {/* A faint body so the record reads as an object, not loose dots. */}
        <circle cx="100" cy="100" r="96" className="fill-white/[0.04]" />
        <circle
          cx="100"
          cy="100"
          r="96"
          strokeWidth="1"
          className={cn(
            'fill-none transition-colors duration-300',
            playing ? 'stroke-site-accent/60' : 'stroke-white/20',
          )}
        />

        <path d={VINYL_DOTS_PATH} className="fill-white/65" />

        <circle cx="100" cy="100" r="30" className="fill-site-accent" />
        <circle cx="100" cy="100" r="30" strokeWidth="1" className="fill-none stroke-black/30" />

        {/* The asymmetric mark — see the note at the top of this file. */}
        <path
          d="M100 70 A30 30 0 0 1 118 78"
          strokeWidth="2"
          strokeLinecap="round"
          className="fill-none stroke-black/30"
        />

        {/* Spindle hole punches through to the page, not to a grey. */}
        <circle cx="100" cy="100" r="3.2" className="fill-site-bg" />
      </g>

      {/*
       * Tonearm. Drawn in its playing position and rotated up off the disc when
       * idle, so the "parked" pose costs one transform rather than a second set
       * of coordinates. `view-box` because the pivot below is in viewBox units,
       * not the group's own bounding box.
       */}
      <g
        style={{ transformBox: 'view-box', transformOrigin: '176px 34px' }}
        className={cn(
          'transition-transform duration-500 ease-out',
          playing ? 'rotate-0' : 'rotate-[18deg]',
        )}
      >
        <path d="M176 34 L128 92" strokeWidth="3" strokeLinecap="round" className="stroke-white/70" />
        <path d="M128 92 l-8 10" strokeWidth="5" strokeLinecap="round" className="stroke-white/80" />
        <circle cx="176" cy="34" r="7" strokeWidth="1.5" className="fill-white/15 stroke-white/50" />
      </g>
    </svg>
  );
}

export default VinylDisc;
