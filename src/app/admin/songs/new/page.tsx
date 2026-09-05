import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

import { SongForm } from '@/components/admin/SongForm';
import { Button } from '@/components/ui/button';
import { listPlatforms } from '@/features/songs/queries';

export const dynamic = 'force-dynamic';

/*
 * The cover arrives here as a real upload. It is small by the time it does —
 * the browser shrinks it first — but the default allowance is tight enough to
 * be worth raising.
 */
export const maxDuration = 60;

/** Admin → Songs → Add song. */
export default async function NewSongPage() {
  const platforms = await listPlatforms();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add a song</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the platforms it is on and leave the rest empty.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/admin/songs">
            <ArrowLeft className="size-4" />
            All songs
          </Link>
        </Button>
      </div>

      <SongForm platforms={platforms} />
    </>
  );
}
