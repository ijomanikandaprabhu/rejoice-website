import Image from 'next/image';
import Link from 'next/link';

import { RailArrows } from '@/components/site/RailArrows';
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
  return (
    <div className="group flex items-start gap-5 sm:gap-8">
      {/*
       * To the channel's page on this site, not out to YouTube. The channel
       * page is where the rest of its videos are; YouTube is still one click
       * further on, from that page's own "Visit on YouTube" button.
       *
       * The avatar is a sibling column, not `position: sticky`. There is no
       * scroll container to stick against — the row moves by CSS transform, not
       * by scrolling — so a flex column is what actually pins it beside the
       * moving cards.
       */}
      <Link
        href={`/creations/${channel.slug}`}
        className="shrink-0 pl-5 sm:pl-8"
        aria-label={`${channel.name} — all videos`}
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
      <div data-rail className="relative min-w-0 flex-1">
        {/*
         * `.rail-viewport` (globals.css) clips the over-wide track, and swaps to
         * a normally scrollable row under reduced motion — where the marquee is
         * frozen and the cards would otherwise be unreachable.
         */}
        <div className="rail-viewport">
          {/*
           * One track holding the list twice. Travelling exactly -50% of the
           * track is one full copy, so the second lands precisely where the
           * first began and the loop has no seam. Both halves must be identical
           * widths for that to hold — hence the shared `RailItems`, and `pr-4`
           * inside it rather than a gap between the two halves.
           */}
          <div
            data-rail-track
            className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
            style={{ animationDuration: `${Math.max(channel.videos.length, 4) * 9}s` }}
          >
            <RailItems videos={channel.videos} />
            {/* Visual filler only — a screen reader must not read the row twice. */}
            <div aria-hidden="true" className="flex">
              <RailItems videos={channel.videos} />
            </div>
          </div>
        </div>

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

      <div className="mt-10 space-y-8 sm:space-y-10">
        {withVideos.map((channel) => (
          <ChannelRail key={channel.id} channel={channel} />
        ))}
      </div>
    </section>
  );
}
