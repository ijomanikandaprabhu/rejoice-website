'use client';

import { useEffect, useRef } from 'react';

/**
 * The homepage hero film, as a full-bleed backdrop for the sign-in screen.
 *
 * ## Why not reuse `site/HeroVideo`
 *
 * Same clip, same structure — a container at the clip's own ratio, so nothing
 * crops and nothing letterboxes — but a different job. `HeroVideo` is a framed
 * element in a column of text, top-aligned, feathering its BOTTOM edge into a
 * pure-black page. Here the clip is the ground under a form, bottom-aligned,
 * feathering its TOP edge into `site-night`. Same technique, mirrored.
 *
 * Decorative only: muted, `aria-hidden`, not focusable, so the tab order goes
 * straight to the email field.
 *
 * Honours `prefers-reduced-motion` the same way `HeroVideo` does — it holds on
 * the first frame rather than disappearing, so the screen keeps its composition
 * either way.
 */
export function LoginBackdrop() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const apply = () => {
      if (motion.matches) {
        video.pause();
      } else {
        // Autoplay can still be refused (low power mode, data saver). The frozen
        // first frame is an acceptable fallback, so swallow it.
        void video.play().catch(() => {});
      }
    };

    apply();
    motion.addEventListener('change', apply);
    return () => motion.removeEventListener('change', apply);
  }, []);

  return (
    /*
     * `z-0`, NOT a negative z-index.
     *
     * This shipped as `-z-10` and the film was invisible — the page rendered as
     * flat #0B0B0C. The admin layout wraps everything in `.admin-theme`, which
     * applies an OPAQUE `bg-panel-bg`, and that element creates no stacking
     * context of its own (no transform, opacity or positioned z-index). So a
     * negative-z child escapes to the root stacking context and paints BEHIND
     * that background colour rather than in front of it.
     *
     * At z-0 the video paints above the wrapper's background, and the form sits
     * above the video on `relative z-10`.
     */
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 select-none bg-site-night">
      {/*
       * The clip gets a container at its OWN ratio, anchored to the top — this
       * is `site/HeroVideo`'s structure, and the reason the homepage has no bars.
       *
       * Two earlier attempts both stretched the clip to the viewport and asked
       * `object-fit` to resolve the mismatch. `cover` answered by cropping the
       * seated figures off both edges; `contain` answered by letterboxing. The
       * question was wrong: a 16:9 clip in a viewport-shaped box has to lose
       * something. At `aspect-video w-full` there is no mismatch to resolve, so
       * `contain` and `cover` would be identical and neither crops nor bars.
       *
       * Full bleed horizontally, natural height, anchored to the BOTTOM.
       *
       * Bottom rather than top, because of what is where in the frame. A 16:9
       * clip cannot fill a taller window, so some of the screen is always flat
       * colour — 40% of a 1260-tall window and 73% of a phone, when this was
       * top-anchored and the flat part sat underneath.
       *
       * The TOP of the frame is uniform night sky: measured `rgb(5, 28, 44)`
       * with a spread of 33. `site-night` is `#041A29` = `rgb(4, 26, 41)`, and
       * its token comment already reads "Deep navy matching the hero clip's
       * night sky". Within three points per channel.
       *
       * So the flat part is moved ABOVE the clip, where it is indistinguishable
       * from the sky it continues. The campfire and grass — the half that could
       * never be faked — sit on the floor of the screen where they belong. No
       * pixel is cropped either way.
       */}
      <div className="absolute inset-x-0 bottom-0 aspect-video w-full overflow-hidden">
        <video
          ref={ref}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          tabIndex={-1}
          className="absolute inset-0 h-full w-full object-contain"
        >
          <source src="/media/rejoice-hero.mp4" type="video/mp4" />
        </video>

        {/*
         * The clip's TOP edge dissolves into the sky above it — the bottom edge
         * meets the floor of the viewport and has nothing to hide.
         *
         * `.fade-from-night-top` is the hero's own class and already ramps from
         * `rgba(4, 26, 41, 1)`, which is `site-night` exactly. The same join,
         * reused rather than rewritten.
         */}
        <div className="fade-from-night-top absolute inset-x-0 top-0 h-[22%]" />
      </div>

      {/*
       * Contrast ramp — over EVERYTHING, sky included, not just the clip.
       *
       * This sat inside the clip's container and produced a visible band. The
       * sky above the clip and the clip's own sky are near-identical grounds —
       * `site-night` is `rgb(4, 26, 41)`, the footage's sky `rgb(5, 28, 44)` —
       * so painting 45% black over one and nothing over the other is precisely
       * what makes the join show. Measured at 1343×1260, the clip's sky sat
       * about 8 points lower in blue and read as a dark stripe.
       *
       * Spanning the viewport, the same value applies at any given y whatever is
       * beneath it, so the two grounds cannot diverge at the join. It is a
       * relocation, not a removal: the form does overlap the clip at 1440×900
       * and 375×780, and needs this to stay legible there.
       *
       * The clip is a NIGHT SHOT — 30 to 44 out of 255 before anything is
       * painted over it, with only the fire bright and only low-centre. So this
       * stays light through the top two thirds, where the form is, and does its
       * work at the foot.
       */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/70 sm:from-black/30 sm:via-black/15 sm:to-black/65" />
    </div>
  );
}

export default LoginBackdrop;
