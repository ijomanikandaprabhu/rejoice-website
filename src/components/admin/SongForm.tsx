import Image from 'next/image';
import Link from 'next/link';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { addSongAction, updateSongAction } from '@/features/songs/actions';
import { COVER_SIZE } from '@/lib/images/downscale';

type Platform = { id: string; name: string; logoId: string };

export type SongFormValues = {
  id: string;
  title: string;
  artist: string | null;
  description: string | null;
  releasedAt: Date | null;
  isVisible: boolean;
  coverId: string;
  links: Array<{ platformId: string; url: string }>;
};

/** `<input type="date">` wants exactly YYYY-MM-DD, in the UTC day it was stored as. */
function dateInputValue(date: Date | null | undefined): string {
  return date ? date.toISOString().slice(0, 10) : '';
}

/**
 * Add or edit a song. ONE component for both, so the two forms cannot drift
 * into disagreeing about what a song is.
 *
 * Every registered platform is a field, always — no dropdown, no "add another
 * row". Filling in the ones that apply is faster than choosing a platform and
 * then typing, and it means a platform registered next month simply appears on
 * every song's form without anyone going looking for it.
 *
 * A field left empty is not a link. That is what makes this shape work: the
 * form can offer twelve platforms and a song can use two.
 */
export function SongForm({
  platforms,
  song,
}: {
  platforms: Platform[];
  /** Absent when adding. */
  song?: SongFormValues;
}) {
  const editing = Boolean(song);
  const urlFor = new Map(song?.links.map((link) => [link.platformId, link.url]) ?? []);

  return (
    <ActionForm
      action={editing ? updateSongAction : addSongAction}
      hiddenFields={editing ? { id: song!.id } : undefined}
      className="grid gap-6"
    >
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>

        <CardContent className="grid gap-6 lg:grid-cols-2">
          <div className="grid content-start gap-4">
            <Field label="Title" htmlFor="title">
              <Input id="title" name="title" defaultValue={song?.title ?? ''} required />
              <FieldError name="title" />
            </Field>

            <Field label="Artist" htmlFor="artist">
              <Input
                id="artist"
                name="artist"
                placeholder="Optional"
                defaultValue={song?.artist ?? ''}
              />
              <FieldError name="artist" />
            </Field>

            <Field label="Release date" htmlFor="releasedAt">
              <Input
                id="releasedAt"
                name="releasedAt"
                type="date"
                defaultValue={dateInputValue(song?.releasedAt)}
              />
              <FieldError name="releasedAt" />
            </Field>

            {editing ? (
              <Field label="Show on the website" htmlFor="isVisible">
                <div className="flex items-center gap-3">
                  <Switch id="isVisible" name="isVisible" defaultChecked={song!.isVisible} />
                  <span className="text-sm text-muted-foreground">
                    Hidden songs stay here and disappear from /songs.
                  </span>
                </div>
              </Field>
            ) : null}
          </div>

          <div className="grid content-start gap-4">
            <ImageUploadField
              name="cover"
              label="Cover art"
              square
              currentUrl={song ? `/api/media/${song.coverId}` : undefined}
              hint={
                editing
                  ? 'Leave this alone to keep the current artwork.'
                  : 'Square artwork. Any size — a 3000×3000 master is fine, it is resized here before uploading.'
              }
              sizes={{ cover: COVER_SIZE }}
            />

            <Field label="Description" htmlFor="description">
              <Textarea
                id="description"
                name="description"
                rows={4}
                defaultValue={song?.description ?? ''}
              />
              <FieldError name="description" />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Where to hear it</CardTitle>
        </CardHeader>

        <CardContent>
          {platforms.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No platforms registered yet. Add one from the{' '}
              <Link href="/admin/songs" className="underline underline-offset-4">
                songs page
              </Link>{' '}
              and it will appear here.
            </p>
          ) : (
            <ul className="grid gap-3">
              {platforms.map((platform) => (
                <li
                  key={platform.id}
                  className="grid gap-2 sm:grid-cols-[minmax(0,12rem)_1fr] sm:items-center"
                >
                  {/*
                    * The platform is fixed, so it travels as a hidden field
                    * rather than a control. The action pairs it with the URL
                    * beside it by position.
                    */}
                  <input type="hidden" name="link.platformId" value={platform.id} />

                  <label
                    htmlFor={`link-${platform.id}`}
                    className="flex items-center gap-2.5 text-sm font-medium"
                  >
                    <span className="grid h-8 w-12 shrink-0 place-items-center overflow-hidden rounded bg-muted">
                      <Image
                        src={`/api/media/${platform.logoId}`}
                        alt=""
                        width={48}
                        height={32}
                        className="size-full object-contain"
                      />
                    </span>
                    <span className="truncate">{platform.name}</span>
                  </label>

                  <div className="grid gap-1">
                    <Input
                      id={`link-${platform.id}`}
                      name="link.url"
                      type="url"
                      inputMode="url"
                      placeholder="Leave empty if not on this platform"
                      defaultValue={urlFor.get(platform.id) ?? ''}
                    />
                    <FieldError name={`link.${platform.id}.url`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel={editing ? 'Saving…' : 'Adding…'}>
          {editing ? 'Save song' : 'Add song'}
        </SubmitButton>

        <Button asChild variant="ghost">
          <Link href="/admin/songs">Cancel</Link>
        </Button>
      </div>
    </ActionForm>
  );
}
