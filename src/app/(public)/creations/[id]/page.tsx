import { notFound, permanentRedirect } from 'next/navigation';

import { ChannelPageBody } from '@/components/site/ChannelPageBody';
import { pageSizes } from '@/config/app.config';
import { getMusicVideos, getPublicChannelBySlug } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';

export const revalidate = 300;

type Params = { params: { id: string }; searchParams: { page?: string; q?: string } };

export async function generateMetadata({ params }: { params: { id: string } }) {
  const channel = await getPublicChannelBySlug(params.id);
  if (!channel) return buildMetadata({ title: 'Channel', path: `/creations/${params.id}` });

  return buildMetadata({
    title: channel.name,
    description: `Every ${channel.name} release published on the Rejoice website.`,
    // The canonical address is the handle, so an id-based visit still points
    // search engines at the one real URL.
    path: `/creations/${channel.handle ?? channel.id}`,
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
export default async function ChannelPage({ params, searchParams }: Params) {
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
