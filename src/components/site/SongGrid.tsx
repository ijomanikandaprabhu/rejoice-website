import Image from 'next/image';
import Link from 'next/link';

import { mediaUrl } from '@/features/songs/queries';

export type SongCard = {
  id: string;
  slug: string;
  title: string;
  artist: string | null;
  releasedAt: Date | null;
  thumbId: string;
};

/**
 * The releases, as cover art.
 *
 * Square, because that is what a cover is — the artwork is the whole point of
 * the card and cropping it to a 16:9 tile would throw away the part people
 * recognise.
 *
 * Uses the stored THUMB, not the full cover: a page of these at 1200px would
 * download several megabytes to draw them at 300.
 */
export function SongGrid({ songs }: { songs: readonly SongCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
      {songs.map((song) => (
        <li key={song.id}>
          <Link
            href={`/songs/${song.slug}`}
            className="group block rounded-[16px] border border-white/10 bg-site-surface p-3 transition-colors duration-300 hover:border-site-accent/50"
          >
            <span className="block overflow-hidden rounded-[10px]">
              <Image
                src={mediaUrl(song.thumbId)}
                alt={`${song.title} cover art`}
                width={400}
                height={400}
                sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
                className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              />
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
