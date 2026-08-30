import { ArrowLeft, ExternalLink, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { FormSelect } from '@/components/admin/FormSelect';
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
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { resetVideoOverridesAction, updateVideoAction } from '@/features/youtube/actions';
import { prisma } from '@/lib/db/prisma';
import { formatDate } from '@/lib/utils';
import { fallbackThumbnailUrl, hasVideoOverrides, resolveVideoDisplay } from '@/lib/utils/videoDisplay';

export const dynamic = 'force-dynamic';

/** Shows the imported YouTube value next to the field that overrides it (section 16). */
function Original({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 whitespace-pre-line break-words text-sm">
        {value || <span className="italic text-muted-foreground">Empty</span>}
      </p>
    </div>
  );
}

/** A labelled switch that still posts "on" like a checkbox would. */
function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-3">
      <span className="text-sm font-medium">{label}</span>
      <Switch name={name} defaultChecked={defaultChecked} />
    </label>
  );
}

export default async function VideoEditorPage({ params }: { params: { id: string } }) {
  const video = await prisma.youTubeVideo.findUnique({
    where: { id: params.id },
    include: { channel: { select: { name: true } } },
  });

  if (!video) notFound();

  const resolved = resolveVideoDisplay(video);
  const hasOverrides = hasVideoOverrides(video);

  return (
    <>
      <div>
        <Button asChild variant="link" size="sm" className="-ml-3">
          <Link href="/admin/youtube-content">
            <ArrowLeft className="size-4" />
            Back to YouTube Content
          </Link>
        </Button>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Edit website display</h1>
        <p className="text-sm text-muted-foreground">
          Changes here affect the Rejoice website only. The video on YouTube is never modified.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 pt-6">
          <Image
            src={
              video.displayThumbnail ??
              video.youtubeThumbnail ??
              fallbackThumbnailUrl(video.youtubeVideoId)
            }
            alt=""
            width={160}
            height={90}
            className="h-[90px] w-40 rounded object-cover"
          />

          <div className="min-w-0 flex-1">
            <p className="font-medium">{resolved.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {video.channel.name} · {formatDate(video.youtubePublishedAt)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              YouTube Video ID: <code className="font-mono">{video.youtubeVideoId}</code>{' '}
              <span className="italic">(permanent, not editable)</span>
            </p>
            <Button asChild variant="link" size="sm" className="-ml-3 mt-1">
              <a href={video.youtubeUrl} target="_blank" rel="noopener noreferrer">
                Open on YouTube <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge variant={video.isVisible ? 'default' : 'outline'}>
              {video.isVisible ? 'Showing on website' : 'Hidden'}
            </Badge>
            {hasOverrides ? <Badge variant="secondary">Customised</Badge> : null}
          </div>
        </CardContent>
      </Card>

      {/*
        Keyed on updatedAt so the form remounts whenever the record changes.

        The inputs are uncontrolled, and React does not push a new defaultValue
        into an input that is already mounted. Without this key, "Reset to
        YouTube details" clears the overrides in the database but leaves the old
        text sitting in the fields — and the next "Save changes" would write the
        override straight back.
      */}
      <ActionForm
        key={video.updatedAt.toISOString()}
        action={updateVideoAction}
        hiddenFields={{ id: video.id }}
        className="space-y-6"
      >
        <Card>
          <CardHeader>
            <CardTitle>Publishing</CardTitle>
            <CardDescription>
              &ldquo;Show on website&rdquo; is the main control. Off hides the video from Rejoice
              without touching YouTube.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Toggle name="isVisible" label="Show on website" defaultChecked={video.isVisible} />
              <Toggle
                name="showChannelName"
                label="Show channel name"
                defaultChecked={video.showChannelName}
              />
              {/*
               * Set by hand, mirroring the "AI" label YouTube shows on the
               * watch page. The sync cannot fill this in: an API-key request
               * never receives `status.containsSyntheticMedia`, even for a
               * video that carries the label on YouTube.
               */}
              <Toggle
                name="isAiDisclosed"
                label="AI generated"
                defaultChecked={video.isAiDisclosed}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Website display details</CardTitle>
            <CardDescription>
              Leave a field empty to use the imported YouTube value shown beside it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Website title" htmlFor="displayTitle">
                <Input
                  id="displayTitle"
                  name="displayTitle"
                  defaultValue={video.displayTitle ?? ''}
                  placeholder={video.youtubeTitle}
                />
                <FieldError name="displayTitle" />
              </Field>
              <Original label="Original YouTube title" value={video.youtubeTitle} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Website description" htmlFor="displayDescription">
                <Textarea
                  id="displayDescription"
                  name="displayDescription"
                  rows={8}
                  defaultValue={video.displayDescription ?? ''}
                />
                <FieldError name="displayDescription" />
              </Field>
              <Original
                label="Original YouTube description"
                value={video.youtubeDescription.slice(0, 1200)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field
                label="Website thumbnail URL"
                htmlFor="displayThumbnail"
                hint="Leave empty to use the YouTube thumbnail."
              >
                <Input
                  id="displayThumbnail"
                  name="displayThumbnail"
                  defaultValue={video.displayThumbnail ?? ''}
                  placeholder={video.youtubeThumbnail ?? ''}
                />
                <FieldError name="displayThumbnail" />
              </Field>
              <Original label="Original YouTube thumbnail" value={video.youtubeThumbnail ?? ''} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SEO</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="SEO title" htmlFor="seoTitle" hint="Falls back to the website title.">
              <Input id="seoTitle" name="seoTitle" defaultValue={video.seoTitle ?? ''} />
              <FieldError name="seoTitle" />
            </Field>

            <Field
              label="SEO description"
              htmlFor="seoDescription"
              hint="Falls back to the description."
            >
              <Textarea
                id="seoDescription"
                name="seoDescription"
                rows={3}
                defaultValue={video.seoDescription ?? ''}
              />
              <FieldError name="seoDescription" />
            </Field>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>Save changes</SubmitButton>
          <Button asChild variant="ghost">
            <Link href="/admin/youtube-content">Cancel</Link>
          </Button>
        </div>
      </ActionForm>

      {/* Section 19. A separate form so it cannot submit with unsaved edits. */}
      <Card className="border-amber-500/30 bg-amber-500/[0.07]">
        <CardHeader>
          <CardTitle className="text-amber-300">Reset to YouTube details</CardTitle>
          <CardDescription className="text-amber-200/70">
            Removes the website title, description, thumbnail and SEO overrides so this video shows
            its latest imported YouTube information again. The publishing switches are kept, and
            YouTube is not modified.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={resetVideoOverridesAction}
            hiddenFields={{ id: video.id }}
            className="contents"
          >
            <SubmitButton
              variant="outline"
              pendingLabel="Resetting…"
              className="border-amber-500/40 text-amber-200 hover:bg-amber-500/10"
            >
              <RotateCcw className="size-4" />
              Reset to YouTube details
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
