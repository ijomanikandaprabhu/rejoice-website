import { notFound, permanentRedirect } from 'next/navigation';

import { ChannelPageBody } from '@/components/site/ChannelPageBody';
import { pageSizes } from '@/config/app.config';
import { getMusicVideos, getPublicChannelBySlug } from '@/features/youtube/queries';
import { breadcrumbJsonLd, buildMetadata, collectionJsonLd, listingMetadata } from '@/lib/seo';

export const revalidate = 300;

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; q?: string }> };

export async function generateMetadata(props: Params) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const channel = await getPublicChannelBySlug(params.id);
  if (!channel) return buildMetadata({ title: 'Channel', path: `/creations/${params.id}` });

  return listingMetadata({
    title: channel.name,
    description: `Every ${channel.name} release published on the Rejoice website.`,
    // The canonical address is the handle, so an id-based visit still points
    // search engines at the one real URL. This channel runs to 36 pages, and
    // every one of them used to claim to be this first one — see
    // `listingMetadata`.
    basePath: `/creations/${channel.handle ?? channel.id}`,
    page: Math.max(Number(searchParams.page ?? '1') || 1, 1),
    query: searchParams.q?.trim() ?? '',
  });
}

/**
 * One channel: its releases, three across and ten deep.
 *
 * Stays a server component — data, metadata and the 404 live here, and only the
 * search box, the filtered grid and the details modal are client-side
 * (`ChannelPageBody`).
 *
 * The listing is not new work: `getMusicVideos` already accepted a `channel` id
 * and paginated on it, it simply now asks for 30 rows instead of the Music
 * page's 12.
 */
export default async function ChannelPage(props: Params) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);
  const q = searchParams.q?.trim() ?? '';

  const channel = await getPublicChannelBySlug(params.id);
  // Unknown handle or id, or a channel switched off in the admin: 404 rather
  // than an empty page that looks like the channel has no videos.
  if (!channel) notFound();

  /*
   * One canonical address per channel.
   *
   * The handle is the public segment; a database id resolves only so links
   * shared before this move keep working, and is redirected rather than served.
   * A channel with no handle keeps using its id, so an import that arrives
   * without one still works instead of 404ing.
   */
  const slug = channel.handle ?? channel.id;
  if (params.id !== slug) {
    /*
     * Carry the query across. `permanentRedirect` to a bare path DROPPED it,
     * so an inbound `/creations/{id}?page=5` — a bookmark, or an old shared
     * link — landed on page 1 with no sign anything had been lost.
     */
    const query = new URLSearchParams(
      Object.entries(searchParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
    ).toString();
    permanentRedirect(`/creations/${slug}${query ? `?${query}` : ''}`);
  }

  /*
   * Search runs HERE, not in the browser.
   *
   * This used to also fetch an index of up to 500 videos for `ChannelPageBody`
   * to filter client-side — which is why search only ever covered the most
   * recent 500 of this channel's 1,053, and why every visitor downloaded those
   * 500 records whether they searched or not.
   */
  const result = await getMusicVideos({
    channel: channel.id,
    q: q || undefined,
    page,
    perPage: pageSizes.channel,
  });

  return (
    <div className="container-page py-14 sm:py-20">
      {/*
        The channel's releases, described as the collection they are.

        Not on a search: a `?q=` page is already `noindex` (see
        `listingMetadata`), so describing a collection there would be markup
        addressed to nobody. Paged views ARE described — page 5 is a real,
        indexable slice, and `total` says how large the whole channel is so the
        thirty on screen never read as the whole of it.

        `about` names the YouTube channel this page mirrors, which is what ties
        the two together rather than leaving them as two similarly named places.
      */}
      {q ? null : (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              collectionJsonLd({
                name: page > 1 ? `${channel.name}, page ${page}` : channel.name,
                description: `Every ${channel.name} release published on the Rejoice website.`,
                path: page > 1 ? `/creations/${slug}?page=${page}` : `/creations/${slug}`,
                items: result.videos.map((video) => ({
                  name: video.title,
                  path: `/videos/${video.youtubeVideoId}`,
                })),
                total: result.total,
                about: {
                  name: channel.name,
                  url: channel.url,
                  description: channel.description,
                  image: channel.thumbnail,
                },
              }),
            ),
          }}
        />
      )}

      {/* Home, Creations, this channel. The crumb always names page one of the
          channel, even on page 5 — the trail describes where the page sits in
          the site, not which slice of the list is on screen. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: 'Creations', path: '/creations' },
              { name: channel.name, path: `/creations/${channel.handle ?? channel.id}` },
            ]),
          ),
        }}
      />

      <ChannelPageBody
        channel={channel}
        slug={slug}
        videos={result.videos}
        query={q}
        total={result.total}
        page={result.page}
        pageCount={result.pageCount}
      />
    </div>
  );
}
