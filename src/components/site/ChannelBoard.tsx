'use client';

import Image from 'next/image';
import * as React from 'react';

import { SeeMoreFromChannel } from '@/components/site/Section';
import { VideoTile } from '@/components/site/VideoTile';
import type { getChannelsWithVideos } from '@/features/youtube/queries';
import { cn } from '@/lib/utils';

type Channel = Awaited<ReturnType<typeof getChannelsWithVideos>>[number];

/**
 * How many videos follow the big one: three columns by six rows. Kept in step
 * with the `lg:grid-cols-3` below — a cap that is not a multiple of the column
 * count leaves a ragged part-row at the end. "See more" carries on past it.
 */
const GRID_SIZE = 18;

/**
 * Channel circles over that channel's releases.
 *
 *     ( o ) ( o ) ( o )
 *   [   big — newest upload   ]
 *   [ tile ][ tile ][ tile ][ tile ]   <- continues in the same date order
 *            ( See more )
 *
 * The big card and the grid are ONE ordered list, not two selections: the
 * channel's videos come back newest-first, the first becomes the big card and
 * the rest flow into the grid. So the date order runs unbroken across the
 * boundary between them.
 *
 * Switching channel only re-renders from data the page already loaded — no
 * refetch.
 */
export function ChannelBoard({ channels }: { channels: Channel[] }) {
  const withVideos = channels.filter((channel) => channel.videos.length > 0);
  const [active, setActive] = React.useState(0);

  if (withVideos.length === 0) return null;

  // Guards against an index left over from a channel that has dropped out.
  const index = Math.min(active, withVideos.length - 1);
  const channel = withVideos[index];
  const [latest, ...rest] = channel.videos;
  const grid = rest.slice(0, GRID_SIZE);

  return (
    <section aria-label="Releases by channel">
      {/*
       * Buttons with `aria-pressed`, deliberately not an ARIA `tablist` — that
       * role carries a contract (roving focus, arrow-key movement) and a
       * half-built tab widget behaves worse for a keyboard user than plain
       * buttons. Same call as `ChannelSpotlight` on the homepage.
       */}
      <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
        {withVideos.map((item, i) => {
          const isActive = i === index;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(i)}
              aria-pressed={isActive}
              className={cn(
                'group shrink-0 rounded-pill transition-opacity duration-300',
                isActive ? 'opacity-100' : 'opacity-50 hover:opacity-90',
              )}
            >
              <span
                className={cn(
                  'relative block size-16 overflow-hidden rounded-pill border-2 bg-site-surface transition-colors duration-300 sm:size-20',
                  isActive
                    ? 'border-site-accent shadow-ember'
                    : 'border-white/10 group-hover:border-white/25',
                )}
              >
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt="" fill sizes="80px" className="object-cover" />
                ) : null}
              </span>
              <span className="sr-only">{item.name}</span>
            </button>
          );
        })}
      </div>

      {/* The name of whichever avatar is selected. No release count: the board
          is a way in to the videos, not a place to report totals. */}
      <p className="mt-4 text-center text-sm text-site-fg">{channel.name}</p>

      {/*
       * No `max-w-4xl`: capped at 896px inside a 1088px container, the big card
       * sat 96px in from the grid below it and nothing shared an edge. Full
       * container width puts both on the same column.
       *
       * KEYED ON THE CHANNEL so switching remounts these and replays the
       * entrance animation — otherwise the content swaps silently and the
       * change is easy to miss.
       */}
      {latest ? (
        <div key={`${channel.id}-lead`} className="mt-8">
          <VideoTile video={latest} size="big" />
        </div>
      ) : null}

      {grid.length > 0 ? (
        <div
          key={`${channel.id}-grid`}
          // 3 across from `sm` up; ONE on a phone. Two columns there left each
          // tile about 160px wide and every title truncated after two words.
          className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3"
        >
          {grid.map((video, i) => (
            <VideoTile key={video.id} video={video} size="small" index={i + 1} />
          ))}
        </div>
      ) : null}

      <SeeMoreFromChannel slug={channel.slug} name={channel.name} />
    </section>
  );
}
