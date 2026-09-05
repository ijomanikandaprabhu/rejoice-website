import Image from 'next/image';
import Link from 'next/link';

import { CtaPanel } from '@/components/site/CtaPanel';
import { SongGrid } from '@/components/site/SongGrid';
import { ctaPanels, musicPage } from '@/config/content.config';
import { pageSizes } from '@/config/app.config';
import { listPublicSongsPage } from '@/features/songs/queries';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Songs',
  description:
    'Listen to Rejoice Gospel Communications on Spotify, Apple Music, JioSaavn, Gaana and more.',
  path: '/songs',
});

/**
 * The releases.
 *
 * This page has had three lives: the video catalogue, then a directory of
 * streaming-platform logos, and now the songs themselves. The middle one was
 * replaced because none of its ten logos ever had a link behind them — a
 * visitor who wanted to hear a track had nowhere to go. The links now live on
 * each song, which is where someone actually looks for them.
 *
 * The hero is unchanged; only the section below it is new.
 */
export default async function MusicPage() {
  /*
   * The newest thirty, not everything. Drawing the whole catalogue here would
   * grow this page without limit and give no way to find anything — that is
   * what /songs/all is for, and the link below only appears once there is more
   * to see than this.
   */
  const { rows: songs, total } = await listPublicSongsPage({ take: pageSizes.songsPreview });

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
         * Hidden below `lg`, not `sm`. The reasoning was already right — a
         * device mockup behind the copy fights the type — but the breakpoint
         * was too low, so the fight simply moved to tablets instead of ending.
         *
         * Measured, heading right edge against image left edge:
         *
         *    640px  overlaps by 300px
         *    768px  overlaps by 183px
         *    900px  overlaps by 114px
         *   1024px  clear
         *
         * The type sits ON TOP (z-10 over z-1), so nothing was hidden — but
         * "Your Favourite Platform." ran across the lit face of the phone and
         * stopped being comfortably readable. Below `lg` the copy still wants
         * the full width, exactly as it does on a phone.
         */}
        {musicPage.heroImage ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[10%] -right-[6%] z-[1] hidden h-[118%] w-[46%] lg:-right-[4%] lg:block"
          >
            <Image
              src={musicPage.heroImage}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 0px"
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
          {songs.length === 0 ? (
            /*
             * Said plainly rather than dressed up. An empty grid with a
             * heading over it reads as a page that failed to load; this reads
             * as a page waiting for its first release.
             */
            <p className="text-body leading-[1.7] text-site-muted">
              The releases are on their way. In the meantime, every video is on the{' '}
              <Link href="/creations" className="text-site-accent underline underline-offset-4">
                Creations
              </Link>{' '}
              page.
            </p>
          ) : (
            <SongGrid songs={songs} />
          )}
        </div>

        {total > songs.length ? (
          <div className="mt-10">
            <Link href="/songs/all" className="btn-primary">
              View all {total.toLocaleString()} songs
            </Link>
          </div>
        ) : null}

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
