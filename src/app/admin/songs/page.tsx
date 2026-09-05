import { ExternalLink, Music, Plus, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ActionForm, SubmitButton } from '@/components/admin/ActionForm';
import { Pagination } from '@/components/admin/Pagination';
import { PlatformDialog } from '@/components/admin/PlatformDialog';
import { resolvePerPage, RowsPerPage } from '@/components/admin/RowsPerPage';
import { SearchField } from '@/components/admin/SearchField';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { pageSizes } from '@/config/app.config';
import { deleteSongAction } from '@/features/songs/actions';
import { listPlatforms, listSongsForAdmin, mediaUrl } from '@/features/songs/queries';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type SearchParams = { q?: string; page?: string; perPage?: string };

/**
 * Admin → Songs. The catalogue, as a table.
 *
 * A table rather than the stack of cards this replaced, because the catalogue
 * runs to thousands: the old page fetched every song on every visit and had no
 * way to find one.
 */
export default async function SongsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const page = Math.max(Number(searchParams.page ?? '1') || 1, 1);
  const take = resolvePerPage(searchParams.perPage, pageSizes.adminSongs);
  const q = searchParams.q ?? '';

  const [platforms, { rows: songs, total }] = await Promise.all([
    listPlatforms(),
    listSongsForAdmin({ q, skip: (page - 1) * take, take }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / take));

  /** Paging must not drop the search or the rows-per-page choice. */
  const buildHref = (n: number) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (take !== pageSizes.adminSongs) params.set('perPage', String(take));
    if (n > 1) params.set('page', String(n));
    const query = params.toString();
    return query ? `/admin/songs?${query}` : '/admin/songs';
  };

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'No songs yet.'
              : `${total.toLocaleString()} song${total === 1 ? '' : 's'}.`}{' '}
            Each one has its cover art and the places it can be heard.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PlatformDialog platforms={platforms} />

          <Button asChild>
            <Link href="/admin/songs/new">
              <Plus className="size-4" />
              Add song
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-4">
          <SearchField defaultValue={q} />

          {songs.length === 0 ? (
            <div className="grid place-items-center gap-2 py-16 text-center">
              <Music aria-hidden className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {q
                  ? `Nothing matches “${q}”.`
                  : 'No songs yet. The first one you add appears at the top of /songs.'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Cover</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Artist</TableHead>
                      <TableHead>Released</TableHead>
                      <TableHead className="text-center">Links</TableHead>
                      <TableHead className="text-center">Visible</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {songs.map((song) => (
                      <TableRow key={song.id}>
                        <TableCell>
                          <Image
                            src={mediaUrl(song.coverId)}
                            alt=""
                            width={44}
                            height={44}
                            className="size-11 rounded object-cover"
                          />
                        </TableCell>

                        <TableCell className="font-medium">
                          <Link
                            href={`/admin/songs/${song.id}`}
                            className="hover:underline hover:underline-offset-4"
                          >
                            {song.title}
                          </Link>
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {song.artist ?? '—'}
                        </TableCell>

                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {song.releasedAt ? formatDate(song.releasedAt) : '—'}
                        </TableCell>

                        <TableCell className="text-center tabular-nums text-muted-foreground">
                          {song._count.links}
                        </TableCell>

                        <TableCell className="text-center">
                          {song.isVisible ? (
                            <Badge variant="secondary">Visible</Badge>
                          ) : (
                            <Badge variant="outline">Hidden</Badge>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button asChild variant="outline" size="sm">
                              <Link href={`/admin/songs/${song.id}`}>Edit</Link>
                            </Button>

                            <Button asChild variant="ghost" size="icon" title="View on the website">
                              <Link
                                href={`/songs/${song.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <ExternalLink className="size-4" />
                              </Link>
                            </Button>

                            <ActionForm
                              action={deleteSongAction}
                              hiddenFields={{ id: song.id }}
                              confirmTitle={`Delete ${song.title}?`}
                              confirm="The song and its cover art are removed from the website and from this list. This cannot be undone."
                              confirmLabel="Delete song"
                              className="contents"
                            >
                              <SubmitButton
                                variant="ghost"
                                size="icon"
                                pendingLabel=""
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </SubmitButton>
                            </ActionForm>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <RowsPerPage perPage={take} page={page} total={total} />
                <Pagination page={page} pageCount={pageCount} buildHref={buildHref} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
