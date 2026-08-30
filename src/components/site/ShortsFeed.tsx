'use client';

import { ChevronDown, ChevronUp, LayoutGrid, Play, Volume2, VolumeX } from 'lucide-react';
import Image from 'next/image';
import * as React from 'react';

import { ShareButton } from '@/components/site/ShareButton';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { VideoCardData } from '@/features/youtube/queries';
import { cn } from '@/lib/utils';
import { EMBED_ORIGIN, embedUrl } from '@/lib/utils/videoDisplay';

/**
 * How many items either side of the active one keep a live player.
 *
 * One. Two was tried, to give the next player more time to boot, and it made
 * things worse: with five frames mounted only 3 of 20 videos ever reached
 * `playing`, the rest cycling buffering → unstarted → buffering. They were
 * competing for bandwidth. Preloading is only worth it while the preloaded
 * frames stay cheap — see `autoplayAtMount`.
 */
const NEIGHBOURS = 1;

/**
 * A vertical feed of Shorts that plays as you scroll, like YouTube's own.
 *
 * ## Autoplay, and the one thing it cannot do
 *
 * The video starts on its own. The SOUND does not: browsers refuse autoplay
 * with audio, and youtube.com only escapes that because the browser grants
 * autoplay permission to sites the visitor uses heavily. A third-party embed
 * gets no such grant, so the player must start `mute=1` or it will not start at
 * all.
 *
 * Audio is then switched on at the earliest moment the platform allows — the
 * visitor's first click, tap or key press anywhere on the page — rather than
 * waiting for them to find the control. Scrolling is deliberately NOT treated
 * as that gesture: Chrome does not count it, so unmuting on scroll would flip
 * this component's state while the player stayed silent, and the toggle would
 * then be lying about what the visitor can hear.
 *
 * ## Why only three players exist
 *
 * Every item rendering its own iframe would mean one YouTube player per Short —
 * twenty-odd of them, each loading its own scripts. Only the active item and its
 * immediate neighbours mount a player; everything else is a poster image. That
 * also removes the need to pause anything: moving away unmounts the iframe,
 * which stops playback by definition.
 *
 * Reduced motion gets posters and a play button instead, opting in by hand.
 * Autoplay is motion that the global rule in globals.css cannot reach, since it
 * covers CSS `animation-*`/`transition-*` only.
 */
export function ShortsFeed({ videos }: { videos: VideoCardData[] }) {
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const itemRefs = React.useRef<(HTMLElement | null)[]>([]);
  const frameRefs = React.useRef<(HTMLIFrameElement | null)[]>([]);
  /*
   * Whether a given video's frame was mounted as the ACTIVE item, decided once
   * and remembered. Only that frame gets `autoplay` in its URL; neighbours boot
   * the player shell without fetching any video data, and are started by
   * command if the visitor reaches them.
   *
   * A ref, not state, because this must NOT be recomputed per render: `autoplay`
   * lives in the `src`, and a changed `src` remounts the iframe — reloading the
   * player and restarting the video mid-watch.
   */
  const autoplayAtMount = React.useRef<Map<string, boolean>>(new Map());
  /** The last command sent to each frame, so it is not sent repeatedly. */
  const lastCommand = React.useRef<string[]>([]);
  const [active, setActive] = React.useState(0);
  const [view, setView] = React.useState<'feed' | 'grid'>('feed');
  /*
   * Which video to land on when coming back from the grid.
   *
   * The feed UNMOUNTS in grid mode, taking `itemRefs` with it, so the target
   * cannot be scrolled to at click time — the element does not exist yet. It is
   * parked here and consumed by an effect once the feed has remounted.
   */
  const [pending, setPending] = React.useState<number | null>(null);
  const [muted, setMuted] = React.useState(true);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  // Reduced-motion visitors opt a single item in by pressing play.
  const [optedIn, setOptedIn] = React.useState<number | null>(null);
  /*
   * Players mount only after hydration. The embed URL carries this page's
   * `origin`, which the server cannot know, so rendering an iframe during SSR
   * would produce a different `src` on the client and a hydration mismatch.
   * Posters render first either way, which is the cheaper first paint.
   */
  const [origin, setOrigin] = React.useState<string | null>(null);
  React.useEffect(() => setOrigin(window.location.origin), []);

  /*
   * Which players have actually started. Until a player reports playing, its
   * poster stays over the top of it — otherwise the artwork is swapped out for
   * a black rectangle the moment an item goes live, and the visitor stares at
   * nothing for the whole of YouTube's boot. That gap is what reads as "slow".
   */
  const [ready, setReady] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin.includes('youtube')) return;
      try {
        const data = JSON.parse(String(event.data));
        const id = data?.info?.videoData?.video_id;
        if (data?.info?.playerState === 1 && id) {
          setReady((current) => (current.has(id) ? current : new Set(current).add(id)));
        }
      } catch {
        // Not a player message. YouTube also posts strings that are not JSON.
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(query.matches);
    const onChange = () => setReduceMotion(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  /* Which item is on screen. Rooted on the scroller, not the viewport. */
  React.useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (!Number.isNaN(index)) setActive(index);
        }
      },
      { root, threshold: 0.6 },
    );

    for (const el of itemRefs.current) if (el) observer.observe(el);
    return () => observer.disconnect();
    /*
     * `view` is a dependency because the feed UNMOUNTS in grid mode. Without it
     * the observer would be built once against the original scroller, torn down
     * on the way to the grid and never rebuilt — so `active` would silently stop
     * tracking after the first trip there and back.
     */
  }, [videos.length, view]);

  /*
   * Audio on at the first qualifying gesture. `once` on both listeners, and
   * each removes the other, so this can only ever fire a single time.
   */
  React.useEffect(() => {
    if (reduceMotion) return;

    const unmute = () => {
      setMuted(false);
      window.removeEventListener('pointerdown', unmute);
      window.removeEventListener('keydown', unmute);
    };

    window.addEventListener('pointerdown', unmute, { once: true });
    window.addEventListener('keydown', unmute, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unmute);
      window.removeEventListener('keydown', unmute);
    };
  }, [reduceMotion]);

  /*
   * Everything below drives the players by COMMAND rather than by changing
   * their `src`. Recomputing the URL per render would rewrite `src`, and a
   * changed `src` remounts the iframe — reloading the player and restarting the
   * video mid-watch. So the URL is fixed at mount and never varies.
   */
  const command = React.useCallback((index: number, func: string) => {
    frameRefs.current[index]?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args: [] }),
      EMBED_ORIGIN,
    );
  }, []);

  /*
   * A player says nothing until subscribed to. Without this handshake the
   * `ready` set above would never fill and the posters would never lift.
   */
  const listen = React.useCallback((index: number) => {
    frameRefs.current[index]?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: index, channel: 'widget' }),
      EMBED_ORIGIN,
    );
  }, []);

  /*
   * Exactly one player runs. The neighbours stay mounted so scrolling is
   * instant, but they are paused — three players at once was audible and
   * wasteful.
   *
   * Also the mute rule: only the item on screen follows the toggle, and every
   * other frame is force-muted. A paused frame that was left unmuted would
   * start making noise the moment anything resumed it.
   */
  const syncPlayback = React.useCallback(() => {
    frameRefs.current.forEach((frame, i) => {
      if (!frame) return;

      const wanted = i === active ? `play:${muted ? 'muted' : 'loud'}` : 'pause';
      // Repeating a command is not free: pausing a frame that was still
      // buffering knocked it back to unstarted, and it would begin again.
      if (lastCommand.current[i] === wanted) return;
      lastCommand.current[i] = wanted;

      if (i === active) {
        command(i, 'playVideo');
        command(i, muted ? 'mute' : 'unMute');
      } else {
        command(i, 'pauseVideo');
        command(i, 'mute');
      }
    });
  }, [active, muted, command]);

  React.useEffect(() => {
    syncPlayback();
  }, [syncPlayback]);

  const goTo = React.useCallback(
    (index: number, smooth = true) => {
      const el = itemRefs.current[index];
      if (el)
        el.scrollIntoView({ behavior: !smooth || reduceMotion ? 'auto' : 'smooth', block: 'start' });
    },
    [reduceMotion],
  );

  React.useEffect(() => {
    if (view !== 'feed' || pending === null) return;
    // Jump rather than glide: this is a view change, not a step through the
    // feed, and animating past 40 items would look like a fault.
    goTo(pending, false);
    setActive(pending);
    setPending(null);
  }, [view, pending, goTo]);

  const openAt = (index: number) => {
    setPending(index);
    setView('feed');
  };

  if (videos.length === 0) return null;

  if (view === 'grid') {
    return (
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <ul className="grid grid-cols-2 gap-3 pb-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {videos.map((video, i) => (
            <li key={video.id}>
              {/*
               * A BUTTON, not a link.
               *
               * Shorts have no page of their own — `/videos/{id}` 404s them on
               * purpose — so a grid of links would be 60 routes to a 404. This
               * opens the feed at that video instead, which is where a Short is
               * watched.
               */}
              <button
                type="button"
                onClick={() => openAt(i)}
                className="group block w-full text-left"
              >
                <span className="relative block aspect-[9/16] overflow-hidden rounded-card bg-black">
                  <Image
                    src={video.thumbnail}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/30">
                    <Play className="size-8 fill-white text-white opacity-0 transition-opacity group-hover:opacity-100" />
                  </span>
                </span>
                <span className="mt-2 line-clamp-2 block text-sm text-white/80">{video.title}</span>
              </button>
            </li>
          ))}
        </ul>

        {/* The stack collapses to one control here: mute, previous and next all
            describe a feed, and mean nothing over a grid. */}
        <div className="fixed right-2 top-1/2 flex -translate-y-1/2 flex-col gap-3 sm:right-6">
          <FeedButton
            onClick={() => setView('feed')}
            label="Back to feed"
            icon={<Play className="size-5" />}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollerRef}
        /*
         * Fills whatever the page's flex column leaves it. `min-h-0` on the
         * wrapper is what makes that work — a flex child defaults to
         * `min-height: auto`, which refuses to shrink below its content and
         * would push the feed past the fold.
         */
        className="no-scrollbar h-full snap-y snap-mandatory overflow-y-auto overscroll-contain"
      >
        {videos.map((video, i) => {
          const live =
            origin !== null && (!reduceMotion ? Math.abs(i - active) <= NEIGHBOURS : optedIn === i);
          // Poster lifts only when this player has actually started.
          const playing = live && ready.has(video.youtubeVideoId);

          /*
           * Fixed the first time this frame mounts and reused thereafter, so
           * the URL never changes underneath a running player.
           */
          if (live && !autoplayAtMount.current.has(video.youtubeVideoId)) {
            autoplayAtMount.current.set(video.youtubeVideoId, i === active);
          }
          const autoplayForFrame = autoplayAtMount.current.get(video.youtubeVideoId) ?? false;

          return (
            <section
              key={video.id}
              data-index={i}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="flex h-full snap-start items-center justify-center py-4"
            >
              <div className="relative h-full max-h-full overflow-hidden rounded-card bg-black [aspect-ratio:9/16]">
                {live ? (
                  <iframe
                    src={embedUrl(video.youtubeVideoId, {
                      autoplay: autoplayForFrame,
                      mute: true,
                      loop: true,
                      playsinline: true,
                      enablejsapi: true,
                      origin: origin ?? undefined,
                    })}
                    title={video.title}
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 size-full"
                    ref={(el) => {
                      frameRefs.current[i] = el;
                    }}
                    /*
                     * A newly mounted neighbour loads with `autoplay=1` and
                     * would start on its own; this pauses it as soon as it is
                     * able to listen. It is off-screen and muted, so the frame
                     * or two before this lands is neither seen nor heard.
                     */
                    onLoad={() => {
                      listen(i);
                      syncPlayback();
                    }}
                  />
                ) : null}

                {/*
                 * The poster sits OVER the player and lifts only once that
                 * player reports playing. Swapping it out the moment an item
                 * went live left a black rectangle for the whole of YouTube's
                 * boot — a few hundred milliseconds at best — which is what
                 * read as the feed being slow to load.
                 *
                 * `pointer-events-none` once it is on its way out, so it never
                 * swallows a click meant for the player underneath.
                 */}
                <div
                  aria-hidden={playing ? 'true' : undefined}
                  className={cn(
                    'absolute inset-0 transition-opacity duration-500',
                    playing ? 'pointer-events-none opacity-0' : 'opacity-100',
                  )}
                >
                  <Image
                    src={video.thumbnail}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 40vw, 100vw"
                    className="object-cover"
                    priority={i === 0}
                  />
                  {reduceMotion && !live ? (
                    <button
                      type="button"
                      onClick={() => setOptedIn(i)}
                      className="absolute inset-0 grid place-items-center bg-black/40"
                    >
                      <span className="grid size-16 place-items-center rounded-pill bg-site-accent shadow-ember">
                        <svg viewBox="0 0 24 24" className="ml-1 size-7 fill-white" aria-hidden>
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </span>
                      <span className="sr-only">Play {video.title}</span>
                    </button>
                  ) : null}
                </div>

                {/* The only place the title is readable while the feed plays.
                    Not a link: a Short has no page of its own to open. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-4 pt-12">
                  <p className="line-clamp-2 text-sm font-medium text-white">{video.title}</p>
                  <p className="mt-1 text-xs text-white/70">{video.channel.name}</p>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Sound and step controls, clear of the player's own chrome. */}
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-3 sm:right-6">
        <FeedButton
          onClick={() => setMuted((m) => !m)}
          label={muted ? 'Unmute' : 'Mute'}
          icon={muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        />
        <FeedButton
          onClick={() => goTo(active - 1)}
          disabled={active === 0}
          label="Previous short"
          icon={<ChevronUp className="size-5" />}
        />
        <FeedButton
          onClick={() => goTo(active + 1)}
          disabled={active === videos.length - 1}
          label="Next short"
          icon={<ChevronDown className="size-5" />}
        />
        <TooltipProvider delayDuration={200}>
          <ShareButton
            title={videos[active].title}
            url={origin ? `${origin}/videos/${videos[active].youtubeVideoId}` : undefined}
            className="size-11"
          />
        </TooltipProvider>
        <FeedButton
          onClick={() => setView('grid')}
          label="Grid view"
          icon={<LayoutGrid className="size-5" />}
        />
      </div>
    </div>
  );
}

function FeedButton({
  onClick,
  label,
  icon,
  disabled,
}: {
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'grid size-11 place-items-center rounded-pill border border-white/10 bg-black/60 text-white backdrop-blur-sm transition-colors',
        disabled ? 'opacity-30' : 'hover:border-white/30 hover:bg-black/80',
      )}
    >
      {icon}
    </button>
  );
}
