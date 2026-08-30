'use client';

import { useEffect, useRef } from 'react';

/**
 * Looping background film for the homepage hero.
 *
 * Decorative only — muted, `aria-hidden`, and not focusable, so screen readers
 * and keyboard users never land on it. The scrim layers above it keep the hero
 * copy at full contrast against whatever frame happens to be on screen, and the
 * bottom fade blends the film into the page instead of hard-cutting.
 *
 * Honours `prefers-reduced-motion`: the video holds on its first frame rather
 * than disappearing, so the hero keeps its composition either way.
 */
export function HeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      if (motion.matches) {
        video.pause();
      } else {
        // Autoplay can still be refused (low power mode, data saver). The
        // frozen first frame is an acceptable fallback, so swallow it.
        void video.play().catch(() => {});
      }
    };

    apply();
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, []);

  return (
    /*
     * Sized by its own 16:9 ratio rather than stretched to fill a parent, so
     * the section is exactly as tall as the film needs at any width — no dead
     * black space above or below it to pad out a viewport-height box.
     */
    /*
     * `select-none` is load-bearing, not tidiness. This block sits inside the
     * hero section's text flow, so a drag across the hero (or ctrl+A) pulled
     * it into the selection range — and because the site paints `::selection`
     * in the orange accent, the browser filled the whole film with orange.
     * The clip is decorative and `aria-hidden`, so it has no business being
     * selectable; excluding it means a drag selects the headline and nothing
     * else. `isolate` keeps the grain's `mix-blend-mode` compositing against
     * the footage rather than whatever the section happens to paint.
     */
    <div
      aria-hidden="true"
      className="pointer-events-none relative isolate aspect-video w-full select-none overflow-hidden"
    >
      <video
        ref={ref}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        tabIndex={-1}
        /*
         * `contain`, not `cover`: the whole frame stays on screen rather than
         * being cropped to fill. Against the 16:9 wrapper above this is
         * currently a no-op, but it means swapping in a clip of any other
         * ratio still shows the film whole instead of silently cropping it.
         */
        className="absolute inset-0 h-full w-full object-contain"
      >
        <source src="/media/rejoice-hero.mp4" type="video/mp4" />
      </video>

      {/*
       * Film grain. Sits above the picture but below the edge ramps below, so
       * the ramps dissolve the grain and the footage together — grain carrying
       * on over the faded-out edges would read as noise on the page, not as
       * texture on the film.
       *
       * `overlay` blending keeps the blacks black and lets the grain show in
       * the midtones, which is where it belongs on a night shot.
       */}
      <div className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.85] mix-blend-overlay" />

      {/*
       * Edge feather. The clip is a hard-edged rectangle, and against a pure
       * black page those four boundaries read as visible seams. Each edge gets
       * a black-to-transparent ramp so the frame dissolves into the background
       * instead of stopping at a line.
       *
       * This only works because the page background is exactly #000000 — the
       * ramps are the background colour, so they read as the film fading out
       * rather than as a dark wash laid over it. If `site.bg` ever moves off
       * black these have to move with it.
       *
       * Only the top and bottom are ramped. The film is full-bleed, so its
       * left and right edges sit against the viewport boundary with no page
       * behind them — ramping those would just vignette away the outermost
       * seated figures without dissolving any seam.
       *
       * The bottom ramp always applies — that edge always meets the page.
       *
       * The top ramp only exists below `md`, the one case where the headline
       * stacks above the film and its top edge genuinely borders black. From
       * `md` up the hero is pulled under the header and the film runs clean
       * off the top of the viewport, leaving no seam to hide — and the frame
       * there measures ~26/255 luma, dark enough to carry the nav unaided.
       * Keeping a ramp there only painted a dark band across the sky.
       *
       * The top overlay is the clip's own night-sky navy at every width, so it
       * deepens the sky rather than laying a dark band over it.
       *
       * It does slightly different work per breakpoint. From `md` up the film
       * runs off the top of the viewport with no edge to hide, so it is purely
       * a tint behind the nav. Below `md` the headline stacks above and the
       * top edge is real — so the hero section paints the same navy behind
       * that headline, and this ramp merges into it. Both halves have to stay
       * the same colour or the seam comes straight back; see the hero section
       * in `page.tsx`. It runs taller there because a short fade has to fall
       * off steeply, and a steep fade is visible however well eased.
       */}
      <div className="fade-from-night-top absolute inset-x-0 top-0 h-[30%] lg:h-[24%]" />
      <div className="fade-to-bg-bottom absolute inset-x-0 bottom-0 h-[26%]" />

      {/*
       * Deliberately no `bg-ember` wash here. The house ember is anchored to
       * the top-right corner, and over this clip it landed as an orange haze
       * in the empty night sky with no light source to justify it. The fire in
       * frame is the warm light on this page.
       */}
    </div>
  );
}
