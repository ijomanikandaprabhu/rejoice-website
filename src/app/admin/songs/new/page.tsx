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
      {/*
        * Going back sits on the LEFT; acting on this page sits on the right,
        * with the form's own buttons. Above the heading rather than beside it —
        * the title and its line are one block, and a button alongside would
        * squeeze that text into a narrow column on a phone.
        */}
      <div className="grid gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit">
            <Link href="/admin/songs">
              <ArrowLeft className="size-4" />
              All songs
            </Link>
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Add a song</h1>
          <p className="text-sm text-muted-foreground">
            Fill in the platforms it is on and leave the rest empty.
          </p>
        </div>
      </div>

      <SongForm platforms={platforms} />
    </>
  );
}
