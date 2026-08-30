'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import * as React from 'react';

import { cn } from '@/lib/utils';

interface AnimatedTextProps extends React.HTMLAttributes<HTMLDivElement> {
  text: string;
  gradientColors?: string;
  gradientAnimationDuration?: number;
  hoverEffect?: boolean;
  className?: string;
  textClassName?: string;
  /**
   * Element to render the text as. Defaults to `p` rather than `h1`: this is a
   * decorative statement line, and the page already has its real `h1` in the
   * hero. A second one would muddle the document outline for screen readers.
   */
  as?: 'p' | 'h2' | 'h3';
}

/**
 * Text with a gradient highlight that travels across it, left to right, on a
 * continuous loop.
 *
 * Adapted from the supplied component in five ways, each of which it needs to
 * work in this codebase:
 *
 *   1. `'use client'`. It uses state and Framer Motion; without the directive
 *      it is a Server Component and throws at render.
 *
 *   2. Renders a `p` by default, not `h1` — see `as` above.
 *
 *   3. Honours `prefers-reduced-motion`. The global rule in globals.css only
 *      overrides CSS `animation-*`/`transition-*`, and Framer Motion animates
 *      from JS — so unlike the CSS motion elsewhere on this site, this is NOT
 *      covered for free. Reduced motion gets the gradient parked mid-sweep:
 *      still coloured, still legible, simply not moving.
 *
 *   4. Loops in one direction instead of playing back and forth. The stock
 *      `repeatType: 'reverse'` makes the highlight bounce.
 *
 *      A one-way loop puts a requirement on the caller's gradient: the sweep
 *      scans half the ramp per cycle (`background-size: 200%`), so the ramp
 *      must repeat its pattern across those two halves for the last frame to
 *      match the first. Pass a ramp with a single highlight and the loop will
 *      visibly jump at the restart, however its two ends are coloured.
 *
 *   5. Sets the standard `background-clip` alongside the `-webkit-` prefix, and
 *      keeps a `color` underneath. The effect works by making the text fill
 *      transparent and showing the background through it, so if clipping ever
 *      fails the text would be *invisible* rather than merely unstyled. The
 *      fallback colour means the worst case is flat ember text.
 */
const AnimatedText = React.forwardRef<HTMLDivElement, AnimatedTextProps>(
  (
    {
      text,
      gradientColors = 'linear-gradient(90deg, #000, #fff, #000)',
      gradientAnimationDuration = 1,
      hoverEffect = false,
      className,
      textClassName,
      as = 'p',
      ...props
    },
    ref,
  ) => {
    const [isHovered, setIsHovered] = React.useState(false);
    const reduceMotion = useReducedMotion();

    const MotionTag = motion[as];

    /*
     * Positions run 100% -> 0%, not 0% -> 100%. `background-position: 100%`
     * aligns the image's right edge to the box's right edge, i.e. shifts the
     * image as far LEFT as it goes — so counting down is what carries the
     * highlight left to right across the type.
     */
    const textVariants: Variants = {
      initial: { backgroundPosition: '100% 0' },
      animate: {
        backgroundPosition: '0% 0',
        transition: {
          duration: gradientAnimationDuration,
          repeat: Infinity,
          repeatType: 'loop' as const,
          // Linear, and no reverse: any easing would visibly stall at the
          // seam of a loop that is supposed to run at one steady speed.
          ease: 'linear' as const,
        },
      },
      // Parked mid-sweep, where the gradient is at its brightest.
      still: { backgroundPosition: '50% 0' },
    };

    return (
      <div ref={ref} className={cn('flex items-center justify-center', className)} {...props}>
        <MotionTag
          className={cn('leading-tight', textClassName)}
          style={{
            background: gradientColors,
            backgroundSize: '200% auto',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            // Only shows if background-clip is unsupported — never invisible.
            color: '#FF6D29',
            textShadow: isHovered ? '0 0 8px rgba(255,255,255,0.3)' : 'none',
          }}
          variants={textVariants}
          initial={reduceMotion ? 'still' : 'initial'}
          animate={reduceMotion ? 'still' : 'animate'}
          onHoverStart={() => hoverEffect && setIsHovered(true)}
          onHoverEnd={() => hoverEffect && setIsHovered(false)}
        >
          {text}
        </MotionTag>
      </div>
    );
  },
);

AnimatedText.displayName = 'AnimatedText';

export { AnimatedText };
