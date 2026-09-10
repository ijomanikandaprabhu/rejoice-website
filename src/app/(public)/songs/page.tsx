import Image from 'next/image';
import Link from 'next/link';

import { CtaPanel } from '@/components/site/CtaPanel';
import { SongGrid } from '@/components/site/SongGrid';
import { ctaPanels, musicPage } from '@/config/content.config';
import { pageSizes } from '@/config/app.config';
import { listPublicSongsPage } from '@/features/songs/queries';
import { breadcrumbJsonLd, buildMetadata, collectionJsonLd } from '@/lib/seo';

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
      {/* Thirty of `total` — see `collectionJsonLd` for why the two numbers
          are stated separately rather than the list claiming to be everything. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionJsonLd({
              name: 'Songs',
              description:
                'Listen to Rejoice Gospel Communications on Spotify, Apple Music, JioSaavn, Gaana and more.',
              path: '/songs',
              items: songs.map((song) => ({ name: song.title, path: `/songs/${song.slug}` })),
              total,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd([{ name: 'Songs', path: '/songs' }])),
        }}
      />
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
        {/*
         * THE WINDOW'S OWN RIGHT EDGE, at every width. Do not cap it.
         *
         * This was briefly bounded to a centred 100rem band, on the reasoning
         * that the phone drifts away from the copy on an ultra-wide monitor.
         * That was wrong twice over. Measured against the live site, the cap put
         * a band of genuinely empty black to the RIGHT of the picture — 55px at
         * 1700, 205px at 2000 — which is the fault it was meant to prevent,
         * arriving on the other side. And the space it was protecting was never
         * empty: `.music-light` covers the whole section, so what sits between
         * the words and the phone is the lit ramp this hero is built around.
         *
         * Below 1600px a cap does nothing at all, which is exactly why it
         * survived review — every width checked was under it.
         */}
        {musicPage.heroImage ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-[10%] right-0 z-[1] hidden h-[118%] w-[46%] lg:block"
          >
            <Image
              src={musicPage.heroImage}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 46vw, 0px"
              /*
               * `object-right-bottom`, not `object-bottom`, and the box sits at
               * `right-0` rather than pushed past the edge.
               *
               * The image is portrait (1024x1536) inside a box whose shape
               * follows the window, so on a WIDE, SHORT monitor the box is far
               * wider than the picture and `contain` centred it — leaving the
               * hand floating in the middle of the right half with a band of
               * empty black beside it. Measured at 1920x720: an 879px box
               * holding a 385px image, so roughly 250px of nothing on either
               * side, and the box itself hanging 76px past the section.
               *
               * Anchoring the picture to its box's right edge, and the box to
               * the section's, makes the hand reach in from the edge at every
               * window shape. On a tall window the box is narrower than the
               * picture's aspect, so the width is the limit, there is no
               * horizontal slack, and this changes nothing.
               */
              className="object-contain object-right-bottom"
            />
          </div>
        ) : null}

        <div className="container-page relative z-10 flex min-h-[68vh] flex-col justify-center py-14 sm:py-16">
          <div>
            <p className="t-label text-site-muted">{musicPage.eyebrow}</p>

            {/* `t-h1` like every other page — the light weight now comes from
                the token, so this hero belongs to the same family. Its presence
                comes from the image and the light, not from bespoke type. */}
            <h1 className="t-h1 mt-6 max-w-[18ch]">{musicPage.heading}</h1>
          </div>

          {/* The two footnotes, as in the reference: the intro on the left, the
              one-line statement opposite it. */}
          {/* Grouped, not spread. `justify-between` pinned the heading to the top
              and this row to the bottom, leaving 250px of empty black between
              them however tall the hero was — the void is closed by grouping
              the text, not by shortening the section. */}
          <div className="mt-12 flex max-w-md flex-col gap-5 sm:mt-14">
            <p className="text-body leading-[1.7] text-site-muted">{musicPage.text}</p>

            <p className="text-body leading-[1.7] text-site-muted">{musicPage.line}</p>
          </div>

          {/*
           * The same hand, BELOW the copy, on phones and tablets.
           *
           * It used to be absent entirely under `lg`, and the reason was sound:
           * as a background it sat under the heading and "Your Favourite
           * Platform." ran across the lit face of the phone. Measured then,
           * heading against image: 300px of overlap at 640, 183px at 768, 114px
           * at 900, clear only at 1024.
           *
           * Putting it in the flow instead of behind the text settles that
           * argument rather than moving it — the copy keeps the full width it
           * wants, and the picture is finally seen whole rather than cropped
           * behind words. In the flow it also grows the section naturally, so
           * no height needs guessing.
           *
           * `aspect-[1024/1536]` is the file's own shape, so the box never
           * letterboxes and no space is reserved that the image will not fill.
           */}
          {musicPage.heroImage ? (
            <div
              aria-hidden="true"
              /*
               * Bled to the BOTTOM-RIGHT corner, not centred, because the
               * picture carries its own background: the hand sits in the left
               * of the frame and the right third is scene. Centred, that third
               * read as a slab of dead space beside the hand. Pushed off the
               * right edge instead — `-mr-5 sm:-mr-8` cancels the container's
               * side padding — it leaves the frame the way the desktop version
               * does, and the hand lands where the eye expects it.
               *
               * `-mb-14 sm:-mb-16` does the same for the bottom padding, so the
               * picture's lower edge meets the section's.
               *
               * Without it the hand floated: the source file already crops the
               * arm at its bottom edge, and with 56px of black underneath, that
               * crop stopped reading as "reaching in from below" and started
               * reading as a cut-out pasted in mid-air. Grounding it is what
               * the desktop version gets for free by hanging past the section.
               */
              className="relative -mb-14 -mr-5 ml-auto mt-12 aspect-[1024/1536] w-full max-w-[19rem] sm:-mb-16 sm:-mr-8 sm:max-w-[25rem] lg:hidden"
            >
              <Image
                src={musicPage.heroImage}
                alt=""
                fill
                /*
                 * `0px` above `lg` so a browser on a desktop never downloads
                 * this copy, and the absolutely-positioned one above declares
                 * the mirror of it. The same trick the desktop image already
                 * used; without it both files are fetched at every width.
                 */
                sizes="(min-width: 1024px) 0px, (min-width: 640px) 25rem, 19rem"
                className="object-contain"
              />
            </div>
          ) : null}
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

        {/*
         * Shown whenever there is anything to show, so the full catalogue is a
         * fixed part of this page rather than a button that appears one day.
         *
         * It used to require `total > songs.length` — more songs than the
         * preview holds — which meant it was invisible at anything under 30 and
         * Rejoice went looking for it.
         *
         * NO COUNT IN THE LABEL. It read "View all {total} songs", which at
         * today's catalogue of one renders "View all 1 songs". Plain wording is
         * right at 1, at 30 and at 5,000 and needs no plural handling.
         *
         * Zero is still excluded: the grid above is replaced by "the releases
         * are on their way", and a button to an empty listing under that
         * sentence would contradict it.
         */}
        {total > 0 ? (
          /*
           * Centred, and `btn-secondary` rather than `btn-primary` — the same
           * treatment as `SeeMoreFromChannel`, which is the other "there is
           * more of this" link on the site. It sits under a grid it belongs to
           * rather than beside a heading, so it reads as a continuation of the
           * listing rather than as the page's main action.
           */
          <div className="mt-10 flex justify-center">
            <Link href="/songs/all" className="btn-secondary px-7 text-sm">
              View all songs
            </Link>
          </div>
        ) : null}

        {/* The closing pair that sat here is gone. "Songs that inspire faith…"
            was the SECOND printing of that same sentence on this page — the
            hero above already carries it — and "Open any release to find it on
            your platform of choice." explained a grid of covers that is plainly
            already clickable. `musicPage.closing` is now unused; the string is
            left in the config rather than deleted, so putting the line back is
            a one-line change. */}
      </section>

      <div className="container-page pb-14 pt-8 sm:pb-20">
        <CtaPanel {...ctaPanels.music} />
      </div>
    </>
  );
}
