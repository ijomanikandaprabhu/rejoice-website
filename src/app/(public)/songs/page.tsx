import Image from 'next/image';

import { CtaPanel } from '@/components/site/CtaPanel';
import { PlatformGrid } from '@/components/site/PlatformGrid';
import { ctaPanels, musicPage, platforms } from '@/config/content.config';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Songs',
  description:
    'Listen to Rejoice Gospel Communications on Spotify, Apple Music, JioSaavn, Gaana and more.',
  path: '/songs',
});

/**
 * Where to listen.
 *
 * This page used to be the video catalogue — filters, grid, pagination. It is
 * now a directory of streaming platforms: the videos live on the Channels page
 * and on their own `/songs/[id]` pages, which are untouched.
 */
export default function MusicPage() {
  return (
    <>
      {/*
       * The hero.
       *
       * A hand reaching into light is this label's own image, not a borrowed
       * one — which is why the reference this follows belongs on a gospel
       * music page and would be mere decoration elsewhere.
       *
       * `82vh`, not a full screen: the entire job of this page is to get
       * someone to the platform grid, and a full-viewport hero hides it. This
       * leaves the next section showing at the fold.
       */}
      <section className="relative isolate min-h-[68vh] overflow-hidden bg-site-bg">
        {/*
         * The light, in three layers. Each covers the whole section — the
         * colour ramp, then a vertical falloff, then the spill. See
         * `.music-light` in globals.css for why it is not one gradient.
         */}
        <span
          aria-hidden="true"
          className="music-light pointer-events-none absolute inset-0 z-0 animate-beamBreathe"
        />
        <span
          aria-hidden="true"
          className="music-light-bloom pointer-events-none absolute inset-0 z-0"
        />
        <span
          aria-hidden="true"
          className="music-light-falloff pointer-events-none absolute inset-0 z-0"
        />

        {/*
         * The hand and phone.
         *
         * Anchored bottom-right and pushed slightly PAST the bottom edge, so
         * the wrist runs off the frame the way the reference's hand does — the
         * section's `overflow-hidden` does the cropping. Floating it fully
         * inside the box would read as a mockup pasted on top of the scene.
         *
         * Sized by HEIGHT, not width: a width-driven size makes the phone
         * balloon on a wide monitor while the hero's height stays put, and the
         * crop at the bottom would drift with the window's shape.
         *
         * Hidden below `sm`. On a phone the copy already runs the full width,
         * and a device mockup behind it would fight the type — the problem
         * fixed two rounds ago, not worth reintroducing for decoration.
         */}
        {musicPage.heroImage ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[10%] -right-[6%] z-[1] hidden h-[118%] w-[62%] sm:block md:w-[54%] lg:-right-[4%] lg:w-[46%]"
          >
            <Image
              src={musicPage.heroImage}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 46vw, (min-width: 640px) 62vw, 0px"
              className="object-contain object-bottom"
            />
          </div>
        ) : null}

        <div className="container-page relative z-10 flex min-h-[68vh] flex-col justify-center py-14 sm:py-16">
          <div>
            <p className="t-label text-site-muted">{musicPage.eyebrow}</p>

            {/* `t-h1` like every other page — the light weight now comes from
                the token, so this hero belongs to the same family. Its presence
                comes from the image and the light, not from bespoke type. */}
            <h1 className="t-h1 mt-6 max-w-[18ch]">
              {musicPage.heading}
            </h1>
          </div>

          {/* The two footnotes, as in the reference: the intro on the left, the
              one-line statement opposite it. */}
          {/* Grouped, not spread. `justify-between` pinned the heading to the top
              and this row to the bottom, leaving 250px of empty black between
              them however tall the hero was — the void is closed by grouping
              the text, not by shortening the section. */}
          <div className="mt-12 flex max-w-md flex-col gap-5 sm:mt-14">
            <p className="text-body leading-[1.7] text-site-muted">
              {musicPage.text}
            </p>

            <p className="text-body leading-[1.7] text-site-muted">
              {musicPage.line}
            </p>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <h2 className="t-h2">{musicPage.gridHeading}</h2>

        <div className="mt-10">
          <PlatformGrid platforms={platforms} />
        </div>

        <div className="mt-12 max-w-2xl">
          <p className="text-body leading-[1.7] text-site-fg">{musicPage.closing}</p>
          <p className="mt-3 text-body leading-[1.7] text-site-muted">{musicPage.line}</p>
        </div>
      </section>

      <div className="container-page pb-14 pt-8 sm:pb-20">
        <CtaPanel {...ctaPanels.music} />
      </div>
    </>
  );
}
