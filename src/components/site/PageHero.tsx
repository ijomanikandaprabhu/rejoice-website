import Image from 'next/image';

import { PerspectiveGridHero } from '@/components/ui/web3-hero-section';
import { cn } from '@/lib/utils';

/**
 * The full-bleed page hero: About and Services both open with it.
 *
 * One component rather than two copies of the layer stack. The stack is fiddly
 * — an ember base, a black wash sized for type contrast, the raked grid, and
 * the copy above all three — and the two pages had already started to drift
 * apart on backdrop strength and grid offset before this was lifted out. The
 * same reasoning is why `GridBackdrop` is shared with the CTA panel.
 *
 * `badge` and `media` are optional because Services supplies neither: its entry
 * in `content.config.ts` carries only an eyebrow, a heading and intro copy.
 */
export function PageHero({
  eyebrow,
  heading,
  paragraphs,
  badge,
  media,
  accentLine,
  wordmark,
  gridOffset,
}: {
  /** Optional: Contact leads with the pill alone rather than a pill and a kicker. */
  eyebrow?: string;
  heading: string;
  paragraphs: readonly string[];
  /** A small pill above the eyebrow. Omitted entirely when not supplied. */
  badge?: string;
  /** An image or an .mp4. Empty or absent renders the ember gradient instead. */
  media?: string;
  /** An ember line closing the copy. Contact is the only page with one. */
  accentLine?: string;
  /** An oversized ghosted word behind the copy. */
  wordmark?: string;
  /**
   * Passed through to the grid. Needs raising on a page whose copy runs longer
   * than About's, or the raked band creeps back up behind the last line.
   */
  gridOffset?: number;
}) {
  const isVideo = Boolean(media) && (media!.endsWith('.mp4') || media!.endsWith('.webm'));

  return (
    <section className="relative isolate flex min-h-[64vh] items-center overflow-hidden">
      {media ? (
        isVideo ? (
          // Decorative background footage: muted, looping, not focusable.
          <video
            src={media}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <Image src={media} alt="" fill priority sizes="100vw" className="object-cover" />
        )
      ) : (
        // No footage yet — the hero's own ember-to-black fade stands in, and
        // swapping it for a file is a one-line change in the config.
        <span aria-hidden="true" className="absolute inset-0 bg-heroFade" />
      )}

      {/*
        The black scrim belongs to the FOOTAGE path only.

        It exists so type contrast does not change when a photograph is dropped
        in behind the copy. `bg-heroFade` already ends at black on its own, so
        drawing both would only flatten the top of the gradient into mud.
      */}
      {media ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-site-bg"
        />
      ) : null}

      {/*
        The raked perspective grid. It REPLACES the flat `footer-bg-grid` this
        used to carry rather than layering over it — two grids at different
        angles in one frame moire against each other.

        `opacity={0}` suppresses the component's own elliptical colour wash: the
        hero now gets its colour from `heroFade`, and a centre-anchored ellipse
        fights a top-anchored linear fade. Only the grid is wanted here.
      */}
      <PerspectiveGridHero opacity={0} gridOffset={gridOffset} />

      {/*
        Film grain, reusing the site's existing `.noise-overlay` (globals.css)
        rather than a second noise implementation — SVG fractal turbulence from
        the `grain` token, so it costs no request, stays sharp at any density,
        and already degrades to a still texture under reduced motion.

        `overlay` blending keeps the blacks black and shows the grain in the
        midtones, which on this hero means the ember glow — where texture is
        wanted. The section's `isolate` keeps the blend compositing against the
        hero's own layers rather than the page behind it.

        On strength: the grain's MEAN is mid-grey, and `overlay` against a
        mid-grey blend is a no-op, so the average background is unchanged and
        body copy holds its measured 5.49:1. Only isolated bright grain pixels
        deviate — at 0.22 a peak-white one reaches ~4.3:1, against 3.87:1 at
        0.35 and 3.34:1 at 0.5.
        That per-pixel figure is not a real contrast failure (the eye integrates
        across a glyph, and no opacity that keeps the texture visible avoids it),
        but there is no reason to run heavier than the effect needs.
      */}
      <span
        aria-hidden="true"
        className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
      />

      {wordmark ? (
        /*
         * The oversized ghosted word behind the copy.
         *
         * Styling comes from `.footer-giant-text` (globals.css) rather than a
         * second copy of it — transparent fill, a 1px white stroke at 0.07, and
         * a gradient that fades the letterforms downward. That faintness is
         * also what keeps it from eating the text contrast in front of it.
         *
         * Not drawn on a phone: the clamp bottoms out at 64px, which behind a
         * four-line heading muddies the type rather than backing it.
         *
         * Sized in `vw` so it scales with the viewport instead of wrapping or
         * overflowing; the section's `overflow-hidden` clips the ends on narrow
         * screens, which is the intended look.
         *
         * Anchored at 25% rather than centred, so it falls behind the HEADING
         * and not the body copy. That is a contrast constraint: the heading is
         * white and measures ~10:1, which absorbs the wordmark's 0.09 fill
         * without trouble, but the same fill behind `site-muted` body text
         * drops it to 4.28:1 — under AA.
         */
        <span
          aria-hidden="true"
          className="footer-giant-text pointer-events-none absolute left-1/2 top-[25%] z-0 hidden -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap font-black uppercase md:block"
          style={{ fontSize: 'clamp(4rem, 17vw, 15rem)' }}
        >
          {wordmark}
        </span>
      ) : null}

      <div className="container-page relative z-10 py-24 text-center">
        {badge ? (
          /*
           * A dark pill, not the accent-tinted one this started as. Measured:
           * `#FF6D29` on `bg-site-accent/[0.12]` over the glow is 3.06:1, which
           * fails AA for text this small, and deepening the accent fill makes it
           * worse rather than better. Black at 35% with `accentSoft` text is
           * 6.16:1. The accent border keeps it reading as branded.
           */
          <span
            data-reveal
            className="inline-flex items-center rounded-pill border border-site-accent/40 bg-black/35 px-4 py-1.5 text-label uppercase tracking-[0.12em] text-site-accentSoft"
          >
            {badge}
          </span>
        ) : null}

        {eyebrow ? <p className={badge ? 't-label mt-8' : 't-label'}>{eyebrow}</p> : null}
        {/* A pill sitting directly above the heading needs the wider gap the
            eyebrow would otherwise have provided. */}
        <h1 className={cn('t-h1 mx-auto max-w-3xl', eyebrow ? 'mt-4' : badge && 'mt-8')}>
          {heading}
        </h1>

        {paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="mx-auto mt-5 max-w-2xl text-[1.0625rem] leading-[1.7] text-site-muted"
          >
            {paragraph}
          </p>
        ))}

        {accentLine ? (
          <p className="mt-6 text-[1.0625rem] font-medium text-site-accent">{accentLine}</p>
        ) : null}
      </div>
    </section>
  );
}
