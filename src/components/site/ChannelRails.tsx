import Image from 'next/image';
import Link from 'next/link';

import { RailArrows } from '@/components/site/RailArrows';
import { RailAutoScroll } from '@/components/site/RailAutoScroll';
import type { getChannelsWithVideos } from '@/features/youtube/queries';
import type { VideoCardData } from '@/features/youtube/queries';
import { formatDuration } from '@/lib/utils';

type Channel = Awaited<ReturnType<typeof getChannelsWithVideos>>[number];

/** Card width, kept in one place — the `sizes` hint below has to match it. */
const CARD_W = 256;

/**
 * One video in a rail. Deliberately not `VideoCard`.
 *
 * `VideoCard` is built for the grid: its `sizes` describes grid columns
 * ("33vw" and friends), which in a fixed-width rail would make the browser
 * fetch images at the wrong resolution. It also carries `animate-riseIn` with a
 * staggered delay, which would re-fire on every duplicated copy in the track.
 * This is the same link target and thumbnail, trimmed to what a rail needs.
 */
function RailCard({ video }: { video: VideoCardData }) {
  const duration = formatDuration(video.durationSeconds);

  return (
    <li className="w-64 shrink-0">
      <Link href={`/videos/${video.youtubeVideoId}`} className="group/card block">
        <span className="relative block aspect-video overflow-hidden rounded-sm2 bg-site-surface">
          <Image
            src={video.thumbnail}
            alt=""
            fill
            sizes={`${CARD_W}px`}
            className="object-cover transition-transform duration-700 group-hover/card:scale-[1.05]"
          />
          {duration ? (
            <span className="absolute bottom-2 right-2 rounded-pill bg-black/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
              {duration}
            </span>
          ) : null}
        </span>
        <span className="mt-2 line-clamp-2 block text-sm text-site-muted transition-colors group-hover/card:text-site-fg">
          {video.title}
        </span>
      </Link>
    </li>
  );
}

/** The duplicated half of the track. Rendered twice; see the note in ChannelRail. */
function RailItems({ videos }: { videos: VideoCardData[] }) {
  return (
    <ul className="flex shrink-0 gap-4 pr-4">
      {videos.map((video) => (
        <RailCard key={video.id} video={video} />
      ))}
    </ul>
  );
}

function ChannelRail({ channel }: { channel: Channel }) {
  /*
   * One number for both movers: the CSS marquee from `sm` up, and the rAF
   * scroller below it. If these two ever disagree the rail visibly changes pace
   * as the window crosses the breakpoint.
   */
  const seconds = Math.max(channel.videos.length, 4) * 9;

  return (
    /*
     * Two layouts out of one row of markup.
     *
     * From `sm` up, unchanged: the avatar is a sibling column beside the moving
     * cards. Below it the avatar sits ABOVE the row instead, aligned to the page
     * gutter and dipping into the first card's top-left corner — which hands the
     * cards the full width of the screen on the one size where width is scarce.
     * As a left-hand column it was costing about 104px of a 375px phone.
     */
    <div className="group flex flex-col sm:flex-row sm:items-start sm:gap-8">
      {/*
       * To the channel's page on this site, not out to YouTube. The channel
       * page is where the rest of its videos are; YouTube is still one click
       * further on, from that page's own "Visit on YouTube" button.
       *
       * `-mb-6` is the dip — 24px of a 64px avatar overlapping the row. It sits
       * on the link rather than as a negative top margin on the rail so that
       * `[data-rail]`'s box is left alone and `RailArrows` still centres on it.
       *
       * `z-10` puts it over the cards, which carry no z-index of their own, and
       * `sm:z-auto` restores the desktop layer order exactly. Nothing between
       * here and the cards may gain `overflow-hidden`, `transform` or `filter`:
       * any of them would open a stacking context and trap the avatar under the
       * row again.
       */}
      <Link
        href={`/creations/${channel.slug}`}
        className="relative z-10 -mb-6 shrink-0 self-start pl-5 sm:z-auto sm:mb-0 sm:pl-8"
        aria-label={`All videos from ${channel.name}`}
      >
        <span className="relative block size-16 overflow-hidden rounded-pill border border-white/10 bg-site-surface transition-colors hover:border-white/30 sm:size-20 lg:size-24">
          {channel.thumbnail ? (
            <Image src={channel.thumbnail} alt="" fill sizes="96px" className="object-cover" />
          ) : null}
        </span>
      </Link>

      {/*
       * The arrows sit in this wrapper rather than inside `.rail-viewport`,
       * which carries the edge mask — an arrow parked in that faded strip would
       * be nearly invisible.
       */}
      {/* `sm:flex-1` rather than `flex-1`: below the breakpoint this is a column
          child and should simply be full width, which is already the default. */}
      <div data-rail className="relative min-w-0 sm:flex-1">
        {/*
         * `.rail-viewport` (globals.css) clips the over-wide track from `sm` up,
         * and is a real scroller below it. `RailAutoScroll` renders that element
         * and, on a phone only, moves its `scrollLeft` — so the row drifts on its
         * own and still answers to a finger.
         */}
        <RailAutoScroll seconds={seconds}>
          {/*
           * One track holding the list twice. Travelling exactly -50% of the
           * track is one full copy, so the second lands precisely where the
           * first began and the loop has no seam. Both halves must be identical
           * widths for that to hold — hence the shared `RailItems`, and `pr-4`
           * inside it rather than a gap between the two halves. It is also what
           * lets `RailAutoScroll` wrap by half the scroll width invisibly.
           *
           * `sm:animate-marquee`: below the breakpoint there is no animation at
           * all, because the row is scrolled instead. The inline duration is
           * left unconditional — `animation-duration` with no `animation-name`
           * does nothing — so the value stays next to the `seconds` it shares.
           */}
          <div
            data-rail-track
            className="flex w-max group-hover:[animation-play-state:paused] sm:animate-marquee"
            style={{ animationDuration: `${seconds}s` }}
          >
            <RailItems videos={channel.videos} />
            {/* Visual filler only — a screen reader must not read the row twice. */}
            <div aria-hidden="true" className="flex">
              <RailItems videos={channel.videos} />
            </div>
          </div>
        </RailAutoScroll>

        <RailArrows cardsPerCopy={channel.videos.length} label={`${channel.name} videos`} />
      </div>
    </div>
  );
}

/**
 * One auto-scrolling rail per channel, each led by its channel avatar.
 *
 * Channels with nothing approved are dropped rather than rendered empty, and if
 * that leaves none the section renders nothing at all — so the page reads
 * exactly as it did before until videos are made visible in the admin.
 */
export function ChannelRails({ channels }: { channels: Channel[] }) {
  const withVideos = channels.filter((channel) => channel.videos.length > 0);
  if (withVideos.length === 0) return null;

  return (
    <section className="pt-24">
      <div className="container-page text-center">
        <p className="t-label">Explore Rejoice</p>
        <h2 className="t-h2 mx-auto mt-3 max-w-3xl">
          Different Expressions. One Message of Hope.
        </h2>
      </div>

      {/* Roomier on a phone: each row is an avatar taller now that the avatar sits
          above it, and 32px between one row's captions and the next channel's
          logo read as cramped. Desktop is unchanged. */}
      <div className="mt-10 space-y-12 sm:space-y-10">
        {withVideos.map((channel) => (
          <ChannelRail key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}
