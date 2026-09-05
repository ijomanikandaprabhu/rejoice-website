import Link from 'next/link';

import { SongGrid, type SongCard } from '@/components/site/SongGrid';

/**
 * The newest releases, on the homepage.
 *
 * The page talked about the music without ever showing any of it — the
 * streaming ring above says "Your Favourite Songs, Wherever You Are" over a
 * circle of logos, and the covers themselves lived only on `/songs`.
 *
 * Two rows, always. `twoRows` on the grid takes 4, 6 or 10 covers depending on
 * how many columns the width gives it, so the band keeps its shape instead of
 * growing to five rows on a phone and burying the Services section under it.
 *
 * Structure follows `BentoCards` directly below — `container-page pt-24`, a
 * centred eyebrow and heading, `mt-12` to the body — so the two sections share
 * one rhythm rather than nearly sharing it.
 */
export function HomeSongs({
  songs,
  eyebrow,
  heading,
}: {
  songs: readonly SongCard[];
  eyebrow: string;
  heading: string;
}) {
  /*
   * Nothing to show, no section — the same guard the platform ring and the
   * bento use. Until a song exists the page reads exactly as it did before.
   */
  if (songs.length === 0 || !heading) return null;

  return (
    <section className="container-page pt-24">
      <div className="text-center">
        {eyebrow ? <p className="t-label">{eyebrow}</p> : null}
        <h2 className="t-h2 mx-auto mt-3 max-w-3xl">{heading}</h2>
      </div>

      <div className="mt-12">
        <SongGrid songs={songs} twoRows />
      </div>

      {/*
       * `/songs`, not `/songs/all`. That page shows 30 and carries its own
       * "View all songs", so the journey is 10 -> 30 -> everything rather than
       * a jump from ten covers to the whole catalogue.
       *
       * Same treatment as `SeeMoreFromChannel` and the `/songs` button: this is
       * the site's one way of saying "there is more of this listing".
       */}
      <div className="mt-10 flex justify-center">
        <Link href="/songs" className="btn-secondary px-7 text-sm">
          See more songs
        </Link>
      </div>
    </section>
  );
}
