'use client';

import Link from 'next/link';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** The four animated icon treatments, one per card. */
export type BentoIconVariant = 'orbit' | 'relay' | 'wave' | 'spark';

export type BentoCardItem = {
  /** The React key. Not rendered — the cards used to lead with "01".."04". */
  id: string;
  /** Small pill above the title. */
  meta: string;
  title: string;
  description: string;
  /** Where the card leads. Omit for a card that is display only. */
  href?: string;
  variant: BentoIconVariant;
};

type BentoCardsProps = {
  items: BentoCardItem[];
  eyebrow?: string;
  heading: string;
  className?: string;
};

/**
 * Four cards on a two-column grid, each with an animated mark.
 *
 * Adapted from the supplied `bento-monochrome-1` component. Only the cards were
 * wanted, and rather a lot had to change:
 *
 *   1. The supplied CSS was malformed — the three `@media` blocks were pasted
 *      INSIDE the `.bento3-icon::before/::after` declaration block, before it
 *      closed. `@media` is not valid there, so a browser drops the media
 *      queries entirely and the icon rings lose their border. The icon styles
 *      are rewritten correctly in globals.css.
 *
 *   2. The original carried two palettes and sniffed `<html>` for a `dark`
 *      class, falling back to `prefers-color-scheme`. This site sets no such
 *      class, so it would have resolved to LIGHT — a `bg-slate-100` block with
 *      dark text in the middle of a pure-black page. All of that is gone; the
 *      site's own tokens are used instead.
 *
 *   3. Its theme toggle mutated `document.documentElement` and localStorage. A
 *      card section has no business changing the whole site's theme. Removed.
 *
 *   4. The entrance uses the existing `animate-riseIn` from tailwind.config.ts
 *      — the same one `VideoCard` uses — instead of the original's bespoke
 *      keyframes plus an IntersectionObserver. That deletes the observer, and
 *      avoids its failure mode: the original starts at `opacity: 0` and depends
 *      on JS to reveal, so anything that stops the observer firing leaves the
 *      cards permanently invisible.
 *
 * `'use client'` is here only for the pointer-tracking hover glow.
 */
export function BentoCards({ items, eyebrow, heading, className }: BentoCardsProps) {
  return (
    <section className={cn('container-page pt-24', className)}>
      <div className="text-center">
        {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
        <h2 className="t-h2 mx-auto mt-3 max-w-3xl">
          {heading}
        </h2>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
        {items.map((item, index) => (
          <BentoCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </section>
  );
}

function BentoCard({ item, index }: { item: BentoCardItem; index: number }) {
  const cardRef = React.useRef<HTMLElement | null>(null);

  /*
   * The glow follows the pointer by writing its position to CSS variables the
   * radial gradient below reads. Kept off React state deliberately — this fires
   * on every mousemove, and re-rendering the card that often to move a
   * background is wasteful.
   */
  const setGlow = (event: React.MouseEvent<HTMLElement>) => {
    const target = cardRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty('--bento-x', `${event.clientX - rect.left}px`);
    target.style.setProperty('--bento-y', `${event.clientY - rect.top}px`);
  };

  const clearGlow = () => {
    const target = cardRef.current;
    if (!target) return;
    target.style.removeProperty('--bento-x');
    target.style.removeProperty('--bento-y');
  };

  return (
    <article
      ref={cardRef}
      onMouseMove={setGlow}
      onMouseLeave={clearGlow}
      className="group relative animate-riseIn overflow-hidden rounded-card border border-white/10 bg-site-surface p-6 transition-colors duration-500 hover:border-white/20 sm:p-8"
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-4 lg:flex-1">
          <span className="inline-flex w-fit items-center rounded-pill border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.4em] text-site-muted">
            {item.meta}
          </span>
          {/*
           * The TITLE is the real link: its accessible name is the service
           * name. Wrapping the whole card in an anchor instead would name that
           * link with the heading, the paragraph and the icon together — one
           * enormous name read out in full.
           *
           * The whole-card click target is a separate overlay below.
           */}
          <h3 className="t-h3 text-site-fg">
            {item.href ? (
              <Link href={item.href} className="focus-visible:underline">
                {item.title}
              </Link>
            ) : (
              item.title
            )}
          </h3>
          <p className="text-body leading-relaxed text-site-muted">{item.description}</p>
        </div>

        <div className="flex size-14 shrink-0 items-center justify-center rounded-pill border border-white/10 lg:ml-auto lg:size-16">
          <span className="bento-icon" data-variant={item.variant} aria-hidden="true">
            <span />
          </span>
        </div>
      </div>

      {/*
       * Whole-card click target.
       *
       * A sibling of the content rather than an `::after` on the title link:
       * the title sits inside a positioned wrapper, so an overlay anchored to
       * it covered only the text column and left the card's padding dead.
       *
       * `aria-hidden` and `tabIndex={-1}` keep it out of the accessibility tree
       * and the tab order — the title above is the link a screen reader and a
       * keyboard user get, so the card is announced once, not twice.
       */}
      {item.href ? (
        <Link href={item.href} aria-hidden="true" tabIndex={-1} className="absolute inset-0 z-20">
          <span className="sr-only">{item.title}</span>
        </Link>
      ) : null}

      {/* Pointer-following glow. Defaults to the card's centre before first move. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(200px circle at var(--bento-x, 50%) var(--bento-y, 50%), rgba(255,109,41,0.14), transparent 68%)',
        }}
      />
    </article>
  );
}

export default BentoCards;
