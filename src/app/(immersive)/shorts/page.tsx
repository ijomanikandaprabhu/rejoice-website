import { BackButton, EmptyPanel } from '@/components/site/Section';
import { ShortsFeed } from '@/components/site/ShortsFeed';
import { getRandomShorts } from '@/features/youtube/queries';
import { buildMetadata } from '@/lib/seo';

/*
 * NOT cached, deliberately.
 *
 * The feed is reshuffled per visit, and `revalidate` would freeze one shuffle
 * for the life of the cached page — every visitor seeing the same "random"
 * order until it expired. Opting out is what makes the shuffle real.
 */
export const dynamic = 'force-dynamic';

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
 * SHUFFLED on every visit, so returning gives a different 60 out of the ~600
 * rather than the same newest ones each time.
 *
 * That is also why the `page` parameter is gone. It was read but nothing ever
 * linked to it, and "page 2 of a random order" is incoherent — each request
 * reshuffles, so pages would overlap and skip. One random 60 is the honest
 * shape for a feed with no pager.
 *
 * Fetched in one page of 60: a feed and a pager fight each other, and only the
 * posters load up front, so the cost is small. Past that many this wants
 * incremental loading instead.
 */
export default async function ShortsPage() {
  const videos = await getRandomShorts(60);

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
