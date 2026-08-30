'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Headings, body copy, and anything explicitly opted in with `data-reveal`.
 *
 * `data-reveal` covers the text that is neither a heading nor a `<p>` — the
 * service lists, the About page's quotes and lists, the platform names, the hero
 * badge. Video card titles are deliberately NOT included; they arrive with their
 * card.
 */
const SELECTOR = 'h1, h2, h3, p, [data-reveal]';

/** Stagger between elements revealed together, in ms, and its ceiling. */
const STAGGER_MS = 70;
const MAX_STAGGER_MS = 420;

/**
 * How long to wait for the loading screen before revealing anyway.
 *
 * Comfortably past `SiteLoader`'s own 4s ceiling. This exists so that a flag
 * which somehow never clears cannot leave the site's text permanently invisible
 * — the failure mode is "the reveal ran early", never "the words are gone".
 */
const LOADER_WAIT_CEILING_MS = 6000;

/**
 * Fades and lifts text into place as it scrolls into view.
 *
 * The values are `riseIn`'s (tailwind.config.ts) and `ui/reveal.tsx`'s — 14px,
 * 600ms, `cubic-bezier(0.22, 1, 0.36, 1)` — so text revealed on scroll is
 * indistinguishable from a card revealed on mount. One motion, site-wide.
 *
 * ## Why it toggles classes instead of wrapping anything
 *
 * `ui/reveal.tsx` wraps its child in an extra element. Doing that to every
 * heading and paragraph would mean editing ~150 call sites and inserting new
 * boxes inside flex and grid parents, which changes layout. This finds the
 * elements and adds a class — no markup changes anywhere.
 *
 * ## Why the hidden state is applied by JS, never in the markup
 *
 * Rendering `opacity-0` in the HTML would mean the whole public site renders
 * BLANK if JavaScript fails, is blocked, or has simply not run yet. Applying the
 * hidden state here makes the failure mode "no animation" rather than "no
 * content".
 *
 * ## Why a CSS transition rather than Framer's animation engine
 *
 * `whileInView` was tried when `ui/reveal.tsx` was written and snapped straight
 * to the end state — 98 frames across the reveal, none of them mid-transition.
 * An IntersectionObserver plus a CSS transition is what actually animates here.
 *
 * ## Cost
 *
 * Opacity and transform only. Both composite, so this needs no `will-change`
 * management and no per-element budget — which an earlier `filter: blur()`
 * version did, because blur repaints on every frame.
 */
export function TextReveal() {
  const pathname = usePathname();

  /*
   * A layout effect, not a normal one: this must mark elements hidden BEFORE
   * the browser paints, or every reveal starts with a visible flash of the text
   * being hidden again.
   */
  React.useLayoutEffect(() => {
    /*
     * A real early return, not a reliance on the global reduced-motion rule.
     * That rule makes transitions instant, which does nothing for an element
     * that is never scrolled to — it would simply keep its hidden state forever.
     * Someone asking for less motion must get the page, visible.
     */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const main = document.querySelector('main');
    if (!main) return;

    const targets = Array.from(main.querySelectorAll<HTMLElement>(SELECTOR)).filter(
      (el) =>
        // Already animates itself on mount; two animations would fight.
        !el.classList.contains('animate-riseIn') &&
        // The escape hatch, used by `ui/reveal.tsx` so its subtree is not
        // revealed a second time from the inside.
        !el.closest('[data-no-reveal]') &&
        // Empty or whitespace-only nodes have nothing to reveal.
        (el.textContent ?? '').trim().length > 0,
    );
    if (targets.length === 0) return;

    for (const el of targets) el.classList.add('reveal-up');

    const reveal = (el: HTMLElement, delay: number) => {
      el.style.transitionDelay = `${delay}ms`;
      el.classList.add('is-revealed');
      el.addEventListener(
        'transitionend',
        () => {
          el.style.transitionDelay = '';
        },
        { once: true },
      );
    };

    let batch = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);

          /*
           * Anything arriving in one callback is staggered by document order —
           * otherwise a screenful resolves as a single flash. Capped, or the
           * last item would sit hidden for noticeably too long.
           */
          reveal(entry.target as HTMLElement, Math.min(batch * STAGGER_MS, MAX_STAGGER_MS));
          batch += 1;
        }
        // Anything after the first batch is scrolled to one at a time.
        if (batch > 0) batch = 0;
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
    );

    /*
     * The first screenful is judged against the TRUE viewport, not the
     * observer's.
     *
     * The observer's `-10%` bottom inset is right for scrolling — it holds a
     * reveal until an element is properly in view rather than firing at the very
     * edge. On INITIAL LOAD that same inset makes a dead strip out of the bottom
     * tenth of the screen: two paragraphs on /contact, one each on /about-us and
     * /creations, plainly visible and rendering as blank space until the visitor
     * scrolled about 90px.
     *
     * So anything already inside the real viewport is revealed here, through the
     * same staggered batch, and is not left to the observer.
     */
    const onScreen = new Set(
      targets.filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
      }),
    );

    const startRevealing = () => {
      let index = 0;
      for (const el of targets) {
        if (onScreen.has(el)) {
          reveal(el, Math.min(index * STAGGER_MS, MAX_STAGGER_MS));
          index += 1;
        } else {
          observer.observe(el);
        }
      }
    };

    /*
     * Hold the reveal while the loading screen is up.
     *
     * The elements are marked hidden ABOVE, before paint, exactly as before —
     * only the revealing waits. Marking late would show the text and then hide
     * it again, one frame later, which is the flash this whole component is
     * arranged to avoid.
     *
     * Without this the homepage's first screenful — about 40 transitions —
     * played out behind the loader: spent where nobody could see it, and
     * competing with the disc's flight for frames at exactly the wrong moment.
     *
     * The safety timer is the part that matters. Waiting on a flag another
     * component sets is precisely how text ends up hidden forever, so this
     * gives up waiting and reveals regardless.
     */
    let stopWaiting: (() => void) | undefined;

    if (document.documentElement.dataset.loading !== undefined) {
      const observerForFlag = new MutationObserver(() => {
        if (document.documentElement.dataset.loading === undefined) {
          stopWaiting?.();
          startRevealing();
        }
      });
      observerForFlag.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-loading'],
      });
      const safety = window.setTimeout(() => {
        stopWaiting?.();
        startRevealing();
      }, LOADER_WAIT_CEILING_MS);

      let released = false;
      stopWaiting = () => {
        if (released) return;
        released = true;
        observerForFlag.disconnect();
        window.clearTimeout(safety);
      };
    } else {
      startRevealing();
    }

    return () => {
      stopWaiting?.();
      observer.disconnect();
      /*
       * Strip every trace on the way out. The layout survives navigation, so a
       * page left mid-reveal would otherwise hand its hidden state to the next
       * one.
       */
      for (const el of targets) {
        el.classList.remove('reveal-up', 'is-revealed');
        el.style.transitionDelay = '';
      }
    };
    // The layout stays mounted across navigations, so this re-arms per route.
  }, [pathname]);

  return null;
}

export default TextReveal;
