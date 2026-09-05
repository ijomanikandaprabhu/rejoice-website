'use client';

import Image from 'next/image';
import Link from 'next/link';
import * as React from 'react';

import { YouTubeIcon } from '@/components/common/YouTubeIcon';
import { ChannelDetailsDialog } from '@/components/site/ChannelDetailsDialog';
import { Pagination } from '@/components/site/Pagination';
import { BackButton, EmptyPanel } from '@/components/site/Section';
import { SiteSearchField } from '@/components/site/SiteSearchField';
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

export function ChannelPageBody({
  channel,
  slug,
  videos,
  query,
  total,
  page,
  pageCount,
}: Props) {
  const searching = query.length > 0;
  const results = videos;

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

        <SiteSearchField
          id="channel-search"
          query={query}
          basePath={`/creations/${slug}`}
          label="Search this channel"
          placeholder="Search this channel"
          controls="channel-results"
          className="order-3 w-full lg:order-2 lg:max-w-xl lg:flex-1"
        />

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
              {/*
                * A link rather than a button now that the search box owns its
                * own state: navigating to the page without `?q=` IS clearing
                * the search, and the box follows the URL.
                */}
              <Link
                href={`/creations/${slug}`}
                className="text-site-accent underline underline-offset-4"
              >
                Clear the search
              </Link>{' '}
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
