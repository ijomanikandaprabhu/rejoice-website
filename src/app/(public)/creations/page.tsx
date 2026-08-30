import { ChannelBoard } from '@/components/site/ChannelBoard';
import { ctaPanels } from '@/config/content.config';
import { CtaPanel } from '@/components/site/CtaPanel';

import { EmptyPanel } from '@/components/site/Section';
import { CoverflowCarousel } from '@/components/ui/coverflow-carousel';
import { LetterHover } from '@/components/ui/scale-letter';
import { channelsHoverLine } from '@/features/content/queries';
import { getCarouselVideos, getChannelsWithVideos } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Creations',
  description: 'The official Rejoice YouTube channels and their latest selected videos.',
  path: '/creations',
});

export default async function ChannelsPage() {
  const [channels, carousel] = await Promise.all([
    getChannelsWithVideos(21),
    getCarouselVideos(10),
  ]);

  return (
    /*
     * No `container-page` on the wrapper: the carousel below is full-bleed and
     * cannot be inside a `max-w-6xl` box. The blocks that DO want the container
     * carry it themselves — the same arrangement `ChannelRails` uses on the
     * homepage for the same reason.
     */
    <div className="py-14 sm:py-20">
      {/*
       * The page heading. Rendered by `LetterHover` as the real `h1` — the
       * ember panel that used to carry the h1 was removed, and a page with no
       * heading is worse for search and for anyone navigating by headings. The
       * letters are aria-hidden; the h1's accessible name is the whole sentence.
       */}
      {channelsHoverLine ? (
        <div className="container-page pb-4 pt-6">
          <LetterHover as="h1" text={channelsHoverLine} />
        </div>
      ) : null}

      {/*
       * Coverflow hero. Which videos appear is an administrator's choice —
       * the "Carousel" toggle in YouTube Content — and `getCarouselVideos`
       * falls back to the newest releases while nothing is picked, so this
       * never renders as an empty shelf.
       */}
      {carousel.length > 0 ? (
        <CoverflowCarousel
          slides={carousel.map((video) => ({
            src: video.thumbnail,
            alt: video.title,
            title: video.title,
            subtitle: video.channel.name,
            href: `/videos/${video.youtubeVideoId}`,
          }))}
          label="Selected releases"
          /*
           * Tuning lives here, not in the component, so it stays generic and
           * this page owns its own look.
           *
           * NEGATIVE `gap` is deliberate. `pitch = cardWidth × (1 + gap)`, so
           * -0.28 puts the cards 0.72 of a card apart — they OVERLAP, which is
           * the coverflow look, instead of sitting in a row with black between
           * them. That overlap is what lets the card grow from 20% to 32% of
           * the viewport without pushing its neighbours off screen.
           *
           * Hard limit: `gap` must stay above -1. At -1 the pitch is zero,
           * every card stacks on one spot, and the drag handler divides by
           * pitch — so swiping would break outright.
           *
           * `depth` is a fraction of card width, so the recession scales with
           * the new size on its own and needs no change.
           */
          // Advances on its own; suspends while the visitor is interacting.
          autoplayMs={3000}
          gap={-0.28}
          depth={0.42}
          fade={0.07}
          cardWidth="clamp(210px, 32vw, 460px)"
          showCaption
          showNavigation
          showPagination
        />
      ) : null}

      {/* Not `container-page`: each row runs its own gutters so the track can go full-bleed. */}
      {/*
       * Back inside `container-page`: unlike the rows this replaced, the board
       * is a normal grid rather than a full-bleed scrolling track.
       */}
      <div className="container-page mt-14">
        {channels.length === 0 ? (
          <EmptyPanel
            title="No channels connected"
            description="Channels connected in the admin portal appear here with their latest releases."
          />
        ) : (
          <ChannelBoard channels={channels} />
        )}

        <CtaPanel {...ctaPanels.channels} className="mt-16 sm:mt-20" />
      </div>
    </div>
  );
}
