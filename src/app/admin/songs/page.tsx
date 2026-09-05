import { ExternalLink, Music, Trash2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { SongLinkRows } from '@/components/admin/SongLinkRows';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  addPlatformAction,
  addSongAction,
  deletePlatformAction,
  deleteSongAction,
} from '@/features/songs/actions';
import { listPlatforms, listSongsForAdmin, mediaUrl } from '@/features/songs/queries';
import { COVER_SIZES, LOGO_SIZE } from '@/lib/images/downscale';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/*
 * Uploads run through this route's function, and a cover arrives as a real
 * file. It is small by the time it gets here — the browser shrinks it first —
 * but the default allowance is tight enough to be worth raising.
 */
export const maxDuration = 60;

/** Admin → Songs. Releases, their cover art, and where to hear them. */
export default async function SongsAdminPage() {
  const [platforms, songs] = await Promise.all([listPlatforms(), listSongsForAdmin()]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Songs</h1>
        <p className="text-sm text-muted-foreground">
          Add a release with its cover art and the places it can be heard.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add a song</CardTitle>
          <CardDescription>
            Upload the cover at whatever size you have — a 3000×3000 master is fine. It is
            shrunk in your browser before it is sent, so the upload stays small.
          </CardDescription>
        </CardHeader>

        <ActionForm action={addSongAction}>
          <CardContent className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid content-start gap-4">
                <Field label="Title" htmlFor="song-title">
                  <Input id="song-title" name="title" required />
                  <FieldError name="title" />
                </Field>

                <Field label="Artist" htmlFor="song-artist">
                  <Input id="song-artist" name="artist" placeholder="Optional" />
                  <FieldError name="artist" />
                </Field>

                <Field label="Release date" htmlFor="song-released">
                  <Input id="song-released" name="releasedAt" type="date" />
                  <FieldError name="releasedAt" />
                </Field>
              </div>

              <div className="grid content-start gap-4">
                <ImageUploadField
                  name="cover"
                  label="Cover art"
                  square
                  hint="Square artwork. Any size — it is resized here before uploading."
                  sizes={{ cover: COVER_SIZES.full, thumb: COVER_SIZES.thumb }}
                />

                <Field label="Description" htmlFor="song-description">
                  <Textarea id="song-description" name="description" rows={3} />
                  <FieldError name="description" />
                </Field>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3">
              <h3 className="text-sm font-semibold">Where to hear it</h3>
              <SongLinkRows platforms={platforms} />
            </div>
          </CardContent>

          <CardContent className="pt-0">
            <SubmitButton pendingLabel="Adding…">Add song</SubmitButton>
          </CardContent>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Platforms</CardTitle>
          <CardDescription>
            Registered once, then offered whenever you add a song. A platform in use by a
            song cannot be removed until those links are cleared.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-6">
          <ActionForm action={addPlatformAction}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Platform name" htmlFor="platform-name">
                <Input id="platform-name" name="name" placeholder="Spotify" required />
                <FieldError name="name" />
              </Field>

              <ImageUploadField
                name="logo"
                label="Logo"
                hint="PNG, JPEG or WebP."
                sizes={{ logo: LOGO_SIZE }}
              />
            </div>

            <SubmitButton variant="outline" pendingLabel="Adding…">
              Add platform
            </SubmitButton>
          </ActionForm>

          <Separator />

          <ul className="grid gap-2 sm:grid-cols-2">
            {platforms.map((platform) => (
              <li
                key={platform.id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span className="grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                  <Image
                    src={mediaUrl(platform.logoId)}
                    alt=""
                    width={64}
                    height={40}
                    className="size-full object-contain"
                  />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{platform.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {platform.songCount === 0
                      ? 'Not used yet'
                      : `${platform.songCount} song${platform.songCount === 1 ? '' : 's'}`}
                  </span>
                </span>

                <ActionForm
                  action={deletePlatformAction}
                  hiddenFields={{ id: platform.id }}
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
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {songs.length === 0 ? (
        <Card>
          <CardContent className="grid place-items-center gap-2 py-12 text-center">
            <Music aria-hidden className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No songs yet. The one you add first appears at the top of /songs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {songs.map((song) => (
            <Card key={song.id}>
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <Image
                  src={mediaUrl(song.thumbId)}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 shrink-0 rounded object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{song.title}</p>
                    {song.isVisible ? null : <Badge variant="outline">Hidden</Badge>}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {[song.artist, song.releasedAt ? formatDate(song.releasedAt) : null]
                      .filter(Boolean)
                      .join(' · ') || 'No artist or date'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {song.links.length === 0
                      ? 'No links yet'
                      : song.links.map((link) => link.platform.name).join(', ')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/songs/${song.id}`}>Edit</Link>
                  </Button>

                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/songs/${song.slug}`} target="_blank" rel="noopener noreferrer">
                      View <ExternalLink className="size-3.5" />
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
