import Image from 'next/image';
import Link from 'next/link';

import type { VideoCardData } from '@/features/youtube/queries';
import { cn, formatDate, formatDuration } from '@/lib/utils';

/**
 * One release, as a glossy card.
 *
 * Reads only the resolved values from `resolveVideoDisplay` — it never sees the
 * raw YouTube or override columns, so the fallback rule stays in one place.
 */
export function VideoCard({ video, index = 0 }: { video: VideoCardData; index?: number }) {
  const duration = formatDuration(video.durationSeconds);

  return (
    <article
      className="card-gloss group animate-riseIn transition-shadow duration-300 hover:shadow-glossHover"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <Link href={`/videos/${video.youtubeVideoId}`} className="block">
        <span className="relative block aspect-video overflow-hidden">
          <Image
            src={video.thumbnail}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-[1.05]"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-site-surface via-transparent to-transparent opacity-80" />

          {duration ? (
            <span className="absolute bottom-3 right-3 z-20 rounded-pill bg-black/70 px-2.5 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-sm">
              {duration}
            </span>
          ) : null}
        </span>

        <span className="relative z-20 block p-5">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <time
              dateTime={video.publishedAt.toISOString()}
              className="text-label uppercase tracking-[0.08em] text-site-muted"
            >
              {formatDate(video.publishedAt)}
            </time>
          </span>

          <span className="mt-3 line-clamp-2 block text-h3 text-site-fg transition-colors group-hover:text-site-accent">
            {video.title}
          </span>

          {video.showChannelName ? (
            <span className="mt-4 block text-label uppercase tracking-[0.08em] text-site-muted/70">
              {video.channel.name}
            </span>
          ) : null}
        </span>
      </Link>
    </article>
  );
}

export function VideoGrid({ videos, className }: { videos: VideoCardData[]; className?: string }) {
  return (
    <div className={cn('grid gap-6 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {videos.map((video, i) => (
        <VideoCard key={video.id} video={video} index={i} />
      ))}
    </div>
  );
}
