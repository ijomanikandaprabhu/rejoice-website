'use client';

import { useReducedMotion } from 'framer-motion';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Outlined type with a spotlight of ember travelling through it: on a mouse it
 * follows the cursor, and with no mouse it roams on its own.
 *
 * Adapted from the supplied "text hover effect", which drew SVG `<text>` with a
 * `stroke` and revealed colour through a radial mask. The look is the same; the
 * technique is not, and both changes were forced:
 *
 *   1. SVG TEXT STROKE IS UNUSABLE HERE. Chrome draws a connector line from
 *      each glyph's outer contour to its inner counter when `<text>` is
 *      stroked, so every letter with an enclosed shape came out slashed — a bar
 *      through the "A", an arrow out of the "e". So the type is real text and
 *      the effect is CSS.
 *
 *      The letters are now FILLED rather than outlined — a near-black base with
 *      the ember layers filled too, so the spotlight lights the letterforms
 *      instead of tracing their edges. The stroke is gone, which also retires
 *      the slashed-counter problem entirely rather than working around it.
 *
 *      That also removed the machinery the SVG needed to exist at all: a
 *      viewBox measured from `getBBox`, a re-measure on `document.fonts.ready`,
 *      a ResizeObserver, and `<tspan>` rows to fake the line break that SVG
 *      text cannot do. Ordinary text wraps on its own.
 *
 *   2. IT WAS HOVER-ONLY, and this line is the largest statement on the site. A
 *      touch device has no cursor, so the original would have left the headline
 *      a near-invisible outline on every phone. The spotlight roams by itself
 *      and the cursor merely takes over while it is there. The supplied
 *      component gestured at this with an `automatic?: boolean` prop its body
 *      never read.
 *
 * Colour cannot go on a CSS stroke as a gradient, so the ramp is built from two
 * stacked layers — a wide ember one and a tighter near-white core — moving
 * together under the same mask. The white/25 base shows wherever they do not.
 *
 * Reduced motion gets the letters FILLED and static. The roam is a CSS
 * animation, so the global rule in globals.css would otherwise freeze the
 * spotlight wherever it happened to be — which for most readers is off the text
 * entirely, re-creating the mobile problem in (2).
 */
export function TextHoverEffect({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLParagraphElement>(null);
  const [hovered, setHovered] = React.useState(false);
  const reduceMotion = useReducedMotion();

  /*
   * The cursor is written to CSS custom properties rather than React state:
   * this fires on every mouse move, and re-rendering the whole headline at that
   * rate is work for nothing when only two numbers change.
   */
  const handleMove = (event: React.MouseEvent<HTMLParagraphElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${((event.clientX - rect.left) / rect.width) * 100}%`);
    el.style.setProperty('--spot-y', `${((event.clientY - rect.top) / rect.height) * 100}%`);
  };

  const type =
    'block whitespace-pre-line text-center font-bold tracking-[-0.03em] text-[clamp(2.25rem,10.5vw,8.75rem)]/[1.04]';

  if (reduceMotion) {
    // Filled and still — see the note at the top of the file.
    return (
      <p className={cn(type, 'text-[#FF8A52]', className)}>{text}</p>
    );
  }

  return (
    <p
      ref={ref}
      className={cn('relative', className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={handleMove}
      /*
       * Class names here deliberately avoid a `text-` prefix. `cn` runs
       * tailwind-merge, which read `text-spot*` as a text utility conflicting
       * with the `text-[clamp(...)]` size and silently dropped it — the
       * spotlight layers rendered as nothing at all.
       */
      data-spot={hovered ? 'cursor' : 'roam'}
    >
      {/* Announced once. Both painted layers are decoration. */}
      <span className="sr-only">{text.replace('\n', ' ')}</span>

      <span aria-hidden="true" className="relative block">
        {/* The resting outline, so the shape of the words is always there. */}
        <span className={cn(type, 'spot-base')}>{text}</span>

        {/*
          Two spotlight layers over it, absolutely placed so they sit exactly on
          the base — identical text, identical wrapping, no measurement needed.
        */}
        <span className={cn(type, 'spot-layer spot-glow absolute inset-0')}>{text}</span>
        <span className={cn(type, 'spot-layer spot-core absolute inset-0')}>{text}</span>
      </span>
    </p>
  );
}

export default TextHoverEffect;
