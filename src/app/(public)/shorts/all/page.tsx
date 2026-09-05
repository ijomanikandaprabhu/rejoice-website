import Link from 'next/link';

import { CtaPanel } from '@/components/site/CtaPanel';
import { Pagination } from '@/components/site/Pagination';
import { BackButton } from '@/components/site/Section';
import { ShortsGrid } from '@/components/site/ShortsGrid';
import { SiteSearchField } from '@/components/site/SiteSearchField';
import { pageSizes } from '@/config/app.config';
import { ctaPanels } from '@/config/content.config';
import { getMusicVideos } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';

/**
 * Every Short, paged and searchable.
 *
 * `/shorts` is the feed — the way a Short is watched — and it holds the newest
 * sixty. This is the page that copes with all six hundred, so it searches on
 * the server and pages at sixty, exactly as `/songs/all` does.
 *
 * NO NEW QUERY. `getMusicVideos` already takes `shortsOnly`, and with no
 * `channel` alongside it that is precisely "every Short from every channel",
 * newest first, with search across both title columns. Writing a second query
 * here would be a second place for the visibility rule to drift.
 *
 * IT SITS IN `(public)`, NOT `(immersive)` — the feed's group is full-height
 * with no footer, which is right for a player and wrong for a listing that
 * pages. The route group has no effect on the URL, so `/shorts` and
 * `/shorts/all` remain neighbours despite the different layouts.
 */

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'All Shorts',
  description: 'Every vertical release from Rejoice Gospel Communications.',
  path: '/shorts/all',
});

type SearchParams = { q?: string; page?: string };

export default async function AllShortsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = (searchParams.q ?? '').trim();
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);

  const { videos, total, pageCount } = await getMusicVideos({
    q: query,
    page,
    perPage: pageSizes.shortsAll,
    shortsOnly: true,
  });

  /** Paging must carry the search with it, or page 2 silently drops the query. */
  const hrefFor = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (n > 1) params.set('page', String(n));
    const qs = params.toString();
    return qs ? `/shorts/all?${qs}` : '/shorts/all';
  };

  return (
    <>
      <section className="container-page pb-16 pt-8 sm:pb-20 sm:pt-10">
        <BackButton href="/shorts" label="Short Takes" ariaLabel="Back to the Shorts feed" />

        <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
          <h1 className="t-h1">All Shorts</h1>

          <SiteSearchField
            id="shorts-search"
            query={query}
            basePath="/shorts/all"
            label="Search Shorts"
            placeholder="Search Shorts"
            controls="shorts-results"
            className="w-full sm:max-w-sm"
          />
        </div>

        <div id="shorts-results" className="mt-10">
          {videos.length === 0 ? (
            <p className="py-10 text-center text-sm text-site-muted">
              {query ? (
                <>
                  Nothing matches that.{' '}
                  <Link href="/shorts/all" className="text-site-accent underline underline-offset-4">
                    Clear the search
                  </Link>{' '}
                  to see everything.
                </>
              ) : (
                'Nothing published yet.'
              )}
            </p>
          ) : (
            <ShortsGrid videos={videos} />
          )}
        </div>

        {pageCount > 1 ? (
          <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} className="mt-12" />
        ) : null}

        {/* The count is here rather than under the heading, where a "603
            Shorts" line would be the first thing read on a page whose grid says
            the same thing. Under a pager it answers "how far does this go". */}
        {total > 0 ? (
          <p className="mt-6 text-center text-xs text-site-muted">
            {total.toLocaleString()} Short{total === 1 ? '' : 's'}
            {query ? ' matching your search' : ''}
          </p>
        ) : null}
      </section>

      <div className="container-page pb-14 sm:pb-20">
        <CtaPanel {...ctaPanels.music} />
      </div>
    </>
  );
}
