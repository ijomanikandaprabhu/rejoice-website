'use client';

import Image from 'next/image';
import Link from 'next/link';

import type { VideoCardData } from '@/features/youtube/queries';
import { cn, formatDate } from '@/lib/utils';

/**
 * One video, trimmed to date and title.
 *
 * Deliberately NOT `VideoCard`. That one also renders the description, the
 * channel name and a duration badge, and it is used by the Music page, the
 * homepage grid and the search results — trimming it there to suit this block
 * would silently restyle all of them. Same `card-gloss` surface, so it still
 * belongs to the site.
 *
 * Shared by `ChannelBoard` (the Channels page) and the dedicated channel page,
 * which is why it lives here rather than inside either of them.
 */
export function VideoTile({
  video,
  size,
  index = 0,
  portrait = false,
}: {
  video: VideoCardData;
  size: 'big' | 'small';
  index?: number;
  /**
   * Render the thumbnail 9:16 rather than 16:9, for a listing of Shorts.
   *
   * Opt-in, so every existing caller is untouched: this tile is shared by the
   * Channels board and the channel page, and flipping the default would restyle
   * both.
   */
  portrait?: boolean;
}) {
  const big = size === 'big';

  return (
    <Link
      href={`/videos/${video.youtubeVideoId}`}
      className={cn(
        'card-gloss group flex animate-riseIn flex-col overflow-hidden',
        // Lift on hover. `card-gloss` already carries the shadow; this adds the
        // movement and deepens it.
        'transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-glossHover',
        /*
         * The big card drops `card-gloss`'s sheen — its `::after` is a diagonal
         * white gradient at z-10 across the whole card. Over a flat panel that
         * reads as gloss, which is what it is for; over a full-bleed photograph
         * it is a smear, and being z-10 it washes the caption too.
         *
         * Suppressed HERE rather than in globals.css: `.card-gloss` also dresses
         * the service cards, the video grid, the contact panel and the bento
         * cards, so editing the class would restyle all of them to fix one card.
         * The small tiles keep theirs — they still have a caption panel for it
         * to catch.
         */
        big && '[&::after]:hidden',
      )}
      // Capped: `animate-riseIn` fills `both`, so it starts at opacity 0 and a
      // long delay would leave late tiles invisible for a visible beat.
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
    >
      <span
        className={cn(
          'relative block overflow-hidden bg-site-surface',
          portrait ? 'aspect-[9/16]' : 'aspect-video',
        )}
      >
        <Image
          src={video.thumbnail}
          alt=""
          fill
          /*
           * The portrait hint is far WIDER than the tile. The stored thumbnail
           * is 16:9 and `object-cover` fits it to a 9:16 box by scaling until it
           * covers the height, so the browser needs about (16/9)² times the
           * tile's width. Describing the tile's own width instead was measured
           * upscaling a 179px image into a 320px-tall box — visibly blurred.
           */
          sizes={
            portrait
              ? '(min-width: 640px) 60vw, 180vw'
              : big
                ? '(min-width: 1024px) 1088px, 100vw'
                : '(min-width: 640px) 25vw, 50vw'
          }
          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          priority={big}
        />

        {/*
         * The big card's caption sits ON the artwork — but only from `sm` up.
         *
         * On a phone the grid is a single column, so the big card is exactly as
         * wide as the tiles beneath it; the overlay then reads as the first card
         * being inconsistent rather than as hierarchy. Below 640px it is hidden
         * and the panel caption below takes over, so every card matches.
         *
         * The ramp runs to near-opaque at the base rather than a token 40%:
         * these covers are often pale — the current one is a light sky — and a
         * gentle gradient leaves white text unreadable on them.
         */}
        {big ? (
          /*
           * The scrim does NOT move; only the text inside it does.
           *
           * The hover lift used to sit on this gradient panel, which is anchored
           * `bottom-0`. Sliding it up 4px uncovered a 4px strip of the raw
           * thumbnail along the card's bottom edge — invisible on a dark cover,
           * but a bright gold line on a pale one. The gradient's whole job is to
           * be a fixed backdrop for the text, so it stays welded to the edge and
           * the transform moved inside.
           */
          <span className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/95 via-black/70 to-transparent p-5 pt-16 sm:block sm:p-7 sm:pt-20">
            <span className="flex flex-col gap-1.5 transition-transform duration-500 group-hover:-translate-y-1">
              <span className="text-label uppercase tracking-[0.08em] text-white/70">
                {formatDate(video.publishedAt)}
              </span>
              <span className="line-clamp-2 text-h3 text-white">{video.title}</span>
            </span>
          </span>
        ) : null}
      </span>

      {/*
       * The panel caption. Always rendered; on the big card it is hidden from
       * `sm` up, where the overlay above takes over. Exactly one of the two is
       * ever displayed, and `display: none` keeps the other out of the
       * accessibility tree too, so the title is announced once.
       */}
      <span className={cn('relative z-20 flex flex-col gap-1 px-3 py-2.5', big && 'sm:hidden')}>
        <span className="text-[0.6875rem] uppercase tracking-[0.08em] text-site-muted">
          {formatDate(video.publishedAt)}
        </span>
        {/* One line, not two: four of these titles are identical, so a second
              clamped line just repeats the same truncated words down the row. */}
        <span className="line-clamp-1 text-sm font-medium text-site-fg transition-colors group-hover:text-site-accent">
          {video.title}
        </span>
      </span>
    </Link>
  );
}
