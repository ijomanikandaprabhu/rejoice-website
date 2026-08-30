'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A line that types itself out, holds, and types again.
 *
 * Three things this has to get right, none of them obvious:
 *
 *   1. It runs only while SEEN. This kind of line sits well down a page, and a
 *      typewriter that finished before the reader arrived is just static text
 *      with extra steps. `useInView` starts it on arrival and stops it when the
 *      line scrolls away, so the loop is not burning timers off-screen.
 *
 *   2. It reserves its finished size. Appending characters grows the element,
 *      so the naive version reflows the whole page below it while it runs. The
 *      full string is rendered in an `invisible` span to hold the box, and the
 *      typed portion is laid over it absolutely — same text, same width, so the
 *      two wrap identically and nothing moves.
 *
 *   3. It honours `prefers-reduced-motion` EXPLICITLY. As
 *      `animated-shiny-text` already notes, the global rule in globals.css
 *      overrides CSS `animation-*`/`transition-*` only, and this animates from
 *      JS — so reduced motion is not covered for free. It renders finished.
 *
 * Accessibility: the sentence is announced once from an `sr-only` span; both
 * visual layers are `aria-hidden`, so nothing is read out character by
 * character as it types.
 */
export function TypedText({
  text,
  className,
  as: Tag = 'p',
  speedMs = 32,
  holdMs = 5000,
}: {
  text: string;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'blockquote';
  /** Milliseconds per character. */
  speedMs?: number;
  /** How long the finished line is held before it types again. */
  holdMs?: number;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  /*
   * No `margin` and no `amount`: the loop starts the moment any part of the
   * line enters. A threshold would leave a window where the line is on screen
   * but has not started, and since the overlay is empty at that point the
   * reader would see a blank gap where the sentence should be.
   */
  const inView = useInView(ref);

  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!inView || reduceMotion) return;

    let cancelled = false;
    let timer = 0;

    const run = () => {
      setCount(0);
      let i = 0;

      const tick = () => {
        if (cancelled) return;
        i += 1;
        setCount(i);

        /*
         * ONE timeout, either continuing or restarting. Scheduling the next
         * `tick` and a `run` separately leaves the first untracked, so it fires
         * past the end of the string and the loop runs away.
         */
        const more = i < text.length;
        timer = window.setTimeout(more ? tick : run, more ? speedMs : holdMs);
      };

      timer = window.setTimeout(tick, speedMs);
    };

    run();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [inView, reduceMotion, text, speedMs, holdMs]);

  /*
   * Only reduced motion settles. While the loop is live the overlay is always
   * present — including through the hold, where it shows the finished line — so
   * the spacer underneath stays invisible and the box never changes size.
   */
  const settled = reduceMotion;

  return (
    <Tag ref={ref as never} className={className} data-typed>
      <span className="sr-only">{text}</span>

      <span aria-hidden="true" className="relative block">
        {/*
          Holds the final box so the page below never shifts. `invisible` rather
          than `opacity-0` — both keep layout, and `invisible` also drops it out
          of the accessibility tree without needing its own aria-hidden.
        */}
        <span className={cn('block', !settled && 'invisible')}>{text}</span>

        {!settled ? (
          <span className="absolute inset-0 block">
            {text.slice(0, count)}
            {/* The caret rides after the last character, so it follows the text
                across line wraps without any position maths. */}
            <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] animate-pulse bg-site-accent align-middle" />
          </span>
        ) : null}
      </span>
    </Tag>
  );
}

export default TypedText;
