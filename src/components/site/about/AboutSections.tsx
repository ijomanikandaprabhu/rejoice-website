import Image from 'next/image';

import { IsoAiAudioCity } from '@/components/site/iso/IsoAiAudioCity';
import { IsoAiVideoCity } from '@/components/site/iso/IsoAiVideoCity';
import { IsoAudioCity } from '@/components/site/iso/IsoAudioCity';
import { IsoVideoCity } from '@/components/site/iso/IsoVideoCity';
import { PageHero } from '@/components/site/PageHero';
import { DotPattern } from '@/components/ui/dot-pattern-1';
import { LoopingWords } from '@/components/ui/looping-words';
import { Reveal } from '@/components/ui/reveal';
import { TypedText } from '@/components/ui/typed-text';
import { aboutPage } from '@/config/content.config';
import { cn } from '@/lib/utils';

/**
 * The About page's sections.
 *
 * Each has a different shape on purpose: eleven identical blocks of this much
 * prose would read as a wall. What stays constant is the spine — one column of
 * type on black, hairlines between chapters, ember used sparingly.
 *
 * All wording comes from `aboutPage` verbatim. An earlier pass paraphrased the
 * copy and quietly dropped most of it, which is why nothing here rewrites,
 * shortens or merges a sentence.
 */

/* ------------------------------------------------------------------ hero */

export function AboutHero() {
  // Explicit props rather than a spread: `aboutPage.hero` still carries an
  // `eyebrow`, and this hero deliberately leads with the badge alone.
  const { badge, heading, paragraphs, media } = aboutPage.hero;

  return <PageHero badge={badge} heading={heading} paragraphs={paragraphs} media={media} />;
}

/* ----------------------------------------------------------------- story */

export function AboutStory() {
  const { eyebrow, heading, paragraphs, closing } = aboutPage.story;

  return (
    /*
     * No top rule on this one, unlike every other chapter below it. The hero
     * already ends by fading its glow into the page background, so a hairline
     * straight after it reads as a stray line under the hero rather than as
     * the divider between two chapters.
     */
    <section className="container-page py-20 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <p className="t-label">{eyebrow}</p>
          <h2 className="t-h2 mt-4">{heading}</h2>
        </div>

        <div className="min-w-0 lg:col-span-8">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-5 text-body leading-[1.7] text-site-muted last:mb-0">
              {paragraph}
            </p>
          ))}

          {/* Types itself out when it scrolls into view. `TypedText` reserves
              the finished box first, so the page below does not reflow while it
              runs, and it renders complete under `prefers-reduced-motion`. */}
          <TypedText
            text={closing}
            className="mt-8 border-l-2 border-site-accent pl-5 text-[1.125rem] font-medium leading-[1.5] text-site-fg"
          />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- founder */

export function AboutFounder() {
  const { eyebrow, heading, quote, attribution, paragraphs, portrait } = aboutPage.founder;

  return (
    <section className="container-page border-t border-white/[0.06] py-20 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          {portrait ? (
            <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] border border-white/10">
              <Image
                src={portrait}
                alt={attribution}
                fill
                sizes="(min-width:1024px) 45vw, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            /* No portrait yet, so the quote takes the picture's place rather
               than leaving a grey rectangle. */
            <figure className="relative overflow-hidden rounded-[20px] border border-white/10 bg-site-surface p-8 sm:p-12">
              <span aria-hidden="true" className="absolute inset-0 bg-emberSoft opacity-60" />
              <blockquote
                data-reveal
                className="relative z-10 text-[1.375rem] font-semibold leading-[1.35] tracking-[-0.01em] text-site-fg sm:text-[1.625rem]"
              >
                “{quote}”
              </blockquote>
              <figcaption
                data-reveal
                className="relative z-10 mt-6 text-label uppercase tracking-[0.12em] text-site-accent"
              >
                {attribution}
              </figcaption>
            </figure>
          )}
        </div>

        <div className="min-w-0">
          <p className="t-label">{eyebrow}</p>
          <h2 className="t-h2 mt-4">{heading}</h2>

          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mt-5 text-body leading-[1.7] text-site-muted">
              {paragraph}
            </p>
          ))}

          {portrait ? (
            <blockquote
              data-reveal
              className="mt-8 border-l-2 border-site-accent pl-5 text-[1.25rem] font-medium leading-[1.4] text-site-fg"
            >
              “{quote}”
            </blockquote>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- timeline */

export function AboutTimeline() {
  const { eyebrow, heading, milestones } = aboutPage.timeline;

  return (
    <section className="container-page border-t border-white/[0.06] py-20 sm:py-28">
      <p className="t-label">{eyebrow}</p>
      <h2 className="t-h2 mt-4">{heading}</h2>

      {/*
       * Horizontal on desktop, vertical on a phone. The connector is a border
       * on the container rather than a drawn line, so it follows whichever
       * direction the flex takes without a second implementation.
       */}
      <ol className="mt-12 flex flex-col gap-10 border-l border-white/10 pl-8 lg:flex-row lg:gap-8 lg:border-l-0 lg:border-t lg:pl-0 lg:pt-10">
        {/* Revealed on scroll rather than on mount: this section sits well down
            the page, so the `animate-riseIn` class used elsewhere would have
            played out off-screen. The dot is positioned against the `li`, so
            the `li` itself is what moves — revealing its contents alone would
            leave the dot behind. */}
        {milestones.map((milestone, i) => (
          <Reveal as="li" key={milestone.year} delay={i * 0.09} className="relative flex-1">
            <span
              aria-hidden="true"
              className="absolute -left-[41px] top-1.5 size-2.5 rounded-pill bg-site-accent shadow-ember lg:-top-[45px] lg:left-0"
            />
            <p className="text-label uppercase tracking-[0.12em] text-site-accent">
              {milestone.year}
            </p>
            <p className="t-h3 mt-2 text-site-fg">{milestone.title}</p>
            <p className="mt-2 text-sm leading-[1.7] text-site-muted">{milestone.text}</p>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ grid */

/** The four scenes already built for the Services page, reused as card art. */
const CARD_SCENES: Record<string, (props: { className?: string }) => JSX.Element> = {
  worship: IsoAudioCity,
  kids: IsoAiVideoCity,
  film: IsoVideoCity,
  ai: IsoAiAudioCity,
};

export function AboutGrid() {
  const { eyebrow, heading, paragraphs, pull, closing, cards } = aboutPage.grid;

  return (
    <section className="container-page border-t border-white/[0.06] py-20 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="t-label">{eyebrow}</p>
          <h2 className="t-h2 mt-4">{heading}</h2>
        </div>

        <div className="min-w-0 lg:col-span-7">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-5 text-body leading-[1.7] text-site-muted">
              {paragraph}
            </p>
          ))}

          {/* Set apart rather than buried in the prose: it is the section's
              argument, not another sentence about it. */}
          <p className="mt-7 text-[1.125rem] font-medium leading-[1.5] text-site-fg">{pull}</p>
        </div>
      </div>

      <div className="mt-14 grid gap-6 sm:grid-cols-2">
        {cards.map((card) => {
          const Scene = CARD_SCENES[card.id];

          return (
            <article
              key={card.id}
              className="overflow-hidden rounded-[20px] border border-white/10 bg-site-surface"
            >
              {/* 5:4 to match the card artwork, which is 1402x1122. At the
                  16:10 this used to be, `object-cover` cut ~22% of each
                  image's height — taking the signage off the top and the
                  ground floors off the bottom. `object-cover` stays: with the
                  frame matched it has nothing to crop, and it still guards
                  against a future image of a different shape leaving bars. */}
              <div className="relative aspect-[5/4] overflow-hidden bg-site-bg">
                {card.image ? (
                  <Image
                    src={card.image}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                ) : Scene ? (
                  <Scene className="absolute inset-0 size-full" />
                ) : null}
              </div>

              <div className="p-6 sm:p-7">
                <h3 className="text-[1.125rem] font-semibold text-site-fg">
                  {card.title}
                </h3>
                <p className="mt-2 text-sm leading-[1.7] text-site-muted">{card.text}</p>
              </div>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-12 max-w-3xl text-center text-body leading-[1.7] text-site-muted">
        {closing}
      </p>
    </section>
  );
}

/* --------------------------------------------------------------- mission */

export function AboutMission() {
  const { eyebrow, heading, statement, principles, seekLabel, seek } = aboutPage.mission;

  return (
    <section className="container-page py-20 sm:py-28">
      {/*
       * A warmer ground than the rest of the page. The brief asked for a light
       * panel here for rhythm; on an all-black site that would be the only
       * light thing anywhere, so it is a warm near-black with an ember wash —
       * same change of pace, palette intact.
       */}
      <div className="relative overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#14100F] px-6 py-14 sm:px-12 sm:py-16">
        <span aria-hidden="true" className="absolute inset-0 bg-emberSoft opacity-70" />

        <div className="relative z-10">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <p className="t-label">{eyebrow}</p>
              <h2 className="t-h2 mt-4">{heading}</h2>
              <p className="mt-6 text-body leading-[1.7] text-site-muted">{statement}</p>
            </div>

            <ul className="flex flex-col gap-6">
              {principles.map((principle) => (
                <li key={principle.title} className="border-t border-white/10 pt-5">
                  <p className="text-[1.125rem] font-semibold text-site-accent">
                    {principle.title}
                  </p>
                  <p className="mt-1.5 text-body leading-[1.7] text-site-muted">{principle.text}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* The seven points, numbered — same construction as the Services
              lists, so the two pages read as one system. */}
          <p className="t-label mt-14">{seekLabel}</p>
          <ol className="mt-4 grid gap-x-12 sm:grid-cols-2">
            {seek.map((item, i) => (
              <li
                key={item}
                data-reveal
                className="flex gap-4 border-b border-white/[0.08] py-3.5 text-body text-site-muted"
              >
                <span className="shrink-0 text-sm font-medium tabular-nums text-site-accent">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- heart */

export function AboutHeart() {
  const { eyebrow, heading, lead, lines, bridge, closing } = aboutPage.heart;

  return (
    <section className="relative isolate overflow-hidden border-y border-white/[0.06] py-24 sm:py-32">
      <span aria-hidden="true" className="absolute inset-0 bg-emberSoft opacity-50" />

      <div className="container-page relative z-10 text-center">
        <p className="t-label">{eyebrow}</p>
        <h2 className="t-h2 mx-auto mt-4 max-w-2xl">{heading}</h2>
        <p className="mx-auto mt-5 max-w-xl text-body leading-[1.7] text-site-muted">{lead}</p>

        {/*
          A framed panel for the lines: dotted backdrop, hairline border, and a
          filled square on each corner.

          Filled squares rather than the L-shaped `PanelMarks` brackets used on
          the Services page — the square is the detail this treatment turns on.
          Worth knowing the site now carries two corner idioms.

          Only the lines are framed, not the whole section: the eyebrow, heading
          and lead read as the introduction TO the panel rather than part of it.
        */}
        <div className="relative mx-auto mt-14 max-w-3xl border border-white/10">
          <DotPattern width={5} height={5} />

          {/* Half outside the border, half in, so they sit ON the corners. */}
          <span aria-hidden="true" className="absolute -left-1.5 -top-1.5 size-3 bg-site-accent" />
          <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 size-3 bg-site-accent" />
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 -left-1.5 size-3 bg-site-accent"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 -right-1.5 size-3 bg-site-accent"
          />

          <div className="relative z-10 flex flex-col gap-5 px-6 py-12 sm:px-10 sm:py-14">
            {lines.map((line) => (
              /*
               * Each line fades up in turn — now via the site-wide blur reveal
               * in `site/TextReveal.tsx`, which staggers a batch in document
               * order, rather than this block's own `animate-riseIn` delays.
               * Two entrances on one element would fight, and the whole page's
               * body copy already reveals this way.
               */
              <p
                key={line}
                className="text-[1.25rem] font-medium leading-[1.4] text-site-fg sm:text-[1.75rem]"
              >
                {line}
              </p>
            ))}
          </div>
        </div>

        <p className="mx-auto mt-14 max-w-2xl text-body leading-[1.7] text-site-muted">{bridge}</p>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-2">
          {closing.map((line) => (
            <li data-reveal key={line} className="text-[1.0625rem] font-medium text-site-accent">
              {line}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- future */

export function AboutFuture() {
  const { eyebrow, heading, paragraphs, changes, closing, steps } = aboutPage.future;

  return (
    <section className="container-page py-20 sm:py-28">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5">
          <p className="t-label">{eyebrow}</p>
          <h2 className="t-h2 mt-4">{heading}</h2>
        </div>

        <div className="min-w-0 lg:col-span-7">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="mb-5 text-body leading-[1.7] text-site-muted">
              {paragraph}
            </p>
          ))}

          {/* The copy is written as four beats, so it is set as four lines
              rather than run together. They were stepped 0/14/28/42px as well,
              which read as a misalignment against the flush paragraphs around
              them; the ember and the weight on the last line carry the build on
              their own. */}
          <div className="mt-8 flex flex-col gap-2">
            {changes.map((line, i) => (
              <p
                key={line}
                className={cn(
                  'text-[1.0625rem] leading-[1.5]',
                  i === changes.length - 1 ? 'font-semibold text-site-accent' : 'text-site-fg/80',
                )}
              >
                {line}
              </p>
            ))}
          </div>

          <p className="mt-8 text-body leading-[1.7] text-site-muted">{closing}</p>
        </div>
      </div>

      {/* The steps sit on a travelling dashed line — the same idiom the service
          panels use for a signal moving along a path. */}
      <div className="relative mt-14">
        {/*
          Inset by half a column so the line starts and ends ON the outer dots.
          At `left-0 right-0` it ran the full width, overhanging 26px past the
          first dot and 8px past the last — the two differ because each dot is
          centred in a label-width box, and "Audio" is 52px against "AI" at 16px.

          Derived from `steps.length` rather than hard-coded, so adding or
          removing a step keeps the line correct.

          `top-1` is 4px: the dot is `sm:size-2` (8px) and starts at the top of
          the list, so its centre is 4px down. It was `top-3`, which drew the
          line 8px BELOW the dots rather than through them. Change one and the
          other has to move with it.
        */}
        <span
          aria-hidden="true"
          className="absolute top-1 hidden border-t border-dashed border-site-accent/40 sm:block"
          style={{ left: `${50 / steps.length}%`, right: `${50 / steps.length}%` }}
        />

        <ol className="relative flex flex-col gap-8 sm:flex-row sm:justify-between sm:gap-4">
          {steps.map((step, i) => (
            /* `sm:flex-1` gives every step an equal column, so the dots are
               evenly spaced whatever the labels measure. Under
               `justify-between` alone the boxes were label-width, and
               "Animation" crowded its neighbours — the gaps came out 254, 275,
               281, 244 instead of even. */
            <li key={step} className="flex items-center gap-3 sm:flex-1 sm:flex-col sm:gap-4">
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 animate-isoPulse rounded-pill bg-site-accent sm:size-2"
                style={{ animationDelay: `${i * 260}ms` }}
              />
              <span
                data-reveal
                className="text-sm font-medium uppercase tracking-[0.14em] text-site-muted sm:text-center"
              >
                {step}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- vision */

export function AboutVision() {
  const { eyebrow, heading, words, paragraphs } = aboutPage.vision;

  return (
    <section className="container-page border-t border-white/[0.06] py-24 text-center sm:py-32">
      <p className="t-label">{eyebrow}</p>
      <h2 className="mt-4 text-[1.5rem] font-black uppercase tracking-[0.16em] text-site-fg sm:text-[2rem]">
        {heading}
      </h2>

      {/*
        One word at a time rather than all four in a row. The alternating
        white/ember colouring went with the list — it existed to stop four
        static words reading as a flat set, which stops being a problem when
        only one is on screen.
      */}
      <LoopingWords words={words} className="mt-12" />

      <div className="mx-auto mt-14 max-w-2xl">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-5 text-body leading-[1.7] text-site-muted last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- closing */

export function AboutClosing() {
  const { eyebrow, intro, paragraphs, lines } = aboutPage.closing;

  return (
    <section className="container-page border-t border-white/[0.06] py-24 text-center sm:py-32">
      <p className="t-label">{eyebrow}</p>

      <div className="mx-auto mt-6 max-w-2xl">
        {intro.map((line) => (
          <p key={line} className="text-[1.25rem] leading-[1.5] text-site-muted sm:text-[1.5rem]">
            {line}
          </p>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-4 text-body leading-[1.7] text-site-muted last:mb-0">
            {paragraph}
          </p>
        ))}
      </div>

      <h2 className="mx-auto mt-12 max-w-4xl text-[1.75rem] font-normal leading-[1.2] tracking-[-0.02em] text-site-fg sm:text-[3rem]">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </h2>
    </section>
  );
}
