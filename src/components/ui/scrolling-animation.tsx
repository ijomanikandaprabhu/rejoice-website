'use client';

import Image from 'next/image';
import * as React from 'react';

import { cn } from '@/lib/utils';

export type ScrollRingItem = {
  /** Shown when `src` is empty, and used as the image's alt text when it is not. */
  label: string;
  /** Path under `public/` for the platform's logo. Empty renders a name tile instead. */
  src?: string;
  /**
   * The Rejoice profile on that platform. When set the tile becomes a link that
   * opens in a new tab; without one it stays a plain tile, so an empty URL never
   * produces a dead link. Same two states as `PlatformGrid` on /songs.
   */
  href?: string;
};

type ScrollRingProps = {
  items: ScrollRingItem[];
  eyebrow?: string;
  /** A `\n` splits the heading into two deliberate lines. */
  heading: string;
  lead?: string;
  className?: string;
};

/**
 * Tiles that fan out from the centre of a ring as the section is scrolled through,
 * uncovering the heading behind them.
 *
 * Adapted from the supplied component in five ways, each of which it needs to work
 * on this page:
 *
 *   1. Progress is measured from THIS SECTION's position, not `window.scrollY`.
 *      The original finished its animation at `scrollY = 500`, which only works
 *      when the component owns the top of the page. Here it sits after the
 *      channel rails, roughly 1,800px down — so absolute page scroll is already
 *      past the finish line before the section is even on screen, and the ring
 *      would be frozen fully open every time. See `progress` below.
 *
 *   2. Sized fluidly instead of a hardcoded 600px, which is 160% of a 375px
 *      viewport and would push the whole page sideways on a phone.
 *
 *   3. Site tokens instead of `bg-white dark:bg-black`. This site sets no `dark`
 *      class on `<html>`, so every `dark:` variant in the original was inert and
 *      the light half won — a white block on a black page. They are removed
 *      rather than left as dead code.
 *
 *   4. Any number of tiles, spaced `2π / n`. The original hardcoded eight
 *      `Math.PI / 4` steps, which cannot express the nine platforms wanted here.
 *
 *   5. Honours `prefers-reduced-motion`. The global rule in globals.css only
 *      overrides CSS `animation-*`/`transition-*`, and this animates from JS, so
 *      unlike the CSS motion elsewhere on this site it is NOT covered for free.
 *      Reduced motion gets the finished, readable state.
 */
export function ScrollRing({ items, eyebrow, heading, lead, className }: ScrollRingProps) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduceMotion(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  React.useEffect(() => {
    if (reduceMotion) {
      setProgress(1);
      return;
    }

    let frame = 0;

    /*
     * 0 when the section's top reaches the bottom of the viewport, 1 once it has
     * been scrolled through by its own height. Everything is relative to the
     * element, so the section behaves the same wherever it sits on the page.
     */
    const measure = () => {
      frame = 0;
      const el = sectionRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;

      const scrolled = -rect.top;
      setProgress(Math.min(Math.max(scrolled / travel, 0), 1));
    };

    // Coalesce to one measurement per frame: the original called setState on
    // every raw scroll event, re-rendering every transformed tile each time.
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [reduceMotion]);

  /*
   * Eased, not linear. The tiles cover most of their travel early and then
   * decelerate into place, so the last part of the fan-out is a slow settle
   * rather than arriving at full speed and stopping dead. `1 - (1-t)³` is a
   * cubic ease-out: at the halfway point it is already 87.5% of the way there,
   * and the remaining 12.5% is spread over the second half of the scroll.
   *
   * Spread over 0.9 of the section rather than 0.75, which lengthens that slow
   * final approach further.
   */
  const t = Math.min(progress / 0.9, 1);
  const fan = 1 - Math.pow(1 - t, 3);

  /*
   * Keyed off raw progress, not `fan`. The easing above reaches high values
   * very early, so a threshold on `fan` would uncover the heading almost
   * immediately.
   */
  const textVisible = progress > 0.5;

  const step = items.length > 0 ? (Math.PI * 2) / items.length : 0;


  return (
    <section
      ref={sectionRef}
      className={cn('relative bg-site-bg', className)}
      style={{ height: '160vh' }}
    >
      {/*
       * Sticky rather than fixed, so the ring holds still in the middle of the
       * viewport while the section's own height provides the scroll distance the
       * animation is measured against.
       */}
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden px-4">
        {/*
         * One fluid token drives all three rings, the tiles and the fan-out
         * radius, so the proportions hold at every width and nothing is fixed px.
         * 37.5rem = the original 600px at the top end; 90vw keeps it inside a
         * phone at the bottom.
         */}
        <div
          className="relative grid aspect-square w-[var(--ring)] place-items-center rounded-full"
          style={
            {
              /*
               * Bounded by viewport HEIGHT as well as width: the ring is as tall
               * as it is wide and lives in an `h-screen` sticky box, so sizing
               * it on width alone clips it on a short laptop window.
               */
              '--ring': 'max(15rem, min(84vw, 75vh, 38rem))',
              /*
               * Tile diameter and fan radius are COUPLED — changing one alone
               * either collides the tiles or pushes them off a phone screen.
               * With `n` tiles on a ring, neighbouring centres are
               * `2·r·sin(π/n)` apart and must clear one diameter, while the
               * tiles must also stay inside the ring (`r + D/2 ≤ ring/2`).
               * gap = ring · (2·sin(π/n)·(0.5 − k/2) − k),  k = D / ring
               *
               * With n = 10 that leaves only 13px of gap at k = 0.22 — visually
               * touching — so k = 0.20 is used, which restores ~28px. Adding or
               * removing a platform changes n and therefore this number; recompute
               * rather than guess. The radius below is the matching `ring/2 − D/2`.
               */
              '--tile': 'calc(var(--ring) * 0.20)',
            } as React.CSSProperties
          }
        >
          <div
            className={cn(
              'grid aspect-square w-[83.3%] place-items-center rounded-full transition-colors duration-500',
              fan > 0.5 ? 'border-2 border-white/10' : 'border-2 border-transparent',
            )}
          >
            <div
              className={cn(
                'grid aspect-square w-full place-items-center rounded-full transition-colors duration-500',
                fan > 0.2 ? 'border-2 border-site-accent/25' : 'border-2 border-transparent',
              )}
            >
              {/*
               * The ember ring: a gradient ring drawn as a 2px-padded disc.
               *
               * 65%, down from 80%, so it lands inside the tiles' inner edge
               * (radius 0.40 − 0.10 = 0.30 of the ring). At 80% the tiles sat on
               * top of it and the ember accent vanished from the section
               * entirely once they fanned out.
               */}
              <div className="grid aspect-square w-[65%] place-items-center rounded-full bg-gradient-to-r from-site-secondary via-site-accent to-site-accentSoft p-0.5">
                <div className="relative grid size-full place-items-center rounded-full bg-site-bg">
                  {items.map((item, index) => {
                    const angle = index * step;
                    /*
                     * `ring/2 − tile/2` = 0.5 − 0.10, so the tiles' outer edges
                     * land exactly on the ring. See the note on `--tile` above:
                     * this number is not free to change on its own.
                     */
                    const distance = `calc(var(--ring) * 0.40 * ${fan.toFixed(4)})`;

                    // A tile with a profile URL is the link itself, so the whole
                    // disc is the target rather than a small area inside it.
                    const Tag = item.href ? 'a' : 'div';
                    const linkProps = item.href
                      ? { href: item.href, target: '_blank', rel: 'noopener noreferrer' }
                      : {};

                    return (
                      <Tag
                        key={item.label}
                        {...linkProps}
                        /*
                         * White, and a circle. The logos are supplied as
                         * transparent PNGs and four of them — Apple Music and
                         * Amazon Music especially, which are pure black artwork —
                         * would be invisible on the dark surface this used to
                         * carry. No border: a hairline on a white disc against
                         * black adds nothing, so the shadow does the seating.
                         */
                        className="absolute z-0 grid size-[var(--tile)] place-items-center overflow-hidden rounded-full bg-white shadow-gloss transition-transform duration-300 ease-out"
                        style={{
                          transform: `translate(calc(${distance} * ${Math.cos(angle).toFixed(4)}), calc(${distance} * ${Math.sin(angle).toFixed(4)}))`,
                        }}
                      >
                        {item.src ? (
                          /*
                           * The whole logo, uncropped. Most are wide wordmarks
                           * (up to 5.4:1), so `object-contain` fits them to the
                           * circle's width; the inset keeps their ends clear of
                           * the curve rather than running into it.
                           */
                          <Image
                            src={item.src}
                            alt={item.label}
                            fill
                            sizes="(min-width: 768px) 150px, 90px"
                            className="object-contain p-[10%]"
                          />
                        ) : (
                          /*
                           * Stand-in until the real logo files land in
                           * public/brand/platforms. Balanced and centred so it
                           * reads as deliberate rather than as a broken image.
                           */
                          <span className="px-1 text-center text-[0.6875rem] font-medium leading-tight text-site-fg">
                            {item.label}
                          </span>
                        )}

                        {item.href ? (
                          <span className="sr-only">{item.label} (opens in a new tab)</span>
                        ) : null}
                      </Tag>
                    );
                  })}

                  <div
                    className={cn(
                      'relative z-20 flex flex-col items-center justify-center px-6 transition-opacity duration-500',
                      textVisible ? 'opacity-100' : 'opacity-0',
                    )}
                  >
                    {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
                    {/*
                     * Sized against the inner disc, not the viewport: the usable
                     * width in there is only ~85% of the disc after the padding,
                     * and at the full `t-h2` scale the first line overflows it
                     * and wraps into three.
                     */}
                    <h2 className="t-h2 mt-3 whitespace-pre-line text-center text-[clamp(1.0625rem,3.4vw,1.75rem)]">
                      {heading}
                    </h2>
                    {lead ? (
                      <p className="mt-4 max-w-xs text-center text-body text-site-muted">{lead}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
