'use client';

import { gsap } from 'gsap';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * A vertical reel of words: the neighbours sit above and below, faded out, and
 * the current one is framed by a selector that resizes to fit it.
 *
 * Adapted from the supplied "looping words" component. The effect is the
 * original's — a three-row window, a fade at both edges, and a measured
 * selector — but four things had to change before it could be used:
 *
 *   1. It shipped NO CSS. Every class it rendered (`looping-words__list`,
 *      `__fade`, `__selector`, `__edge`) was undefined here, so pasted as-is it
 *      drew an unstyled list of every word at once. All of the styling below is
 *      written from scratch; the effect lived entirely in the missing
 *      stylesheet.
 *
 *   2. Its `osmo-credits` block advertised the supplier's site. Not part of the
 *      effect.
 *
 *   3. `let currentIndex = 0` sat in the component body. A plain local is
 *      re-initialised on every render, and the `useCallback` closures captured
 *      whichever copy existed when they were built — it worked only because
 *      nothing re-rendered. It is a ref here.
 *
 *   4. It looped by mutating the DOM (`appendChild` of the first `li`, then a
 *      compensating `currentIndex--`), which is what made (3) fragile. The reel
 *      is padded at both ends instead and snaps between two points that are
 *      identical in all three rows — same seamless loop, no DOM surgery. See
 *      the note on `reel` for why both ends have to be padded.
 *
 * Reduced motion gets the first word, static: GSAP animates from JS, so the
 * global rule in globals.css does not reach it — the note `motion-footer`
 * carries too.
 */
export function LoopingWords({
  words,
  className,
}: {
  words: readonly string[];
  className?: string;
}) {
  const listRef = React.useRef<HTMLUListElement>(null);
  const bracketRef = React.useRef<HTMLDivElement>(null);
  const indexRef = React.useRef(1); // START — see the reel note below.

  /*
   * The reel is padded at BOTH ends, not just the tail.
   *
   *   index:  0            1      …      n        n+1    n+2
   *   word:   words[n-1]   w[0]   …      w[n-1]   w[0]   w[1]
   *           └ lead-in    └ START                └ WRAP
   *
   * A single trailing duplicate is enough only for a one-row window. With three
   * rows the NEIGHBOURS give the wrap away: at the old wrap point the row below
   * was empty (end of list) and after the snap the row above was empty
   * (padding), so the whole column appeared to jump. Padding both ends makes
   * index n+1 and index 1 identical in all three rows, so the reset is
   * invisible. `words[1]` is there purely to fill the row BELOW the wrap point.
   */
  const reel = React.useMemo(
    () => [words[words.length - 1], ...words, words[0], words[1]],
    [words],
  );
  const START = 1;
  const WRAP = words.length + 1;

  React.useEffect(() => {
    const list = listRef.current;
    const bracket = bracketRef.current;
    if (!list || !bracket || words.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Measured rather than assumed: the rows are sized in `em`, so their pixel
    // height depends on the font size actually in force at this breakpoint.
    const rowHeight = (list.children[0] as HTMLElement).getBoundingClientRect().height;

    const fitBracket = (i: number) => {
      const word = list.children[i]?.firstElementChild as HTMLElement | undefined;
      if (!word) return;
      gsap.to(bracket, {
        width: word.getBoundingClientRect().width + 40,
        duration: 0.5,
        ease: 'expo.out',
      });
    };

    // `context` scopes every tween, so one `revert()` undoes the lot — the same
    // way `motion-footer` manages its GSAP.
    const ctx = gsap.context(() => {
      // The reel no longer starts at zero: index 1 is the first real word, with
      // the lead-in copy of the last word sitting in the row above it.
      indexRef.current = START;
      gsap.set(list, { y: -rowHeight * START });
      fitBracket(START);

      const advance = () => {
        indexRef.current += 1;

        gsap.to(list, {
          // `y` in pixels off the measured row, not `yPercent`: the reel's own
          // height changes with the word count, so a percentage would have to
          // be recomputed for every list length.
          y: -rowHeight * indexRef.current,
          duration: 1.2,
          ease: 'elastic.out(1, 0.85)',
          onStart: () => fitBracket(indexRef.current),
          onComplete: () => {
            // At WRAP the three rows read exactly as they do at START, so
            // snapping back cannot be seen.
            if (indexRef.current >= WRAP) {
              indexRef.current = START;
              gsap.set(list, { y: -rowHeight * START });
            }
          },
        });
      };

      gsap.timeline({ repeat: -1, delay: 0.8 }).call(advance).to({}, { duration: 2 });
    }, list);

    return () => ctx.revert();
  }, [WRAP, words.length]);

  return (
    <div className={cn('relative', className)} data-looping-words>
      {/* The words carry meaning, so they are announced in full. The reel is
          decoration and stays out of the accessibility tree. */}
      <ul className="sr-only">
        {words.map((word) => (
          <li key={word}>{word}</li>
        ))}
      </ul>

      <div
        aria-hidden="true"
        className="relative mx-auto text-[2rem] font-light leading-[1.6] tracking-[-0.02em] sm:text-[3.25rem]"
      >
        {/*
          Three rows tall, so the previous and next words show above and below —
          that glimpse is the effect. A one-row window would just be a word
          swapping over.

          The mask fades both edges to nothing, rather than the original's
          gradient overlay: a mask works whatever sits behind it, where a
          gradient has to be painted in the page's own background colour and
          breaks the moment that changes.
        */}
        <div
          className="h-[4.8em] overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent 0%, #000 32%, #000 68%, transparent 100%)',
          }}
        >
          {/* One row of padding, so the FIRST word starts centred rather than
              at the top of the window. */}
          <ul ref={listRef} className="pt-[1.6em]">
            {reel.map((word, i) => (
              <li key={`${word}-${i}`} className="flex h-[1.6em] items-center justify-center">
                <span className="whitespace-nowrap text-site-fg">{word}</span>
              </li>
            ))}
          </ul>
        </div>

        {/*
          The selector, framing the centre row. Corner brackets rather than the
          original's four plain edges: the Services panels already draw corner
          marks, so it reads as this site's own detail.
        */}
        <div
          ref={bracketRef}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[1.5em] -translate-x-1/2 -translate-y-1/2"
        >
          {[
            'left-0 top-0 border-l-2 border-t-2',
            'right-0 top-0 border-r-2 border-t-2',
            'bottom-0 left-0 border-b-2 border-l-2',
            'bottom-0 right-0 border-b-2 border-r-2',
          ].map((corner) => (
            <span key={corner} className={cn('absolute size-4 border-site-accent', corner)} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default LoopingWords;
