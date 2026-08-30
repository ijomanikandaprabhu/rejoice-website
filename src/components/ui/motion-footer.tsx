'use client';

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Mail, Phone } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { SocialButtons } from '@/components/site/SocialButtons';
import { appConfig, publicNav } from '@/config/app.config';
import type { ContactDetails } from '@/features/content/queries';
import { cn } from '@/lib/utils';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * What rides the marquee when there are no channels to name — a fresh install,
 * or every channel switched off. Better than an empty bordered bar.
 */
const MARQUEE_WORDS = [
  'Gospel music',
  'Studio recording',
  'Mixing & mastering',
  'Music videos',
  'Live worship',
  'Post-production',
];

/**
 * The marquee scrolls two identical runs and animates `translateX(0 -> -50%)`,
 * so ONE run has to be at least as wide as the bar or a gap opens up as it
 * moves. Two channel names measure ~873px against a 2113px bar at 1920 — less
 * than half of it.
 *
 * Repeating to eight entries covers a 1920 bar with room to spare. Eight is
 * also what the fallback list roughly matched, so the strip keeps its density
 * whichever source is feeding it, and a site with eight or more channels
 * repeats nothing.
 */
const MIN_MARQUEE_ENTRIES = 8;

function fillMarquee(words: string[]): string[] {
  if (words.length === 0) return MARQUEE_WORDS;

  const filled = [...words];
  while (filled.length < MIN_MARQUEE_ENTRIES) filled.push(...words);
  return filled;
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

type MagneticProps = {
  as?: 'a' | 'button' | 'span';
  className?: string;
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  target?: string;
  rel?: string;
  'aria-label'?: string;
};

/**
 * A control that leans toward the pointer and springs back.
 *
 * Two changes from the supplied version: it bails out under
 * `prefers-reduced-motion` and on touch (where `mousemove` never fires anyway),
 * and the tilt needs `perspective` on an ancestor — the original animated
 * `rotationX`/`rotationY` with none set, so the 3D read as flat.
 */
function Magnetic({ as: Tag = 'button', className, children, ...rest }: MagneticProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    if (window.matchMedia('(hover: none)').matches) return;

    const ctx = gsap.context(() => {
      const onMove = (event: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        gsap.to(el, {
          x: x * 0.3,
          y: y * 0.3,
          rotationX: -y * 0.12,
          rotationY: x * 0.12,
          scale: 1.04,
          ease: 'power2.out',
          duration: 0.4,
        });
      };

      const onLeave = () => {
        gsap.to(el, {
          x: 0,
          y: 0,
          rotationX: 0,
          rotationY: 0,
          scale: 1,
          ease: 'elastic.out(1, 0.3)',
          duration: 1.2,
        });
      };

      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', onLeave);
      return () => {
        el.removeEventListener('mousemove', onMove);
        el.removeEventListener('mouseleave', onLeave);
      };
    }, el);

    return () => ctx.revert();
  }, []);

  return React.createElement(
    Tag,
    {
      ref: ref as React.Ref<never>,
      className: cn('cursor-pointer [transform-style:preserve-3d]', className),
      ...rest,
    },
    children,
  );
}

function MarqueeRun({ words }: { words: string[] }) {
  return (
    <div className="flex shrink-0 items-center gap-10 px-5">
      {/* Keyed by position, not by the word: `fillMarquee` repeats the list to
          reach a usable width, so the same name legitimately appears more than
          once and a name key would collide. */}
      {words.map((word, index) => (
        <span key={`${word}-${index}`} className="flex items-center gap-10 whitespace-nowrap">
          {word}
          <span className="text-site-accent/70">✦</span>
        </span>
      ))}
    </div>
  );
}

/**
 * Full-height curtain footer.
 *
 * The wrapper sits in normal flow and carries a `clip-path`, which makes it a
 * containing block for the `fixed` footer inside — so the footer is pinned to
 * the viewport but only ever painted where the wrapper is. Scrolling the
 * wrapper into view therefore draws the page upward off a stationary footer.
 *
 * Adapted from the supplied `motion-footer`. The substantive changes:
 *
 *   1. All colour rewritten onto the public palette. The original coloured
 *      every surface with `color-mix(in oklch, var(--foreground) …)`; this
 *      project stores shadcn tokens as HSL triplets, so those expressions are
 *      invalid CSS and every pill, the grid and the glow would have rendered
 *      invisible. Its tokens are also the admin (lime) palette. See the
 *      "Cinematic footer" block in globals.css.
 *
 *   2. Its injected `<style>` tag is gone, along with the `@import` of Plus
 *      Jakarta Sans — a render-blocking Google Fonts request on every page, for
 *      a typeface this site does not use. The site's Inter Tight is inherited.
 *
 *   3. Content is Rejoice's, and it keeps everything the old footer carried:
 *      nav links, email, phone, address and socials. The contact details are
 *      administrator-editable and appear nowhere else outside /contact.
 *
 *   4. Honours `prefers-reduced-motion`. GSAP animates from JS, so the global
 *      CSS rule in globals.css does not cover it. Note the direction: the
 *      hidden start state is applied BY GSAP, never in the markup, so if the
 *      effect never runs — reduced motion, a GSAP failure, no JS — the footer
 *      renders complete and visible rather than blank.
 */
export function CinematicFooter({
  contact,
  siteName,
  marqueeWords = [],
}: {
  contact: ContactDetails;
  siteName: string;
  /** Names for the diagonal marquee — the live channels. Falls back to the
      service words when empty. */
  marqueeWords?: string[];
}) {
  const marquee = fillMarquee(marqueeWords);
  const wrapperRef = React.useRef<HTMLDivElement | null>(null);
  const logoRef = React.useRef<HTMLImageElement | null>(null);
  const headingRef = React.useRef<HTMLHeadingElement | null>(null);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const giantRef = React.useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  /*
   * The reveal PLAYS ONCE rather than riding a scrub.
   *
   * A scrubbed reveal makes opacity a function of two pixel positions measured
   * on mount — and this footer lives in the layout, so it mounts once and
   * survives every navigation while those measurements go stale. That is the
   * fault reported as "footer no working properly": curtain open, middle of the
   * footer blank. Played once and then cleared, a stale measurement can only
   * delay the reveal, never cancel it.
   */
  React.useEffect(() => {
    if (!wrapperRef.current || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        giantRef.current,
        { yPercent: 20 },
        {
          yPercent: 0,
          ease: 'none',
          scrollTrigger: {
            trigger: wrapperRef.current,
            start: 'top 80%',
            end: 'bottom bottom',
            scrub: 1,
            invalidateOnRefresh: true,
          },
        },
      );

      // Logo first: it sits above the heading, so it should lead the stagger
      // rather than rise after the text it introduces.
      const targets = [logoRef.current, headingRef.current, bodyRef.current];

      gsap.fromTo(
        targets,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.9,
          stagger: 0.15,
          ease: 'power3.out',
          // Let go once played, so a later refresh cannot re-seed the hidden
          // start state onto a finished tween.
          onComplete: () => gsap.set(targets, { clearProps: 'opacity,transform' }),
          scrollTrigger: { trigger: wrapperRef.current, start: 'top 85%', once: true },
        },
      );
    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  /*
   * Re-measure when the document changes shape: a client-side navigation swaps
   * the page under this footer, and images settling change the height again.
   */
  React.useEffect(() => {
    if (prefersReducedMotion()) return;

    const frame = requestAnimationFrame(() => ScrollTrigger.refresh());
    const observer = new ResizeObserver(() => ScrollTrigger.refresh());
    observer.observe(document.body);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname]);

  const year = new Date().getFullYear();
  const name = siteName || appConfig.name;

  return (
    /*
     * The footer scrolls with the page.
     *
     * It used to be a curtain: `position: fixed` inside a `clip-path` wrapper,
     * so the page slid up and off it while it stayed pinned. That is gone —
     * this is now an ordinary block at the end of the document.
     *
     * The full viewport HEIGHT stays, and it is load-bearing: `h-screen` with
     * `justify-between` is what spreads the marquee, the middle block and the
     * bottom bar apart, and the marquee and the giant wordmark are positioned
     * against that box.
     *
     * `shrink-0` matters: the public layout is `flex min-h-screen flex-col`
     * with `main flex-1`, and without it flex would compress the footer on a
     * short page.
     */
    <div ref={wrapperRef} className="relative h-screen w-full shrink-0">
      {/*
       * Full viewport, but as a MINIMUM rather than a fixed `h-screen`.
       *
       * On a phone the nav and contact pills wrap onto many more rows and the
       * content reaches ~930px against an 812px viewport. A locked height
       * would clip that under this element's own `overflow-hidden`. A minimum
       * gives the full-bleed panel on desktop and still lets the footer grow.
       */}
      <footer className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-site-bg text-site-fg [perspective:1000px]">

        {/*
         * Aurora. The scale animation lives on the INNER element: the original
         * animated `transform: translate(-50%,-50%) scale(…)` on the same node
         * that Tailwind was centring with translate utilities, so the animation
         * overwrote the centring and threw the glow off-centre.
         */}
        <div className="footer-bg-grid pointer-events-none absolute inset-0 z-0" />


        <div
          ref={giantRef}
          aria-hidden="true"
          /*
           * Sized by width AND capped by height.
           *
           * `26vw` alone scales off the viewport's WIDTH, but the room it has
           * is the footer's HEIGHT — so a wide, short window grew it far past
           * what fits and it climbed into the contact pills: 520px of type in a
           * 700px footer at 2000x700, overlapping by 252px.
           *
           * The cap was measured rather than guessed, sweeping candidates over
           * eight aspect ratios. 28vh still overlapped by 9px at the worst one
           * and 26vh cleared by only 2px; 24vh is the largest value that keeps
           * a real margin everywhere (12px at its tightest, 2000x700).
           */
          className="footer-giant-text pointer-events-none absolute bottom-0 left-1/2 z-0 -translate-x-1/2 select-none whitespace-nowrap text-[min(26vw,24vh)] font-black"
        >
          REJOICE
        </div>

        {/*
         * Diagonal marquee.
         *
         * `top-28`, not the original's `top-12`: the site header is sticky at
         * 73px tall and sits above this fixed footer, so anything higher than
         * that is painted behind the header once the curtain is fully open.
         */}
        <div className="absolute top-28 z-10 w-full -rotate-2 scale-110 border-y border-white/10 bg-site-bg/60 py-4 backdrop-blur-md">
          <div className="flex w-max animate-marquee text-xs font-bold uppercase tracking-[0.3em] text-site-muted md:text-sm">
            <MarqueeRun words={marquee} />
            <MarqueeRun words={marquee} />
          </div>
        </div>

        {/*
         * The top margin has to clear the ROTATED marquee above, which is
         * absolutely positioned and so contributes no height of its own. It
         * ends around 196px on desktop (`top-28` plus `scale-110` and the
         * rotation); `mt-24` only cleared it while the footer was `h-screen`
         * and this centred column started far below. At the current height
         * that overlapped the heading, so the clearance is now explicit.
         */}
        <div className="relative z-10 mx-auto mt-56 flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 pb-6">
          {/*
           * Centred on the CONTENT, not on the footer.
           *
           * It used to be a footer child at `top-1/2`, which centres on the
           * footer — but this column starts 224px down (clearing the marquee)
           * and stops at the bottom bar, so its middle sits lower by
           * `(224 - barHeight) / 2`. That is 68px on desktop, 34 at 768 and 51
           * at 375, because the bar stacks: a fixed nudge would only ever be
           * right at one width. Living inside the column, it centres by
           * construction at all of them.
           */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[60vh] w-[80vw] -translate-x-1/2 -translate-y-1/2">
            <div className="size-full animate-emberDrift rounded-[50%] bg-[radial-gradient(circle_at_50%_50%,rgba(255,109,41,0.22)_0%,rgba(69,48,39,0.18)_40%,transparent_70%)] blur-[80px]" />
          </div>

          {/* Above the heading it introduces, not stranded in the bottom bar.
              It is one of the GSAP targets, and first in the stagger, so it
              leads the reveal rather than sitting still while the text rises. */}
          <Image
            ref={logoRef}
            src="/brand/logo-wordmark-light.png"
            alt={name}
            width={687}
            height={169}
            className="mb-10 h-7 w-auto opacity-80 md:mb-12 md:h-8"
          />

          <h2
            ref={headingRef}
            className="footer-text-glow mb-10 px-2 text-center text-4xl font-black tracking-tighter md:text-7xl"
          >
            Faith Comes Alive Here
          </h2>

          <div ref={bodyRef} className="flex w-full flex-col items-center gap-5">
            <nav aria-label="Footer" className="flex flex-wrap justify-center gap-3">
              {publicNav.map((item) => (
                <Magnetic
                  key={item.href}
                  as="span"
                  className="footer-glass-pill inline-block rounded-pill px-7 py-3.5 text-sm font-bold text-site-fg md:text-base"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Magnetic>
              ))}
            </nav>

            <div className="flex flex-wrap justify-center gap-3">
              {contact.email ? (
                <Magnetic
                  as="a"
                  href={`mailto:${contact.email}`}
                  className="footer-glass-pill inline-flex items-center gap-2 rounded-pill px-6 py-3 text-xs font-medium text-site-muted [overflow-wrap:anywhere] hover:text-site-fg md:text-sm"
                >
                  {/* Decorative: the address beside it already says what it is. */}
                  <Mail aria-hidden="true" className="size-4 shrink-0" />
                  {contact.email}
                </Magnetic>
              ) : null}
              {contact.phone ? (
                <Magnetic
                  as="a"
                  href={`tel:${contact.phone.replace(/\s/g, '')}`}
                  className="footer-glass-pill inline-flex items-center gap-2 rounded-pill px-6 py-3 text-xs font-medium tabular-nums text-site-muted hover:text-site-fg md:text-sm"
                >
                  <Phone aria-hidden="true" className="size-4 shrink-0" />
                  {contact.phone}
                </Magnetic>
              ) : null}
            </div>

          </div>
        </div>


        {/*
         * A three-column grid on desktop, not `justify-between`.
         *
         * The back-to-top button that used to occupy the third slot is now
         * fixed to the viewport (see `BackToTop`), and with only two items
         * left `justify-between` would push the copyright to the right edge.
         * The empty third cell keeps it centred on the bar, where it was.
         */}
        <div className="relative z-20 flex w-full flex-col items-center gap-5 px-6 pb-8 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:px-12">
          {/*
           * The accounts sit where the wordmark used to, which moved up to lead
           * the heading. The wrapper carries the flex ordering because
           * `SocialButtons` takes no `className` — widening a shared component's
           * API for one caller is not worth it.
           */}
          <div className="order-2 md:order-1 md:justify-self-start">
            {contact.socials.length > 0 ? (
              <SocialButtons
                links={contact.socials.map((social) => ({
                  id: social.id,
                  label: social.label,
                  url: social.href,
                  svg: social.icon ?? '',
                }))}
              />
            ) : null}
          </div>

          <p className="order-1 text-center text-[10px] font-semibold uppercase tracking-widest text-site-muted md:order-2 md:text-xs">
            ©{' '}{year}{' '}
            {/*
              A different origin, so it opens in a new tab like every other
              external destination on the site.

              This opened in place before, on the reasoning that the domain is
              Rejoice's own. That is the wrong test: what matters is whether the
              visitor leaves the page they are on, and from here they do.
            */}
            <a
              href="https://rejoicegospelcommunications.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-site-fg"
            >
              {name}
            </a>{' '}
            · Designed and developed by{' '}
            {/* A third party, so this one opens in a new tab. */}
            <a
              href="https://ijocreations.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-site-accent transition-colors hover:text-site-accentSoft"
            >
              IJO Creations
            </a>
          </p>

          {/* Empty third cell: balances the grid so the copyright sits centred.
              `md:order-3` is load-bearing — its siblings carry explicit orders,
              so without one this defaults to 0 and takes the FIRST column,
              pushing the copyright into the third. */}
          <span aria-hidden="true" className="hidden md:order-3 md:block" />
        </div>
      </footer>
    </div>
  );
}

export default CinematicFooter;
