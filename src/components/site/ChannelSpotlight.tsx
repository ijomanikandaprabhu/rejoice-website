'use client';

import { useInView, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import { LazyYouTubeEmbed } from '@/components/youtube/LazyYouTubeEmbed';
import type { getChannelsWithVideos } from '@/features/youtube/queries';
import { cn } from '@/lib/utils';

type Channel = Awaited<ReturnType<typeof getChannelsWithVideos>>[number];

/**
 * A row of channel avatars over a single video.
 *
 *     [ o  o  o  o ]
 *     +------------+
 *     |            |   one video: the selected channel's most recent
 *     +------------+
 *
 * The box holds exactly one video and nothing else — no queue beside it and no
 * grid beneath. Picking a circle replaces that one video. (`FeaturedPlayer`
 * pairs a lead with a three-item queue; that is a different thing and is not
 * used here.)
 *
 * Renders nothing below two channels. One avatar is not a switcher, so rather
 * than show a control with nothing to choose, the section waits until a second
 * channel is connected in the admin and then appears on its own — the same way
 * `ChannelRails` stays away until a channel has an approved video.
 */
export function ChannelSpotlight({
  channels,
  heading,
}: {
  channels: Channel[];
  /** Empty hides it, the same convention the other homepage headings follow. */
  heading?: string;
}) {
  /*
   * `videos[0]` rather than a sort: `getChannelsWithVideos` already orders
   * newest-first, so the first entry is the channel's most recent video. This
   * reads the site's own ordering instead of re-sorting by date here.
   */
  const withVideos = channels.filter((channel) => channel.videos.length > 0);

  const [active, setActive] = useState(0);

  /*
   * Advances every 5s, then stops for good the moment anyone touches the
   * section.
   *
   * `paused` is never cleared, and that is the point rather than politeness.
   * The player below is mounted with `key={video.id}` — see the note there —
   * so an auto-advance mid-watch would REMOUNT it and kill the video someone
   * is actually watching. Capturing pointerdown catches the avatar buttons and
   * the play button alike.
   *
   * Also parked off-screen, and under `prefers-reduced-motion`: content that
   * auto-updates for more than five seconds needs a way to stop, and honouring
   * the preference plus stopping on interaction is that way.
   */
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { margin: '-20% 0px' });
  const reduceMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);

  const count = withVideos.length;

  useEffect(() => {
    if (paused || reduceMotion || !inView || count < 2) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % count), 5000);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, inView, count]);

  if (withVideos.length < 2) return null;

  // Guards against an index left over from a channel that has since dropped out.
  const channel = withVideos[Math.min(active, withVideos.length - 1)];
  const video = channel.videos[0];

  return (
    <section
      ref={sectionRef}
      onPointerDownCapture={() => setPaused(true)}
      className="container-page pt-24"
    >
      {heading ? <h2 className="t-h2 mb-10 text-center sm:mb-12">{heading}</h2> : null}

      <div className="flex justify-center gap-4 sm:gap-6">
        {withVideos.map((item, index) => {
          const isActive = index === Math.min(active, withVideos.length - 1);

          return (
            /*
             * Buttons with `aria-pressed`, deliberately not an ARIA `tablist`.
             * That role carries a contract — roving focus, arrow-key movement —
             * and a half-built tab widget behaves worse for a keyboard user
             * than plain buttons that do exactly what they appear to do.
             *
             * The channel name is the accessible name; an avatar on its own
             * gives a screen reader nothing to announce.
             */
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={isActive}
              className={cn(
                'group relative shrink-0 rounded-pill transition-opacity duration-300',
                isActive ? 'opacity-100' : 'opacity-50 hover:opacity-90',
              )}
            >
              <span
                className={cn(
                  'relative block size-16 overflow-hidden rounded-pill border-2 bg-site-surface transition-colors duration-300 sm:size-20 lg:size-24',
                  isActive
                    ? 'border-site-accent shadow-ember'
                    : 'border-white/10 group-hover:border-white/25',
                )}
              >
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt="" fill sizes="96px" className="object-cover" />
                ) : null}
              </span>
              <span className="sr-only">{item.name}</span>
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-8 max-w-4xl sm:mt-10">
        {/*
         * Keyed by video id so switching channels mounts a fresh player. Without
         * the key React reuses the element and a video already playing keeps
         * playing — the previous channel's audio running under the new
         * channel's selection.
         */}
        <LazyYouTubeEmbed
          key={video.id}
          youtubeVideoId={video.youtubeVideoId}
          title={video.title}
          thumbnail={video.thumbnail}
        />
      </div>
    </section>
  );
}
