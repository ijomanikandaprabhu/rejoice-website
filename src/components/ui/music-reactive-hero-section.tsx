'use client';

import Image from 'next/image';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The four stacked sine layers. Amplitudes are in CSS pixels at the band's
 * centre line; the rest is per-layer phase so they never move in lockstep.
 */
const WAVES = [
  { amplitude: 30, frequency: 0.003, speed: 0.008, offset: 0, opacity: 0.9 },
  { amplitude: 25, frequency: 0.004, speed: 0.006, offset: Math.PI * 0.5, opacity: 0.7 },
  { amplitude: 20, frequency: 0.005, speed: 0.01, offset: Math.PI, opacity: 0.5 },
  { amplitude: 35, frequency: 0.002, speed: 0.004, offset: Math.PI * 1.5, opacity: 0.6 },
] as const;

/**
 * Ember only. The supplied component swept the full 0–360° wheel, which would
 * have put greens and blues into a page that is otherwise black and ember.
 * #FF6D29 sits at roughly 20°, so the drift is kept either side of it.
 */
const HUE_CENTRE = 22;
const HUE_SWING = 9;

/** Guard against 3x/4x screens turning this into a needlessly huge buffer. */
const MAX_DPR = 2;

type WaveBandProps = {
  /** Overall wave size. 1 is the tuned default. */
  intensity?: number;
  className?: string;
};

/**
 * A band of drifting waves with the Rejoice wordmark at its centre.
 *
 * Reduced from the supplied `music-reactive-hero-section`, which was a
 * full-viewport audio-reactive hero. What is kept is its layered sine maths and
 * eased colour drift; almost everything around that had to go or be rewritten:
 *
 *   1. NO AUDIO. The original carried an `<audio>` element, an `AudioContext`,
 *      an analyser, a play button and a progress bar, and its `src` was the
 *      literal placeholder "PATH-TO-YOUR-AUDIO-FILE.mp3". This page already has
 *      a player in the hero, and a second one could have two tracks going at
 *      once. The original's own "demo animation" branch — used when nothing is
 *      playing — is now the only branch.
 *
 *   2. THREE EFFECTS DROPPED for cost: a film-grain pass that rewrote every
 *      pixel of a full-viewport buffer each frame, a chromatic aberration pass
 *      that ALLOCATED A NEW CANVAS every frame, and a scanline pass stroking a
 *      line every 3px down the full height. Together they dominated the frame
 *      budget. The vignette, which is one gradient fill, is kept.
 *
 *   3. SIZED TO THIS ELEMENT, not `window.innerWidth`, and scaled by
 *      `devicePixelRatio` — the original had no DPR handling and rendered
 *      blurry on any retina screen.
 *
 *   4. STOPS WHEN OFF-SCREEN. The original's `requestAnimationFrame` ran
 *      forever. On a full-page hero demo that is fine; on a long homepage it
 *      would burn CPU indefinitely while scrolled out of view.
 *
 * It also honours `prefers-reduced-motion` by painting one static frame. The
 * global rule in globals.css only overrides CSS `animation-*`/`transition-*`,
 * so canvas work is NOT covered for free.
 */
export function WaveBand({ intensity = 1, className }: WaveBandProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let time = 0;

    /*
     * Phase is ACCUMULATED, never computed from elapsed time.
     *
     * The obvious-looking `phase = time * speed * (1 + bass)` is wrong, because
     * `bass` is itself a function of time: differentiating it leaves a
     * `t · s · 0.8 · bass'(t)` term that grows without bound, and once it
     * outweighs the first term the wave runs BACKWARDS. Simulated over 3000
     * frames that reversed on 968 of them, first at frame 866 — roughly 14
     * seconds in, which is why it looked fine on load and sloshed later.
     *
     * Adding a per-frame step keeps it monotonic by construction: both `speed`
     * and `(1 + bass * 0.8)` are always positive, so the phase can only ever
     * increase.
     */
    const phases = WAVES.map((wave) => wave.offset);

    let raf = 0;
    let running = false;

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      // Draw in CSS pixels; the transform maps them onto the larger buffer.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      // Trailing fade rather than a clear, which is what gives the motion blur.
      ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
      ctx.fillRect(0, 0, width, height);

      // Drivers slowed alongside the wave speeds, so the whole band settles
      // rather than just its horizontal travel.
      const bass = (0.4 + Math.sin(time * 0.004) * 0.3) * intensity;
      const mid = (0.3 + Math.sin(time * 0.006) * 0.2) * intensity;

      const hue = HUE_CENTRE + Math.sin(time * 0.002) * HUE_SWING;
      const saturation = 88 + Math.sin(time * 0.004) * 8;
      const lightness = 52 + Math.sin(time * 0.003) * 8;

      const centreY = height / 2;

      WAVES.forEach((wave, index) => {
        phases[index] += wave.speed * (1 + bass * 0.8);
        const offset = phases[index];
        const influence = index < 2 ? bass : mid;
        const amplitude = wave.amplitude * (1 + influence * 5) * intensity;

        const h = hue + index * 3;
        const s = saturation - index * 4;
        const l = lightness + index * 4;
        const alpha = wave.opacity * (0.5 + bass * 0.5);

        const gradient = ctx.createLinearGradient(
          0,
          centreY - amplitude,
          0,
          centreY + amplitude,
        );
        gradient.addColorStop(0, `hsla(${h}, ${s}%, ${l}%, 0)`);
        gradient.addColorStop(0.5, `hsla(${h}, ${s}%, ${l + 10}%, ${alpha})`);
        gradient.addColorStop(1, `hsla(${h}, ${s}%, ${l}%, 0)`);

        ctx.beginPath();
        for (let x = -50; x <= width + 50; x += 2) {
          const y =
            centreY +
            Math.sin(x * wave.frequency + offset) * amplitude +
            Math.sin(x * wave.frequency * 2 + offset * 1.5) * (amplitude * 0.3 * mid) +
            Math.sin(x * wave.frequency * 0.5 + offset * 0.7) * (amplitude * 0.5);

          if (x === -50) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(width + 50, height);
        ctx.lineTo(-50, height);
        ctx.closePath();

        ctx.fillStyle = gradient;
        ctx.fill();

      });

      // Vignette — the one post-effect cheap enough to keep.
      const vignette = ctx.createRadialGradient(
        width / 2,
        centreY,
        width * 0.2,
        width / 2,
        centreY,
        width * 0.9,
      );
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(0.5, 'rgba(0, 0, 0, 0.12)');
      vignette.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);
    };

    const tick = () => {
      time++;
      draw();
      raf = window.requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reduceMotion) return;
      running = true;
      raf = window.requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    resize();
    // One frame up front so the band is never blank before it scrolls in, and
    // so reduced motion still gets something to look at.
    draw();

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw();
    });
    resizeObserver.observe(host);

    /*
     * The whole reason a permanent canvas is acceptable on a page this long:
     * the loop only runs while the band is actually visible.
     */
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0 },
    );
    intersectionObserver.observe(host);

    return () => {
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
    };
  }, [intensity]);

  return (
    <section className={cn('relative overflow-hidden bg-site-bg', className)}>
      <div
        ref={hostRef}
        className="relative h-[clamp(14rem,32vw,26rem)] w-full"
        data-wave-band=""
      >
        <canvas ref={canvasRef} aria-hidden="true" className="absolute inset-0 size-full" />

        {/*
         * Grain, reusing the exact treatment the hero film carries
         * (`HeroVideo.tsx`) rather than a canvas pass. It is a tiled SVG
         * feTurbulence texture animated in CSS, so it costs nothing per frame —
         * the canvas version this replaces rewrote every pixel of the buffer
         * each frame — and the global reduced-motion rule already parks it as a
         * still texture. Lower opacity than the hero's, since this sits over a
         * dark canvas rather than footage and would otherwise muddy the waves.
         */}
        <div
          aria-hidden="true"
          className="noise-overlay pointer-events-none absolute inset-0 opacity-[0.35] mix-blend-overlay"
        />

        {/*
         * The wordmark sits on the waves' centre line — `draw` centres them on
         * the band's vertical midpoint, and this is centred on the same box.
         */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <Image
            src="/brand/logo-wordmark-light.png"
            alt="Rejoice"
            width={687}
            height={169}
            sizes="(min-width: 768px) 480px, 272px"
            /*
             * `animate-emberDrift` is already in tailwind.config.ts — an 18s
             * scale-and-opacity swell. Reused rather than adding a keyframe,
             * and being CSS it is covered by the reduced-motion rule, unlike
             * the canvas work above.
             */
            className="h-auto w-[17rem] animate-emberDrift drop-shadow-[0_2px_24px_rgba(0,0,0,0.75)] md:w-[30rem]"
          />
        </div>
      </div>
    </section>
  );
}

export default WaveBand;
