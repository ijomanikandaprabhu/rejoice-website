'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import type { VideoCardData } from '@/features/youtube/queries';
import { formatDate } from '@/lib/utils';
import { embedUrl } from '@/lib/utils/videoDisplay';

/**
 * Hero feature: one large release that plays in place, with a short queue
 * beside it. The panel carries the radial ember in its top-right corner.
 *
 * The iframe — and all of YouTube's scripts — only load on click.
 */
export function FeaturedPlayer({ videos }: { videos: VideoCardData[] }) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const lead = videos[current];
  const queue = videos.filter((_, i) => i !== current).slice(0, 3);

  if (!lead) {
    return (
      <div className="panel-ember grid min-h-[22rem] place-items-center px-6 py-16 text-center">
        <div>
          <p className="t-label">Nothing published yet</p>
          <p className="t-h3 mt-3 text-site-fg">The catalogue is waiting</p>
          <p className="mx-auto mt-2 max-w-sm text-body text-site-muted">
            Videos appear here as soon as they are approved in the admin portal.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="panel-ember p-4 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1.9fr_1fr]">
        <div>
          <div className="relative aspect-video overflow-hidden rounded-card bg-black">
            {playing ? (
              <iframe
                src={embedUrl(lead.youtubeVideoId)}
                title={lead.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 size-full"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 size-full"
              >
                <Image
                  src={lead.thumbnail}
                  alt=""
                  fill
                  priority
                  sizes="(min-width: 1024px) 60vw, 100vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-pill bg-site-accent shadow-ember transition-transform duration-200 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="ml-1 size-6 fill-white" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
                <span className="sr-only">Play {lead.title}</span>
              </button>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="t-label text-site-accent">Now playing</p>
              <h3 className="t-h3 mt-2 line-clamp-2 text-site-fg">{lead.title}</h3>
              <p className="mt-1 text-sm text-site-muted">
                {formatDate(lead.publishedAt)}
                {lead.showChannelName ? ` · ${lead.channel.name}` : ''}
              </p>
            </div>
            <Link href={`/videos/${lead.youtubeVideoId}`} className="btn-secondary shrink-0 px-5 text-sm">
              Details
            </Link>
          </div>
        </div>

        {queue.length > 0 ? (
          <div>
            <p className="t-label mb-3">Up next</p>
            <ul className="space-y-2.5">
              {queue.map((video) => {
                const index = videos.findIndex((v) => v.id === video.id);
                return (
                  <li key={video.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrent(index);
                        setPlaying(false);
                      }}
                      className="flex w-full items-center gap-3 rounded-sm2 border border-white/[0.06] bg-white/[0.03] p-2 text-left transition-colors hover:border-white/15 hover:bg-white/[0.07]"
                    >
                      <span className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-input">
                        <Image
                          src={video.thumbnail}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-medium text-site-fg">
                          {video.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-site-muted">
                          {formatDate(video.publishedAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
