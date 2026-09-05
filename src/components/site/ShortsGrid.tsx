import Image from 'next/image';
import Link from 'next/link';

import type { VideoCardData } from '@/features/youtube/queries';

/**
 * The width of image the browser actually needs, which is far wider than the
 * card. Reasoned out in `ShortsRail` and repeated here because the same trap
 * applies: the stored thumbnail is 16:9 and `object-cover` fits it into a 9:16
 * box by scaling until it covers the HEIGHT, then cropping the sides. A `sizes`
 * hint is a promise about RENDERED size, not layout size, and cover-cropping
 * breaks the two apart — passing the card's own width serves a blurred image.
 *
 * The cards here are fluid rather than a fixed 180px, so this is sized for the
 * widest they get: a five-column row inside the 1152px container is about
 * 210px, and covering that height needs 210 x (16/9) x (16/9).
 */
const COVER_W = Math.round(((210 * 16) / 9) * (16 / 9));

/**
 * Shorts as a grid of portrait cards.
 *
 * Every card opens `/shorts?v=<id>` rather than a page of its own. Shorts have
 * no detail page — `/videos/<id>` 404s them, because a 9:16 video sat
 * letterboxed in that page's widescreen player — so the feed is where a Short
 * is watched, and this is the way into it at a chosen video.
 *
 * Five across at desktop, matching `SongGrid`; these are much taller than a
 * cover, so the row count is what makes the page long, not the column count.
 */
export function ShortsGrid({ videos }: { videos: readonly VideoCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {videos.map((video) => (
        <li key={video.id}>
          <Link
            href={`/shorts?v=${video.youtubeVideoId}`}
            className="group block rounded-[16px] border border-white/10 bg-site-surface p-3 transition-colors duration-300 hover:border-site-accent/50"
          >
            <span className="relative block aspect-[9/16] overflow-hidden rounded-[10px] bg-black">
              <Image
                src={video.thumbnail}
                alt=""
                fill
                sizes={`${COVER_W}px`}
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
            </span>

            <span className="mt-3 block">
              <span className="line-clamp-2 block text-sm font-medium text-site-fg">
                {video.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-site-muted">
                {video.channel.name}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
