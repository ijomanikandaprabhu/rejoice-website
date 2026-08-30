import Image from 'next/image';
import Link from 'next/link';

import { RailArrows } from '@/components/site/RailArrows';
import { SiteButton } from '@/components/site/Section';
import type { VideoCardData } from '@/features/youtube/queries';

/** Card width. The 9:16 frame's height follows from it. */
const CARD_W = 180;

/**
 * The width of image the browser actually needs — far wider than the card.
 *
 * The thumbnail YouTube stores is 16:9, and `object-cover` fits it into a 9:16
 * box by scaling until it covers the HEIGHT, then cropping the sides. Covering
 * a 320px-tall frame therefore needs 320 × 16/9 ≈ 569px of image width.
 *
 * Passing the card's own 180px here, as the landscape rails do, was measured
 * serving a 179 × 101 image into a 180 × 320 box — a 3.2× upscale, and visibly
 * blurred. A `sizes` hint is a promise about rendered size, not layout size,
 * and cover-cropping breaks the two apart.
 */
const COVER_W = Math.round(((CARD_W * 16) / 9) * (16 / 9));

/**
 * One Short in the rail.
 *
 * `aspect-[9/16]`, which is the whole point of this component: these videos are
 * vertical, and every other card on the site is `aspect-video`. In a landscape
 * frame YouTube pillarboxes the player and the thumbnail is centre-cropped,
 * which on a 9:16 source throws away most of the top and bottom.
 *
 * Deliberately not `VideoCard` or `RailCard`, for the same reason `RailCard` is
 * not `VideoCard`: both of those hard-code `aspect-video`, and both describe a
 * different `sizes` to the browser.
 */
function ShortCard({ video }: { video: VideoCardData }) {
  return (
    <li className="w-[180px] shrink-0">
      {/*
       * To the feed, not to a page of its own. Shorts have no detail page —
       * `getPublicVideoBySlug` 404s them — because a 9:16 video in the video
       * page's `aspect-video` player sat letterboxed. The feed is where a Short
       * is watched.
       */}
      <Link href="/shorts" className="group/card block">
        <span className="relative block aspect-[9/16] overflow-hidden rounded-sm2 bg-site-surface">
          <Image
            src={video.thumbnail}
            alt=""
            fill
            sizes={`${COVER_W}px`}
            className="object-cover transition-transform duration-700 group-hover/card:scale-[1.05]"
          />
        </span>
        <span className="mt-2 line-clamp-2 block text-sm text-site-muted transition-colors group-hover/card:text-site-fg">
          {video.title}
        </span>
      </Link>
    </li>
  );
}

/** The duplicated half of the track. Rendered twice; see the note below. */
function RailItems({ videos }: { videos: VideoCardData[] }) {
  return (
    <ul className="flex shrink-0 gap-4 pr-4">
      {videos.map((video) => (
        <ShortCard key={video.id} video={video} />
      ))}
    </ul>
  );
}

/**
 * An auto-scrolling rail of Shorts, in portrait.
 *
 * The marquee is the same mechanism `ChannelRails` uses, and for the same
 * reasons: one track holding the list twice, travelling exactly -50% so the
 * second copy lands where the first began and the loop has no seam. Both halves
 * must be identical widths for that to hold — hence the shared `RailItems` with
 * `pr-4` inside it rather than a gap between the halves.
 *
 * `.rail-viewport` (globals.css) clips the over-wide track, fades both ends,
 * and swaps to a normally scrollable row under reduced motion — where the
 * marquee is frozen and the cards would otherwise be unreachable.
 *
 * Renders nothing when no Short is visible, so the page reads exactly as it did
 * before until some are switched on in the admin.
 */
export function ShortsRail({ videos }: { videos: VideoCardData[] }) {
  if (videos.length === 0) return null;

  return (
    <section className="pt-24">
      {/*
       * Full-bleed: the rail runs off both edges, so no `container-page` around
       * the track itself — only around the heading above it.
       */}
      <div className="group mt-10 px-5 sm:px-8">
        {/*
         * The arrows sit in this wrapper rather than inside `.rail-viewport`,
         * which carries the edge mask — an arrow parked in that faded strip
         * would be nearly invisible.
         */}
        <div data-rail className="relative min-w-0">
          <div className="rail-viewport">
            <div
              data-rail-track
              className="flex w-max animate-marquee group-hover:[animation-play-state:paused]"
              style={{ animationDuration: `${Math.max(videos.length, 4) * 7}s` }}
            >
              <RailItems videos={videos} />
              {/* Visual filler only — a screen reader must not read the row twice. */}
              <div aria-hidden="true" className="flex">
                <RailItems videos={videos} />
              </div>
            </div>
          </div>

          <RailArrows cardsPerCopy={videos.length} label="Shorts" />
        </div>
      </div>

      {/*
       * The way out of the rail, below it. `SiteButton` rather than
       * `SeeMoreFromChannel`: that component's whole text is "See more from
       * {name}", and a label prop to override its only content would hollow it
       * out. This is the same `btn-secondary` pill, in the same centred wrapper.
       *
       * `/shorts` is common to every channel, which is why the rail no longer
       * needs to know which channel its cards came from — and so no longer
       * assumes they all share one. Not `/songs`: that page is the
       * streaming-platform directory now, not the video catalogue.
       */}
      <div className="mt-10 flex justify-center">
        <SiteButton tone="secondary" href="/shorts" className="px-7 text-sm">
          See More
        </SiteButton>
      </div>
    </section>
  );
}
