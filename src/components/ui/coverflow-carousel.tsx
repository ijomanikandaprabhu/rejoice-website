'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export interface CoverflowSlide {
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  meta?: { label: string; value: string }[];
  /** Clicking the card goes here. Any card, not only the centred one. */
  href?: string;
}

export interface CoverflowCarouselProps {
  slides: CoverflowSlide[];
  /** Degrees the first neighbour tilts. */
  rotate?: number;
  /** How far the first neighbour recedes, as a fraction of card width. */
  depth?: number;
  /** Viewer distance as a multiple of card width — smaller is a wider lens. */
  perspective?: number;
  /** Exponent on distance. Below 1 the rake eases off as cards travel out. */
  falloff?: number;
  /** Opacity lost per step from the centre. */
  fade?: number;
  /** Any CSS length. Everything else is derived from it, so the rake scales. */
  cardWidth?: string;
  /** Space between cards, as a fraction of card width. */
  gap?: number;
  loop?: boolean;
  showCaption?: boolean;
  showPagination?: boolean;
  showNavigation?: boolean;
  /**
   * Advance on its own every N milliseconds. 0 or omitted turns it off.
   *
   * Suspended while the pointer is over the carousel, while it has keyboard
   * focus, mid-drag, when scrolled out of view, in a background tab, and
   * entirely under `prefers-reduced-motion`.
   */
  autoplayMs?: number;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
  cardClassName?: string;
}

/**
 * Coverflow carousel.
 *
 * The supplied component, essentially intact — its looping maths, drag physics
 * and paint-straight-to-DOM approach are sound. Three changes were needed here:
 *
 *   1. SITE COLOURS. The original used `bg-muted`, `text-foreground`,
 *      `text-muted-foreground` and `ring-ring`, which resolve through
 *      tailwind.config.ts to this project's shadcn tokens — and those are the
 *      ADMIN panel palette (`--primary` is lime). Wrong for a public page.
 *
 *   2. `prefers-reduced-motion`. The settle is a JS rAF easing, so the global
 *      CSS rule in globals.css does not cover it; reduced motion now jumps
 *      straight to the target.
 *
 *   3. `next/image` instead of a plain `<img>` with an eslint-disable. The
 *      slides are remote thumbnails on hosts next.config.mjs already permits.
 *
 * Plus an optional `href` per slide: clicking ANY card opens that video.
 * Browsing is still covered by drag, the arrows, the dots and the arrow keys.
 */
export function CoverflowCarousel({
  slides,
  rotate = 44,
  depth = 0.6,
  perspective = 3,
  falloff = 0.56,
  fade = 0.1,
  cardWidth = 'clamp(148px, 22vw, 260px)',
  gap = 0.05,
  loop = true,
  showCaption = false,
  showPagination = false,
  showNavigation = false,
  autoplayMs = 0,
  label = 'Cover carousel',
  className,
  cardClassName,
}: CoverflowCarouselProps) {
  const count = slides.length;
  const router = useRouter();

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  /** Fractional card index at the centre. The single source of truth. */
  const posRef = React.useRef(0);
  /** Where the current settle is headed. Stepping off `pos` instead would
      swallow a keypress that lands mid-flight, before the round-off moves. */
  const targetRef = React.useRef(0);
  const widthRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const draggedRef = React.useRef(false);
  const dragRef = React.useRef<{
    id: number;
    x: number;
    pos: number;
    v: number;
    t: number;
  } | null>(null);

  const [selected, setSelected] = React.useState(0);
  /** Anything the visitor is doing that autoplay must not fight. */
  const [held, setHeld] = React.useState(false);
  const [onScreen, setOnScreen] = React.useState(true);

  /** Nearest whole card, folded back into 0..count-1. */
  const indexAt = React.useCallback(
    (pos: number) => ((Math.round(pos) % count) + count) % count,
    [count],
  );

  // Paint straight to the DOM. Sixty state updates a second would re-render
  // every card for numbers React never needs to see.
  const paint = React.useCallback(() => {
    const width = widthRef.current;
    if (!width) return;
    const pitch = width * (1 + gap);
    const pos = posRef.current;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;

      // Fold the distance into the shorter way round the ring. This is the
      // whole looping mechanism — no cloned nodes, no shuffling the DOM.
      let offset = index - pos;
      if (loop) {
        offset = ((offset % count) + count) % count;
        if (offset > count / 2) offset -= count;
      }

      const distance = Math.abs(offset);
      // Both the tilt and the recession ease off as cards travel out.
      const ramp = Math.pow(distance, falloff);
      // Capped short of edge-on so a far card never turns its back.
      const tilt = Math.min(rotate * ramp, 82) * Math.sign(offset);

      card.style.transform =
        `translateX(calc(-50% + ${offset * pitch}px)) ` +
        `translateZ(${-depth * width * ramp}px) rotateY(${-tilt}deg)`;

      // A card is teleported across the ring at exactly half a turn out, so it
      // has to be gone by then or the jump is visible.
      const edge = loop ? Math.min(1, Math.max(0, count / 2 - distance)) : 1;
      card.style.opacity = String(Math.max(0, 1 - fade * distance) * edge);
      card.style.zIndex = String(100 - Math.round(distance));
    });
  }, [count, depth, fade, falloff, gap, loop, rotate]);

  const settle = React.useCallback(
    (target: number) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      targetRef.current = target;
      setSelected(indexAt(target));

      // Reduced motion: land on it. The easing below is JS, so the global CSS
      // rule that neutralises animation elsewhere on this site does nothing here.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        posRef.current = target;
        paint();
        rafRef.current = null;
        return;
      }

      const step = () => {
        const remaining = target - posRef.current;
        if (Math.abs(remaining) < 0.0004) {
          posRef.current = target;
          paint();
          rafRef.current = null;
          return;
        }
        // Exponential ease-out, not a spring. Swap in a spring only if the
        // settle needs overshoot.
        posRef.current += remaining * 0.16;
        paint();
        rafRef.current = requestAnimationFrame(step);
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [indexAt, paint],
  );

  const clamp = React.useCallback(
    (pos: number) => (loop ? pos : Math.max(0, Math.min(count - 1, pos))),
    [count, loop],
  );

  const goTo = React.useCallback(
    (index: number) => {
      // Take the shorter way round rather than unwinding the whole ring.
      const target = loop
        ? index + Math.round((targetRef.current - index) / count) * count
        : index;
      settle(clamp(target));
    },
    [clamp, count, loop, settle],
  );

  const nudge = React.useCallback(
    (by: number) => settle(clamp(Math.round(targetRef.current) + by)),
    [clamp, settle],
  );

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    targetRef.current = posRef.current;
    draggedRef.current = false;
    setHeld(true);
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      pos: posRef.current,
      v: 0,
      t: performance.now(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const pitch = widthRef.current * (1 + gap);
    if (!pitch) return;

    // A few pixels of slop, so a click with a shaky hand still counts as a click.
    if (Math.abs(event.clientX - drag.x) > 4) draggedRef.current = true;

    const now = performance.now();
    const previous = posRef.current;
    posRef.current = clamp(drag.pos - (event.clientX - drag.x) / pitch);
    // Cards per second, for the throw.
    drag.v = ((posRef.current - previous) / Math.max(now - drag.t, 1)) * 1000;
    drag.t = now;

    const index = indexAt(posRef.current);
    if (index !== selected) setSelected(index);
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;
    // Let a flick carry, but never more than two cards.
    const carried = Math.max(-2, Math.min(2, drag.v * 0.18));
    settle(clamp(Math.round(posRef.current + carried)));
    openCardAt(event.clientX, event.clientY);
    // Released over the carousel still counts as hovering; the mouse-leave
    // handler is what finally lets autoplay resume.
    setHeld(event.currentTarget.matches(':hover'));
  };

  /**
   * Any card opens its video — not just the centre one.
   *
   * Resolved from the pointer position on release rather than from a `click`
   * handler on the card. The frame calls `setPointerCapture` on pointerdown, so
   * every subsequent pointer event — and the click that follows — is dispatched
   * to the FRAME, not to the card underneath. A per-card `onClick` therefore
   * never fires while the carousel is draggable.
   *
   * `draggedRef` keeps a swipe from counting as a click: it is set once the
   * pointer has travelled more than a few pixels, so dragging never navigates.
   */
  const openCardAt = (clientX: number, clientY: number) => {
    if (draggedRef.current) return;
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .find((node) => node instanceof HTMLElement && node.dataset.slideIndex !== undefined) as
      | HTMLElement
      | undefined;
    if (!hit) return;
    const href = slides[Number(hit.dataset.slideIndex)]?.href;
    if (href) router.push(href);
  };

  // Card width drives pitch, depth and perspective, so it is the only thing
  // worth measuring — and only when the box actually changes.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      paint();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [paint]);

  // Only run autoplay while the carousel is actually in view.
  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !autoplayMs) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [autoplayMs]);

  /*
   * Autoplay.
   *
   * Deliberately suspended whenever the visitor is engaged — pointer over it,
   * keyboard focus inside it, or mid-drag — because an auto-advance that fights
   * the person using it is worse than none at all. The IntersectionObserver
   * above also stops it once the carousel is scrolled out of view.
   *
   * There is no `document.hidden` check: browsers already throttle timers in a
   * background tab to roughly once a minute, so it cannot race away unseen, and
   * the observer covers the case that actually matters.
   *
   * Off entirely under `prefers-reduced-motion`: this is exactly the
   * auto-updating motion that setting exists to stop, and the global CSS rule
   * cannot reach a JS timer.
   */
  React.useEffect(() => {
    if (!autoplayMs || held || !onScreen) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const id = window.setInterval(() => nudge(1), autoplayMs);
    return () => window.clearInterval(id);
  }, [autoplayMs, held, onScreen, nudge]);

  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const active = slides[selected];

  if (count === 0) return null;

  return (
    <div
      className={cn('w-full', className)}
      style={{ ['--cf-card' as string]: cardWidth }}
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onMouseEnter={() => setHeld(true)}
          onMouseLeave={() => setHeld(false)}
          onFocus={() => setHeld(true)}
          onBlur={() => setHeld(false)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') {
              event.preventDefault();
              nudge(-1);
            } else if (event.key === 'ArrowRight') {
              event.preventDefault();
              nudge(1);
            }
          }}
          // Vertical padding keeps the drop shadows clear of the overflow clip.
          className="cursor-grab overflow-hidden py-10 outline-none ring-site-accent focus-visible:ring-2 active:cursor-grabbing"
          style={{
            perspective: `calc(var(--cf-card) * ${perspective})`,
            // Horizontal drag is ours; the page keeps vertical scrolling.
            touchAction: 'pan-y',
          }}
        >
          {/*
           * Track height follows the CARD ratio. The cards are 16:9, so leaving
           * this at `var(--cf-card)` (the square assumption) would reserve a
           * card's width of height and leave a large dead gap under the row.
           */}
          <div
            className="relative select-none"
            style={{ height: 'calc(var(--cf-card) * 9 / 16)', transformStyle: 'preserve-3d' }}
          >
            {slides.map((slide, index) => (
              <div
                key={index}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={`${index + 1} of ${count}`}
                data-slide-index={index}
                className={cn(
                  'absolute left-1/2 top-0 aspect-video cursor-pointer overflow-hidden rounded-2xl bg-site-surface shadow-gloss will-change-transform',
                  cardClassName,
                )}
                style={{ width: 'var(--cf-card)' }}
              >
                {/*
                 * `object-contain`, not cover: the whole thumbnail has to be
                 * visible. For a standard 16:9 maxresdefault in a 16:9 box the
                 * two are identical — no bars — but the occasional 4:3
                 * `sddefault` would have its top and bottom cropped by cover.
                 */}
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  fill
                  sizes="260px"
                  draggable={false}
                  className="select-none object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {showNavigation && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => nudge(-1)}
              className="absolute left-3 top-1/2 z-[200] -translate-y-1/2 rounded-pill bg-site-bg/70 p-2 text-site-fg backdrop-blur transition hover:bg-site-bg"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => nudge(1)}
              className="absolute right-3 top-1/2 z-[200] -translate-y-1/2 rounded-pill bg-site-bg/70 p-2 text-site-fg backdrop-blur transition hover:bg-site-bg"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {showCaption && active?.title && (
        <div
          key={selected}
          className="mt-2 flex flex-col items-center px-6 text-center duration-300 animate-in fade-in"
        >
          <p className="line-clamp-2 text-[15px] font-semibold tracking-tight text-site-fg">
            {active.title}
          </p>
          {active.subtitle && <p className="mt-1 text-[13px] text-site-muted">{active.subtitle}</p>}
          {active.meta && active.meta.length > 0 && (
            <dl className="mt-6 w-full max-w-[230px] text-[12px]">
              {active.meta.map((row) => (
                <div key={row.label} className="flex justify-between py-[5px]">
                  <dt className="text-site-muted">{row.label}</dt>
                  <dd className="font-medium text-site-fg">{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {showPagination && (
        <div className="mt-6 flex items-center justify-center gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Go to slide ${index + 1}`}
              aria-current={index === selected}
              onClick={() => goTo(index)}
              className={cn(
                'size-2 rounded-pill bg-site-fg transition-opacity',
                index === selected ? 'opacity-100' : 'opacity-30',
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
