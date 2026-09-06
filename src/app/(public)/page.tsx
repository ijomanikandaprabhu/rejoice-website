import { ArrowLink, SectionHead } from '@/components/site/Section';
import { ctaPanels } from '@/config/content.config';
import { CtaPanel } from '@/components/site/CtaPanel';

import { ChannelRails } from '@/components/site/ChannelRails';
import { HomeSongs } from '@/components/site/HomeSongs';
import { ChannelSpotlight } from '@/components/site/ChannelSpotlight';
import { ShortsRail } from '@/components/site/ShortsRail';
import { TextHoverEffect } from '@/components/ui/text-hover-effect';
import { BentoCards } from '@/components/ui/bento-monochrome-1';
import { WaveBand } from '@/components/ui/music-reactive-hero-section';
import { ScrollRing } from '@/components/ui/scrolling-animation';
import { HeroRecord } from '@/components/site/HeroRecord';
import { HeroVideo } from '@/components/site/HeroVideo';
import { VideoGrid } from '@/components/youtube/VideoCard';
import { bentoCards, getContactDetails, homeContent, platforms } from '@/features/content/queries';
import { listPublicSongsPage } from '@/features/songs/queries';
import { getChannelsWithVideos, getShortsVideos } from '@/features/youtube/queries';
import { buildMetadata, organizationJsonLd, websiteJsonLd } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({ path: '/' });

export default async function HomePage() {
  // Each section pulls a bounded query — the homepage never loads five
  // channels' full libraries.
  const content = homeContent;

  const [contact, channels, shorts, latestSongs] = await Promise.all([
    getContactDetails(),
    /*
     * 50 per rail.
     *
     * The loop time scales with the count (`videos.length * 9s` in
     * ChannelRails), so a full pass takes about 7.5 minutes rather than 108s —
     * the trade for showing more without speeding the scroll into a blur. The
     * arrows are the fast way through. Thumbnails stay cheap because the cards
     * carry no `priority` and so load as they travel into view.
     */
    getChannelsWithVideos(50),
    // 50 here too, on the same reasoning (`videos.length * 7s` in ShortsRail).
    getShortsVideos(50),
    /*
     * Ten covers, which is two rows at five across. Narrower screens hide the
     * overflow rather than fetching less — see `twoRows` in `SongGrid`.
     *
     * In this `Promise.all` rather than awaited after it: the homepage already
     * makes three round trips and there is no reason for a fourth to wait on
     * them.
     */
    listPublicSongsPage({ take: 10 }),
  ]);

  const socials = contact.socials.map((s) => s.href);

  return (
    <>
      {/* Organization says who runs the site; WebSite says what the site is.
          Google treats them as separate entities and both are worth stating. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd(socials)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
      />

      {/*
       * Hero — the film carries this section and is shown whole, so the section
       * takes its height from the clip's 16:9 ratio.
       *
       * Where the headline goes depends on how much frame there is to put it
       * on. From `md` up the film is at least ~430px tall, which carries the
       * headline comfortably over the clip's night sky — and, more to the
       * point, means the film runs under the header with no top edge at all.
       * Only below `md` does the 16:9 get too short to overlay without
       * crowding both the type and the picture, so there the headline stacks
       * above it and `HeroVideo` feathers the top edge that creates.
       */}
      {/*
       * `-mt-[73px]` pulls the section up by the exact height of the sticky
       * header (4.5rem + its 1px border) so the film runs to the very top of
       * the viewport and passes behind the bar. Without this the header sits
       * above the film as a solid block and its bottom hairline draws a seam
       * across the top edge. `SiteHeader` goes transparent at the top of this
       * page to match. The paddings below add that 73px back so the headline
       * still clears the bar.
       */}
      {/*
       * `bg-site-night` below `md` only: there the headline stacks above the
       * film, so this paints the same navy the film's top overlay fades from
       * and the two meet with no seam. From `md` up the headline is overlaid
       * on the film and none of this background is visible, so it is dropped
       * rather than left to sit behind the page.
       */}
      {/*
       * The overlay only starts at `xl`, because the usable area is the clip's
       * *sky* — the horizon sits at ~55% of the frame (measured off the
       * footage), and copy over the seated figures reads as clutter rather
       * than as a headline.
       *
       * The sky is the trap here. The film is 16:9, so its height — and so the
       * sky's — is a fixed fraction of viewport WIDTH, while the record and the
       * type are fixed pixel sizes. Narrow the window and the sky shrinks
       * underneath type that does not. Measured, with the three-line headline,
       * as room left above the horizon:
       *
       *   1920px → +113px
       *   1440px →   -4px
       *   1280px →  -53px   ← the last line lands on the seated figures
       *   1024px →  -23px
       *
       * This used to start at `lg`, which was correct when the headline was two
       * lines. The third line costs ~55px and there is no width below 1280
       * where it and the record both fit over the sky — not without shrinking
       * the record into a token. So below `xl` the two stack above the film on
       * the navy panel instead, which is the same arrangement phones get and
       * has no horizon to avoid.
       *
       * Above `xl` the headline is sized in `vw` rather than points, capped at
       * its full 3.25rem, so it stays a constant fraction of the sky instead of
       * re-creating this bug at every width between the breakpoints.
       */}
      <section className="relative isolate -mt-[73px] overflow-hidden bg-site-night pt-[113px] xl:bg-transparent xl:pt-0">
        <div className="container-page relative z-10 pb-8 xl:absolute xl:inset-x-0 xl:top-0 xl:pb-0 xl:pt-[92px]">
          <HeroRecord src={content.heroAudio} className="mb-4 sm:mb-6 xl:mb-3 2xl:mb-5" />
          {/*
           * The step down at `lg` is deliberate. That is the width where the
           * sky runs out, and between shrinking the record and shrinking the
           * type, the type is what can afford it — this headline is long, and
           * a couple of points costs it far less than the record loses by
           * becoming a token. Full scale returns at `xl` where the sky does.
           */}
          {/* `whitespace-pre-line` honours the `
`s in `heroHeading`, which set
              it as three deliberate lines. Without it they collapse to spaces
              and the heading wraps wherever the width happens to fall. */}
          <h1 className="t-h1 mx-auto max-w-3xl whitespace-pre-line text-center xl:text-[min(3.25rem,3.4vw)]">
            {content.heroHeading}
          </h1>
        </div>
        <HeroVideo />
      </section>

      {/*
       * Statement line between the film and the catalogue.
       *
       * Outlined type with a spotlight of ember travelling through it. The
       * spotlight follows the cursor on a mouse and roams by itself otherwise,
       * which is what keeps the line readable on a phone — see the note in the
       * component, where hover-only was the original's undoing.
       *
       * The component measures its own viewBox from the type, so this section
       * only has to say how wide the line may run; the letters scale to fill it.
       */}
      {content.shinyText ? (
        <section className="overflow-hidden px-4 pb-8 pt-32 sm:pb-10 sm:pt-40 lg:pb-12 lg:pt-44">
          {/*
           * Deliberately NOT `container-page`: that caps at max-w-6xl, which
           * would stop the type well short of the edges on a wide screen. This
           * line is meant to fill the width, so it gets the viewport instead,
           * capped only so the letters stop growing on an ultra-wide monitor.
           *
           * No font size here: the type is SVG and scales with its measured
           * viewBox, so it fills whatever width this section allows.
           *
           * The block is wrapped so the fade below can be positioned against
           * the type itself rather than the section — the section's padding is
           * black either way, so a fade sized to it would sit almost entirely
           * in empty space and never reach the letters.
           */}
          <div className="relative">
            <TextHoverEffect
              text={content.shinyText}
              className="mx-auto w-full max-w-[72rem] px-4"
            />
            {/*
             * Black eased into the foot of the type, reusing the same ramp the
             * hero film uses for its bottom edge. Painted over the text rather
             * than masked out of it so the letters dissolve into the page
             * background instead of into whatever sits behind them.
             */}
            <div
              aria-hidden="true"
              className="fade-to-bg-bottom pointer-events-none absolute inset-x-0 bottom-0 h-[38%]"
            />
          </div>
        </section>
      ) : null}

      {/*
       * Full-bleed by design — the rails run off both edges, so no
       * `container-page` wrapper here. `ChannelRails` renders nothing at all
       * when no channel has an approved video, so the page reads exactly as it
       * did before until videos are made visible in the admin.
       */}
      {/*
       * Channel switcher: avatars over the selected channel's latest video.
       * Renders nothing until a second channel is connected — see the component.
       */}
      <ChannelSpotlight channels={channels} heading={content.spotlightHeading} />

      {/* Drifting waves with the wordmark at their centre. Decorative only. */}
      <WaveBand className="mt-24" />

      <ChannelRails channels={channels} />

      {/*
       * Where Rejoice music can be heard. Placed after the rails so it reads as
       * "…and beyond YouTube, here too".
       *
       * Guarded the same way as the shiny text above: no platforms configured,
       * no section — the page then reads exactly as it did before.
       */}
      {platforms.length > 0 && content.platformsHeading ? (
        <ScrollRing
          items={platforms.map((platform) => ({
            label: platform.name,
            src: platform.logo,
            // `url`, the same field the /songs grid reads. This used to map a
            // second, never-populated `href`, so filling the URLs in would have
            // lit up /songs and left this ring inert.
            href: platform.url,
          }))}
          eyebrow={content.platformsEyebrow}
          heading={content.platformsHeading}
        />
      ) : null}

      {/*
       * The newest releases, above Services — the first place on this page the
       * music is actually shown rather than described.
       */}
      <HomeSongs
        songs={latestSongs.rows}
        eyebrow={content.songsEyebrow}
        heading={content.songsHeading}
      />

      {/*
       * Services bento. The only services block on this page — the older
       * "What we do" grid was removed in favour of it.
       *
       * Its copy is DERIVED from the same `services` array the /services page
       * renders, so the homepage cannot promise something the Services page no
       * longer says. Each card links to its own section there.
       */}
      {bentoCards.length > 0 && content.servicesBentoHeading ? (
        <BentoCards
          items={bentoCards.map((card) => ({
            id: card.id,
            meta: card.meta,
            title: card.title,
            description: card.description,
            variant: card.variant,
            href: card.href,
          }))}
          eyebrow={content.servicesBentoEyebrow}
          heading={content.servicesBentoHeading}
        />
      ) : null}

      {/*
       * Shorts, in portrait. These are the only cards on the site that are not
       * 16:9 — see `ShortsRail`. Renders nothing when no Short is visible.
       */}
      <ShortsRail videos={shorts} />

      {/* `pt-24` like every other block on this page: sections here carry their
          own TOP spacing and no bottom spacing, so a wrapper with only `pb`
          landed straight on the cards above it. */}
      <div className="container-page pb-14 pt-24 sm:pb-20">
        <CtaPanel {...ctaPanels.home} />
      </div>
    </>
  );
}
