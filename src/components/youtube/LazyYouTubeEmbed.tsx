'use client';

import Image from 'next/image';
import { useState } from 'react';

import { cn } from '@/lib/utils';
import { embedUrl } from '@/lib/utils/videoDisplay';

/**
 * A player that costs nothing until it is asked for.
 *
 * Until the visitor clicks we render only the thumbnail; the iframe — and all
 * of YouTube's scripts — arrive on click. Uses youtube-nocookie.com.
 */
export function LazyYouTubeEmbed({
  youtubeVideoId,
  title,
  thumbnail,
  className,
}: {
  youtubeVideoId: string;
  title: string;
  thumbnail: string;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={cn('relative aspect-video overflow-hidden rounded-card bg-black', className)}>
        <iframe
          src={embedUrl(youtubeVideoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className={cn(
        'group relative block aspect-video w-full overflow-hidden rounded-card bg-site-surface shadow-gloss',
        className,
      )}
    >
      <Image
        src={thumbnail}
        alt=""
        fill
        sizes="(min-width: 1024px) 66vw, 100vw"
        className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
      />
      <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

      <span className="absolute left-1/2 top-1/2 grid size-[4.5rem] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-site-accent shadow-ember transition-transform duration-200 group-hover:scale-110">
        <svg viewBox="0 0 24 24" className="ml-1 size-7 fill-white" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>

      <span className="sr-only">Play {title}</span>
    </button>
  );
}
