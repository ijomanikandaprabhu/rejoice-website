'use client';

import { useInView } from 'framer-motion';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Fades and lifts its child into place when it scrolls into view, once.
 *
 * Deliberately NOT the `animate-riseIn` class that `VideoTile` and `BentoCard`
 * stagger with. That is a CSS animation, so it fires on MOUNT — fine for a card
 * grid near the top of a page, useless further down, where it plays out
 * off-screen and is finished before the reader ever arrives.
 *
 * The motion is a CSS TRANSITION toggled by a class, not Framer Motion's
 * animation engine. `whileInView` was tried first and snapped straight to the
 * end state: measured 98 animation frames across the reveal with zero of them
 * mid-transition. A transition also means the global `prefers-reduced-motion`
 * rule in `globals.css` neutralises this for free, since that rule covers CSS
 * `transition-*` — no separate JS check to keep in sync.
 *
 * Framer Motion is still used for `useInView`, which is only an
 * IntersectionObserver wrapper and is already proven here by `TypedText`.
 *
 * Values match `riseIn` in `tailwind.config.ts` (14px, 600ms,
 * `cubic-bezier(0.22, 1, 0.36, 1)`), so something revealed on scroll is
 * indistinguishable from something revealed on mount elsewhere on the site.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
}: {
  children: React.ReactNode;
  className?: string;
  /** Seconds. Stagger a group by passing the index times a small step. */
  delay?: number;
  as?: 'div' | 'li';
}) {
  const ref = React.useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });

  return (
    <Tag
      ref={ref as never}
      /*
       * `site/TextReveal.tsx` reveals every heading and paragraph on the public
       * site, which would otherwise animate this component's children a second
       * time from the inside. This is the opt-out it honours: the whole item
       * moves as one, which is the point of wrapping it.
       */
      data-no-reveal=""
      className={cn(
        'transition-[opacity,transform]',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-[14px] opacity-0',
        className,
      )}
      /*
       * Duration and easing inline, not as `duration-[600ms]` classes: the
       * `transition-[…]` utility emits its own `transition-duration: 150ms`,
       * and the class lost that cascade — the transition measured 0.15s
       * instead of 0.6s. Inline wins outright.
       */
      style={{
        transitionDuration: '600ms',
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        transitionDelay: `${delay}s`,
      }}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
