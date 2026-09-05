import Image from 'next/image';
import Link from 'next/link';

import { RecordDisc } from '@/components/site/RecordDisc';
import { mediaUrl } from '@/features/songs/queries';

export type SongCard = {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  releasedAt: Date | null;
  coverId: string;
};

/**
 * The releases, as cover art.
 *
 * Square, because that is what a cover is — the artwork is the whole point of
 * the card and cropping it to a 16:9 tile would throw away the part people
 * recognise.
 *
 * There is one stored size now — 800px — so the grid draws it into a smaller
 * box. `sizes` still tells the browser how wide the tile really is, which is
 * what keeps the layout honest even though only one file exists.
 */
export function SongGrid({ songs }: { songs: readonly SongCard[] }) {
  return (
    /*
     * Five across on desktop, not four. The counts then land evenly — 30 fills
     * exactly six rows and 60 exactly twelve, where four across left the
     * preview ending on a half row with three gaps beside the last two covers.
     * `PlatformGrid` already uses five at this breakpoint, so it is a width
     * this site keeps rather than a new one.
     */
    /*
     * `song-card-grid` is not styling — it carries `--disc-dir`, which decides
     * which way each card's record slides out. See `globals.css`; the column
     * counts are duplicated there and must be kept in step.
     */
    <ul className="song-card-grid grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
      {songs.map((song) => (
        // Hovering lifts the card over its neighbours, so the record passes in
        // front of the next cover rather than behind it.
        <li key={song.id} className="relative hover:z-20">
          <Link
            href={`/songs/${song.slug}`}
            className="group block rounded-[16px] border border-white/10 bg-site-surface p-3 transition-colors duration-300 hover:border-site-accent/50"
          >
            {/*
             * The media area does NOT clip: the record has to leave it. The
             * cover keeps its own rounding and clipping instead.
             */}
            <span className="relative block">
              {/*
               * Behind the cover, exactly its size, and flush with it at rest —
               * so there is nothing to see until the pointer arrives.
               *
               * `hidden` by default and shown only where a pointer can hover:
               * on a phone there is no hover state to leave, so the record
               * would either never appear or stick out after a tap.
               */}
              <RecordDisc
                src={mediaUrl(song.coverId)}
                sizes="80px"
                className="song-card-disc absolute left-0 top-0 z-0 hidden aspect-square h-full opacity-0 transition-[transform,opacity] duration-500 group-hover:opacity-100 [@media(hover:hover)]:block"
                spinClassName="song-card-disc-spin"
              />

              <span className="relative z-10 block overflow-hidden rounded-[10px]">
                <Image
                  src={mediaUrl(song.coverId)}
                  alt={`${song.title} cover art`}
                  width={400}
                  height={400}
                  sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </span>
            </span>

            <span className="mt-3 block">
              <span className="block truncate text-sm font-medium text-site-fg">
                {song.title}
              </span>
              {song.artist ? (
                <span className="mt-0.5 block truncate text-xs text-site-muted">
                  {song.artist}
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
