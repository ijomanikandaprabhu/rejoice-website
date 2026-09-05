import { ArrowLeft, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { SongForm } from '@/components/admin/SongForm';
import { Button } from '@/components/ui/button';
import { getSongForAdmin, listPlatforms } from '@/features/songs/queries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Admin → Songs → Edit.
 *
 * The same `SongForm` the add page uses, so the two cannot drift into
 * disagreeing about what a song is.
 */
export default async function EditSongPage({ params }: { params: { id: string } }) {
  const [song, platforms] = await Promise.all([getSongForAdmin(params.id), listPlatforms()]);

  if (!song) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
          <p className="text-sm text-muted-foreground">
            The address stays <strong>/songs/{song.slug}</strong> even if the title changes, so
            links already shared keep working.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/songs/${song.slug}`} target="_blank" rel="noopener noreferrer">
              View <ExternalLink className="size-3.5" />
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href="/admin/songs">
              <ArrowLeft className="size-4" />
              All songs
            </Link>
          </Button>
        </div>
      </div>

      <SongForm platforms={platforms} song={song} />
    </>
  );
}
