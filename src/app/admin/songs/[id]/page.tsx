import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { SongLinkRows } from '@/components/admin/SongLinkRows';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { updateSongAction } from '@/features/songs/actions';
import { getSongForAdmin, listPlatforms, mediaUrl } from '@/features/songs/queries';
import { COVER_SIZES } from '@/lib/images/downscale';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** `<input type="date">` wants exactly YYYY-MM-DD, in the same UTC day it was stored as. */
function dateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

export default async function EditSongPage({ params }: { params: { id: string } }) {
  const [song, platforms] = await Promise.all([getSongForAdmin(params.id), listPlatforms()]);

  if (!song) notFound();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{song.title}</h1>
          <p className="text-sm text-muted-foreground">/songs/{song.slug}</p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/admin/songs">
            <ArrowLeft className="size-4" />
            All songs
          </Link>
        </Button>
      </div>

      <Card>
        <ActionForm action={updateSongAction} hiddenFields={{ id: song.id }}>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>
              The address stays <strong>/songs/{song.slug}</strong> even if the title changes,
              so links already shared keep working.
            </CardDescription>
          </CardHeader>

          <CardContent className="grid gap-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="grid content-start gap-4">
                <Field label="Title" htmlFor="title">
                  <Input id="title" name="title" defaultValue={song.title} required />
                  <FieldError name="title" />
                </Field>

                <Field label="Artist" htmlFor="artist">
                  <Input id="artist" name="artist" defaultValue={song.artist ?? ''} />
                  <FieldError name="artist" />
                </Field>

                <Field label="Release date" htmlFor="releasedAt">
                  <Input
                    id="releasedAt"
                    name="releasedAt"
                    type="date"
                    defaultValue={dateInputValue(song.releasedAt)}
                  />
                  <FieldError name="releasedAt" />
                </Field>

                <Field label="Show on the website" htmlFor="isVisible">
                  <div className="flex items-center gap-3">
                    <Switch id="isVisible" name="isVisible" defaultChecked={song.isVisible} />
                    <span className="text-sm text-muted-foreground">
                      Hidden songs stay here and disappear from /songs.
                    </span>
                  </div>
                </Field>
              </div>

              <div className="grid content-start gap-4">
                <ImageUploadField
                  name="cover"
                  label="Cover art"
                  square
                  currentUrl={mediaUrl(song.coverId)}
                  hint="Leave this alone to keep the current artwork."
                  sizes={{ cover: COVER_SIZES.full, thumb: COVER_SIZES.thumb }}
                />

                <Field label="Description" htmlFor="description">
                  <Textarea
                    id="description"
                    name="description"
                    rows={4}
                    defaultValue={song.description ?? ''}
                  />
                  <FieldError name="description" />
                </Field>
              </div>
            </div>

            <Separator />

            <div className="grid gap-3">
              <h3 className="text-sm font-semibold">Where to hear it</h3>
              <SongLinkRows
                platforms={platforms}
                initial={song.links.map((link) => ({
                  platformId: link.platformId,
                  url: link.url,
                }))}
              />
            </div>
          </CardContent>

          <CardContent className="pt-0">
            <SubmitButton>Save song</SubmitButton>
          </CardContent>
        </ActionForm>
      </Card>
    </>
  );
}
