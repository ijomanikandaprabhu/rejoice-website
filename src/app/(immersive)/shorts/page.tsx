import Link from 'next/link';

import { BackButton, EmptyPanel } from '@/components/site/Section';
import { ShortsFeed } from '@/components/site/ShortsFeed';
import { getPublicShort, getShortsVideos } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';

/*
 * Cached for five minutes, like every other public page.
 *
 * This used to be `force-dynamic`, and it had to be: the feed was RESHUFFLED
 * per visit, and caching would have frozen one shuffle for the life of the
 * page — every visitor seeing the same "random" order. The order is now newest
 * first, which is stable, so the opt-out is gone with the shuffle that needed
 * it. A `?v=` request renders per-request anyway, as any page reading
 * `searchParams` does.
 */
export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Short Takes',
  description: 'Every vertical release published on the Rejoice website.',
  // The route stays `/shorts` while the page is titled "Short Takes": that is
  // the word people search for and type, and moving the path would break the
  // homepage link and any address already shared.
  path: '/shorts',
});

/**
 * Every visible Short, from every channel.
 *
 * Common to all channels by construction: `getMusicVideos` is called WITHOUT a
 * `channel`, so the only filter is `shortsOnly`. That is also why there is no
 * new query here — the one the Music page and the channel page already use does
 * this once its channel argument is left off.
 *
 * Deliberately plain, and that is the point of the page. The channel page it
 * replaced as the Shorts destination carries a search box, a channel details
 * dialog and a "Visit on YouTube" button, all of which belong to *a* channel;
 * a listing that spans every channel has no single channel to describe, so none
 * of that furniture is here.
 *
 * Presented as a scrolling feed that plays as you go, rather than a grid of
 * links — see `ShortsFeed`, including why the sound starts off.
 *
 * NEWEST FIRST, and not shuffled. It was random for a while, so that returning
 * gave a different sixty out of the six hundred; the cost was that nothing had
 * a stable position, the page could never be cached, and there was no way to
 * say "the one I watched yesterday". Newest first is what a feed of releases
 * should open on, and `/shorts/all` is where the rest now live.
 *
 * Sixty, still: a feed and a pager fight each other, and this one has a
 * searchable, paged listing beside it for the times a pager is what is wanted.
 *
 * `?v=<youtube id>` OPENS THE FEED AT ONE SHORT, which is how a card in that
 * listing gets here — Shorts have no page of their own. The named Short is put
 * at the FRONT of the list rather than the feed being told to scroll to it:
 * the video may be the four-hundredth newest and so not in this sixty at all,
 * and prepending needs no state in the player, no scroll-on-mount, and works
 * the same whether or not it was already here.
 */
export default async function ShortsPage({
  searchParams,
}: {
  searchParams: { v?: string };
}) {
  const wanted = (searchParams.v ?? '').trim();

  const [newest, opened] = await Promise.all([
    getShortsVideos(60),
    wanted ? getPublicShort(wanted) : Promise.resolve(null),
  ]);

  /*
   * De-duplicated, or a Short that IS in the newest sixty would appear twice —
   * once at the front and again in place, with two players for one video.
   */
  const videos = opened
    ? [opened, ...newest.filter((video) => video.id !== opened.id)]
    : newest;

  return (
    /*
     * A FIXED-HEIGHT flex column, so the feed inside can flex to whatever is
     * left after the header row. Sizing the feed with its own
     * `calc(100svh - …)` meant guessing this page's padding and header height,
     * and the guess was wrong — the document scrolled behind the feed, giving
     * two nested scrollbars.
     */
    <div className="container-page flex h-[calc(100svh-4.5rem-1px)] flex-col py-6">
      {/*
       * Bare icon, like the channel page's: the control sits in a header row
       * where the destination is obvious, so `BackButton`'s optional label is
       * left off. `ariaLabel` still names it — the component applies
       * `aria-label` precisely when there is no visible label.
       *
       * The button is ABSOLUTE rather than a flex sibling. Laid out in flow it
       * would take space from the row, and the heading would then centre on
       * what was left beside it instead of on the page — visibly off-centre.
       * Out of flow, the `h1` centres on the container itself.
       */}
      <div className="relative mb-8 flex items-center justify-center">
        <BackButton href="/" ariaLabel="Back to home" className="absolute left-0" />
        <h1 className="t-h2 text-site-fg">Short Takes</h1>

        {/*
         * The way out to the full listing, mirroring the back button on the
         * left so the heading keeps the centre. Absolute for the same reason:
         * in flow it would take width from the row and push the title
         * off-centre.
         */}
        <Link
          href="/shorts/all"
          className="absolute right-0 text-sm text-site-muted transition-colors hover:text-site-fg"
        >
          All Shorts
        </Link>
      </div>

      {videos.length === 0 ? (
        <EmptyPanel
          title="Nothing published yet"
          description="Vertical videos approved in the admin portal appear here."
          />
      ) : (
        <ShortsFeed videos={videos} />
      )}
    </div>
  );
}
