import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The closing panel a page ends on.
 *
 * Built to a supplied spec — rounded container, three stacked background layers
 * (radial glow, masked square grid, vignette), then centred content: glass
 * mark, two-line heading, subtext, gradient pill with a trailing arrow.
 *
 * The spec was written in VIOLET (`#0d0715` ground, `#7c3aed` glow,
 * violet→indigo button). This site is black with an ember accent, and this
 * panel appears on five pages, so it is built to the same recipe in ember: the
 * ground below is to `site.accent` what `#0d0715` is to violet.
 */
export function CtaPanel({
  heading,
  text,
  paragraphs,
  accentLine,
  ctaLabel,
  ctaHref,
  className,
}: {
  /** A `\n` splits the heading into two deliberate lines. */
  heading: string;
  /** Optional: Contact supplies `paragraphs` instead, having two of them. */
  text?: string;
  /**
   * An alternative to `text` for a panel whose copy runs to more than one
   * paragraph. Drawn in the SAME type as `text` rather than the page's body
   * style, so the panel still reads as one of this set.
   */
  paragraphs?: readonly string[];
  /** An ember sign-off under the copy. Contact is the only page with one. */
  accentLine?: string;
  /**
   * The button is optional, and both halves are required together. Contact
   * omits it: with the enquiry form directly above, that panel is a closing
   * statement rather than a call to action.
   */
  ctaLabel?: string;
  ctaHref?: string;
  className?: string;
}) {
  // An empty heading hides the panel, so a page can opt out from config alone.
  if (!heading) return null;

  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-[20px] border border-white/[0.08]',
        // 96px vertical padding at desktop, stepped down on a phone where the
        // panel is only 335px wide.
        'bg-[#0D0708] px-6 py-16 text-center sm:py-24',
        className,
      )}
    >
      <PanelBackdrop />

      <div className="relative z-10 mx-auto flex flex-col items-center">
        {/* The bare wordmark. The spec put it inside a glass square; the plain
            mark is what the site had, and what was asked for back. */}
        <Image
          src="/brand/logo-wordmark-light.png"
          alt=""
          width={687}
          height={169}
          className="h-5 w-auto opacity-70"
        />

        <h2 className="mt-7 whitespace-pre-line text-[2rem] font-normal leading-[1.12] tracking-[-0.02em] text-white sm:text-[3rem]">
          {heading}
        </h2>

        {/*
         * 15px at 60% white, not the spec's 55%: at this size 55% on this
         * ground measures below AA, and the difference is invisible next to
         * being readable.
         */}
        {text ? (
          <p className="mt-5 max-w-[480px] text-[0.9375rem] leading-[1.6] text-white/60">{text}</p>
        ) : null}

        {paragraphs?.map((paragraph) => (
          <p
            key={paragraph}
            className="mt-5 max-w-[480px] text-[0.9375rem] leading-[1.6] text-white/60"
          >
            {paragraph}
          </p>
        ))}

        {accentLine ? (
          <p className="mt-6 text-[1.0625rem] font-medium text-site-accent">{accentLine}</p>
        ) : null}

        {/*
          `btn-primary`, not a bespoke gradient: the shared class is what every
          other primary button on the site uses, so this one matches them and
          follows if that class ever changes.

          Guarded on BOTH halves — a panel given a label but no href would
          otherwise render a button leading nowhere.
        */}
        {ctaLabel && ctaHref ? (
          <Link href={ctaHref} className="btn-primary group mt-9 px-7">
            {ctaLabel}
            {/* The arrow is what makes this read as a call to action rather
                than a link; it steps forward on hover. */}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The panel's three background layers, bottom to top: glow, grid, vignette.
 *
 * The grid is drawn from a background-image at a fixed CELL SIZE rather than a
 * fixed number of cells. That distinction is the whole point — the previous
 * version divided the panel into 16 × 8, so on a tall narrow phone panel the
 * cells stretched to 21 × 65px and the texture read as vertical banding. A
 * fixed size stays square at every width.
 */
function PanelBackdrop() {
  return (
    <>
      {/* 1. Ember glow, anchored top-centre, gone by 70%. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 0%, rgba(255,109,41,0.45) 0%, rgba(255,109,41,0.12) 38%, transparent 70%)',
        }}
      />

      {/*
       * 2. Square grid — 48px cells on a phone, 72px from `sm` up.
       *
       * The mask's ellipse is 50% of the width, NOT the spec's 80%. A radial
       * gradient's percentages are its ending-shape radii, so an 80% ellipse is
       * still at ~58% alpha where the panel's left and right edges fall — the
       * grid would run into the border, which the spec explicitly forbids. At
       * 50% the horizontal edge sits exactly on the transparent stop, so the
       * grid is guaranteed to be gone before it gets there.
       */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-0 z-0',
          '[background-size:48px_48px] sm:[background-size:72px_72px]',
        )}
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)',
          maskImage: 'radial-gradient(ellipse 50% 62% at 50% 20%, #000 28%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 50% 62% at 50% 20%, #000 28%, transparent 100%)',
        }}
      />

      {/* 3. Vignette, darkening the corners toward black. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 50% 35%, transparent 40%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.85) 100%)',
        }}
      />
    </>
  );
}

/**
 * A faint square grid, masked so it fades out rather than ending on a hard
 * edge.
 *
 * Used by the Services artwork panels. The CTA has its own layered backdrop
 * above: lines sit better behind the isometric drawings, where a glow and a
 * vignette would fight them.
 */
export function GridBackdrop({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 28px)',
        maskImage: 'radial-gradient(120% 100% at 50% 45%, #000 45%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(120% 100% at 50% 45%, #000 45%, transparent 100%)',
      }}
    />
  );
}

export default CtaPanel;
