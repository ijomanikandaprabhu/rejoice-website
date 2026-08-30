'use client';

import { Search, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { YouTubeIcon } from '@/components/common/YouTubeIcon';
import { ChannelDetailsDialog } from '@/components/site/ChannelDetailsDialog';
import { Pagination } from '@/components/site/Pagination';
import { BackButton, EmptyPanel } from '@/components/site/Section';
import { VideoTile } from '@/components/site/VideoTile';
import type { VideoCardData } from '@/features/youtube/queries';
import { cn } from '@/lib/utils';

type Channel = {
  id: string;
  name: string;
  url: string;
  thumbnail: string | null;
  description: string | null;
};

type Props = {
  channel: Channel;
  /**
   * The channel's canonical URL segment, resolved by the page.
   *
   * Passed in rather than derived here: the page owns the `handle ?? id` rule
   * and redirects anything else to it. These links used `channel.id`, which is
   * NOT canonical when a handle exists — so every page link 308'd to the handle
   * and lost its `?page`, putting you back on page 1.
   */
  slug: string;
  /** The current page of releases, newest first. */
  videos: VideoCardData[];
  /** The search currently applied, straight from `?q=`. */
  query: string;
  /** Matches for the current query, or the channel total when not searching. */
  total: number;
  page: number;
  pageCount: number;
};

/**
 * The searchable body of a channel page: the search box, the grid and the
 * pagination.
 *
 * Search runs on the SERVER and lives in the URL as `?q=`.
 *
 * It used to filter an index of up to 500 videos in the browser, which is why
 * it could only ever cover the most recent 500 of a 1,053-video channel — and
 * why every visitor downloaded those 500 records unasked. Now the grid always
 * shows whatever the server returned, searched or not, and results paginate
 * like any other listing.
 *
 * The box follows the three rules `admin/SearchField` already proved:
 * debounced so it is not a request per keystroke, `replace` rather than `push`
 * so Back does not walk the query letter by letter, and `page` dropped because
 * page 12 of the previous query means nothing for the new one.
 */

/** Pause after typing stops before the URL is rewritten. */
const SEARCH_DEBOUNCE_MS = 350;

export function ChannelPageBody({
  channel,
  slug,
  videos,
  query,
  total,
  page,
  pageCount,
}: Props) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  /*
   * The box is local so typing stays instant; the URL is the source of truth
   * and catches up after the debounce. `applied` tracks what the URL already
   * says so we never navigate to where we already are.
   */
  const [value, setValue] = React.useState(query);
  const applied = React.useRef(query);

  // The URL can change from elsewhere — Clear, or a paginated link. Follow it.
  React.useEffect(() => {
    applied.current = query;
    setValue(query);
  }, [query]);

  const push = React.useCallback(
    (next: string) => {
      if (next === applied.current) return;
      applied.current = next;
      const params = new URLSearchParams();
      if (next) params.set('q', next);
      // `page` deliberately dropped: a new query has its own page count.
      const qs = params.toString();
      router.replace(`/creations/${slug}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, slug],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => push(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, push]);

  const searching = query.length > 0;
  const results = videos;

  const clear = () => {
    setValue('');
    push('');
    inputRef.current?.focus();
  };

  return (
    <>
      {/*
       * One flex container, ordered differently at the two sizes.
       *
       *   phone            desktop
       *   ─────            ───────
       *   ←                ←  [search]      [details] [YouTube]
       *   logo + name           logo + name  (wrapped onto its own row)
       *   [search]
       *   [details]
       *   [YouTube]
       *
       * `order` does the rearranging, so the markup can stay in reading order
       * (heading first) while each layout puts things where they belong.
       * `lg:flex-wrap` plus `lg:w-full` on the identity is what gives desktop
       * its second row without a second container.
       */}
      <header className="flex flex-col gap-6 lg:flex-row lg:flex-wrap lg:items-center lg:gap-6">
        {/*
         * The identity. FIRST IN THE MARKUP so the page heading is what a
         * screen reader meets first, on either layout; where it sits visually
         * is left to `order`. On a phone that is directly under the back
         * button; on desktop `lg:w-full` makes it wrap onto its own second row
         * beneath the search.
         *
         * No `truncate` — with a row to itself the name fits at 1440 and wraps
         * rather than clipping on a phone.
         */}
        <div className="order-2 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center lg:order-4 lg:mt-10 lg:w-full">
          {channel.thumbnail ? (
            <Image
              src={channel.thumbnail}
              alt=""
              width={64}
              height={64}
              className="size-16 shrink-0 rounded-pill object-cover"
            />
          ) : (
            <span className="grid size-16 shrink-0 place-items-center rounded-pill bg-site-accent text-2xl font-semibold text-site-fg">
              {channel.name.charAt(0)}
            </span>
          )}

          <h1 className="t-h2 text-site-fg">{channel.name}</h1>
        </div>

        {/* Bare icon here: it sits in a header row beside the search box, where
            a label would crowd the line. The video page renders the same button
            WITH a label, since there it stands alone. */}
        <BackButton href="/creations" ariaLabel="Back to creations" className="order-1 lg:order-1" />

        <div className="relative order-3 w-full lg:order-2 lg:max-w-xl lg:flex-1">
          <label htmlFor="channel-search" className="sr-only">
            Search this channel
          </label>
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-site-muted"
          />
          <input
            id="channel-search"
            ref={inputRef}
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search this channel"
            // Tells a screen reader which region updates as the value changes.
            aria-controls="channel-results"
            className={cn(
              'h-11 w-full rounded-pill border border-white/10 bg-site-surface pl-11 pr-11 text-sm text-site-fg',
              // Focus is a soft accent edge with a diffuse warm glow. A full-strength
              // border AND a 1px accent ring used to stack here — two solid orange
              // lines with no gap between them, which read as one thick stroke.
              // The global `body :focus-visible` outline is untouched, so keyboard
              // focus still gets the site's standard indicator.
              'placeholder:text-site-muted focus:border-site-accent/60 focus:shadow-[0_0_0_4px_rgba(255,109,41,0.12)] focus:outline-none',
              // The browser's own search clear button would sit beside ours.
              '[&::-webkit-search-cancel-button]:hidden',
            )}
          />
          {value.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-pill text-site-muted transition-colors hover:text-site-fg"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">Clear search</span>
            </button>
          ) : null}
        </div>

        {/* One main action and one secondary, rather than two identical
            outlines: `btn-primary` is the filled accent, so the outbound link
            reads as the stronger of the two.

            On a phone they stack full width — side by side they were half a
            narrow screen each, which left "Visit on YouTube" cramped. */}
        <div className="order-4 flex w-full flex-col gap-3 whitespace-nowrap sm:w-auto sm:flex-row sm:items-center lg:order-3 lg:ml-auto">
          <ChannelDetailsDialog channel={channel} className="w-full sm:w-auto" />
          <a
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary w-full px-5 text-sm sm:w-auto sm:shrink-0"
          >
            <YouTubeIcon />
            Visit on YouTube
          </a>
        </div>
      </header>

      <div id="channel-results" className="mt-12" aria-live="polite">
        {searching ? (
          <p className="mb-6 text-center text-sm text-site-muted">
            <span className="tabular-nums text-site-accent">{total}</span> release
            {total === 1 ? '' : 's'} match “{query}”
          </p>
        ) : null}

        {results.length === 0 ? (
          searching ? (
            <p className="py-10 text-center text-sm text-site-muted">
              Nothing matches that.{' '}
              <button
                type="button"
                onClick={clear}
                className="text-site-accent underline underline-offset-4"
              >
                Clear the search
              </button>{' '}
              to see everything.
            </p>
          ) : (
            <EmptyPanel
              title="Nothing published yet"
              description="Videos approved in the admin portal appear here."
            />
          )
        ) : (
          // The same columns as the Channels page board, so the two line up.
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {results.map((video, i) => (
              <VideoTile key={video.id} video={video} size="small" index={i} />
            ))}
          </div>
        )}
      </div>

      {/* Shown during a search too: server-side results paginate like any other
          listing, so the query has to ride along in the links. */}
      {pageCount > 1 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          hrefFor={(n) => {
            const params = new URLSearchParams();
            if (query) params.set('q', query);
            if (n > 1) params.set('page', String(n));
            const qs = params.toString();
            return `/creations/${slug}${qs ? `?${qs}` : ''}`;
          }}
          className="mt-14"
        />
      ) : null}
    </>
  );
}
