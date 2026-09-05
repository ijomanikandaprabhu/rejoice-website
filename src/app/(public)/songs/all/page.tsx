import Link from 'next/link';

import { CtaPanel } from '@/components/site/CtaPanel';
import { Pagination } from '@/components/site/Pagination';
import { BackButton } from '@/components/site/Section';
import { SiteSearchField } from '@/components/site/SiteSearchField';
import { SongGrid } from '@/components/site/SongGrid';
import { pageSizes } from '@/config/app.config';
import { ctaPanels } from '@/config/content.config';
import { listPublicSongsPage } from '@/features/songs/queries';
import { buildMetadata } from '@/lib/seo';

/**
 * Every song, paged and searchable.
 *
 * `/songs` shows the newest thirty and links here; this is the page that has to
 * cope with the whole catalogue, so it pages at sixty and searches on the
 * server. Same shape as a channel page, and the same `Pagination` and
 * `SiteSearchField` behind it.
 *
 * THIS ROUTE SITS WHERE A SONG SLUG WOULD. Next gives a static segment priority
 * over `[slug]`, so a song called "All" would lose its address entirely —
 * `uniqueSlug` refuses the word for that reason.
 */

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'All songs',
  description: 'Every release from Rejoice Gospel Communications, and where to hear it.',
  path: '/songs/all',
});

type SearchParams = { q?: string; page?: string };

export default async function AllSongsPage({ searchParams }: { searchParams: SearchParams }) {
  const query = (searchParams.q ?? '').trim();
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);
  const take = pageSizes.songsAll;

  const { rows: songs, total } = await listPublicSongsPage({
    q: query,
    skip: (page - 1) * take,
    take,
  });

  const pageCount = Math.max(1, Math.ceil(total / take));

  /** Paging must carry the search with it, or page 2 silently drops the query. */
  const hrefFor = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (n > 1) params.set('page', String(n));
    const qs = params.toString();
    return qs ? `/songs/all?${qs}` : '/songs/all';
  };

  return (
    <>
      <section className="container-page pb-16 pt-8 sm:pb-20 sm:pt-10">
        <BackButton href="/songs" label="Songs" ariaLabel="Back to songs" />

        <div className="mt-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="t-h1">All songs</h1>
            <p className="mt-3 text-body text-site-muted">
              {total === 0
                ? 'Nothing to show yet.'
                : `${total.toLocaleString()} release${total === 1 ? '' : 's'}`}
              {query ? ` matching “${query}”` : ''}
            </p>
          </div>

          <SiteSearchField
            id="songs-search"
            query={query}
            basePath="/songs/all"
            label="Search songs"
            placeholder="Search songs"
            controls="songs-results"
            className="w-full sm:max-w-sm"
          />
        </div>

        <div id="songs-results" className="mt-10">
          {songs.length === 0 ? (
            <p className="py-10 text-center text-sm text-site-muted">
              {query ? (
                <>
                  Nothing matches that.{' '}
                  <Link href="/songs/all" className="text-site-accent underline underline-offset-4">
                    Clear the search
                  </Link>{' '}
                  to see everything.
                </>
              ) : (
                'The releases are on their way.'
              )}
            </p>
          ) : (
            <SongGrid songs={songs} />
          )}
        </div>

        {pageCount > 1 ? (
          <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} className="mt-12" />
        ) : null}
      </section>

      <div className="container-page pb-14 sm:pb-20">
        <CtaPanel {...ctaPanels.music} />
      </div>
    </>
  );
}
