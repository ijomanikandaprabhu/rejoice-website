import { AlertTriangle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react';
import Image from 'next/image';

import { ActionForm, Field, FieldError, SubmitButton } from '@/components/admin/ActionForm';
import { FormSelect } from '@/components/admin/FormSelect';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { isYouTubeConfigured } from '@/config/youtube.config';
import {
  addChannelAction,
  disconnectChannelAction,
  refreshChannelAction,
  syncChannelAction,
  updateChannelAction,
} from '@/features/youtube/actions';
import { formatDateTime } from '@/lib/utils';
import { listChannelsForAdmin } from '@/services/youtube/channelService';

export const dynamic = 'force-dynamic';

/*
 * Server actions invoked from this page run in this route's function, and the
 * deep import behind "Add channel" and "Sync now" is the longest-running work
 * in the admin. Without this they inherit the platform default, which is far
 * below the sync's own 40-second budget — the run would be killed mid-import.
 * Kept in step with `syncTimeBudgetMs` in youtube.config.ts and with the cron
 * route's own `maxDuration`.
 */
export const maxDuration = 60;

/*
 * The form opens on "Automatically show".
 *
 * It used to open on "Review first (recommended)", which no one ever chose:
 * all five connected channels are AUTO_SHOW. A default nobody picks is a trap
 * rather than a safeguard — add a channel, miss the dropdown, import several
 * hundred videos and find nothing on the site. That is the same failure the
 * deployment nearly shipped, when a fresh import would have arrived entirely
 * hidden.
 *
 * Neither option is labelled "recommended" now. Which one is expected is what
 * the default position says; a label saying otherwise only contradicts it.
 */
const VISIBILITY_OPTIONS = [
  { value: 'AUTO_SHOW', label: 'Automatically show' },
  { value: 'REVIEW_FIRST', label: 'Review first' },
];

/** Admin → YouTube Channels (sections 9, 10, 21). */
export default async function ChannelsAdminPage() {
  const channels = await listChannelsForAdmin();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">YouTube Channels</h1>
        <p className="text-sm text-muted-foreground">
          Connect a Rejoice channel once. New uploads are then imported automatically.
        </p>
      </div>

      {!isYouTubeConfigured() ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>API key missing</AlertTitle>
          <AlertDescription>
            <code className="font-mono">YOUTUBE_API_KEY</code> is not set, so channels cannot be
            resolved or synchronized yet.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add channel</CardTitle>
          <CardDescription>
            Paste the channel URL, for example{' '}
            <code className="break-all font-mono text-xs">
              https://www.youtube.com/@RejoiceGospelCommunications
            </code>
            . Handle and <code className="font-mono text-xs">/channel/</code> URLs are cheapest —
            legacy <code className="font-mono text-xs">/c/</code> URLs cost 100× more API quota.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm action={addChannelAction}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Field label="Channel URL" htmlFor="url">
                <Input id="url" name="url" placeholder="https://www.youtube.com/@…" required />
                <FieldError name="url" />
              </Field>

              <Field label="New videos" htmlFor="defaultVideoVisibility">
                <FormSelect
                  id="defaultVideoVisibility"
                  name="defaultVideoVisibility"
                  ariaLabel="Default visibility for new videos"
                  defaultValue="AUTO_SHOW"
                  options={VISIBILITY_OPTIONS}
                />
              </Field>

              <SubmitButton pendingLabel="Connecting…">Add channel</SubmitButton>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="font-medium">No channels connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a channel above to start importing videos.
            </p>
          </CardContent>
        </Card>
      ) : (
        channels.map((channel) => (
          <Card key={channel.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start gap-4">
                <Avatar className="size-14">
                  {channel.thumbnail ? (
                    <AvatarImage asChild src={channel.thumbnail}>
                      <Image src={channel.thumbnail} alt="" width={56} height={56} />
                    </AvatarImage>
                  ) : null}
                  <AvatarFallback>{channel.name.charAt(0)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>{channel.name}</CardTitle>
                    <Badge variant={channel.isActive ? 'secondary' : 'outline'}>
                      {channel.isActive ? 'Connected' : 'Paused'}
                    </Badge>
                    {channel.lastSyncError ? (
                      <Badge variant="destructive">Last sync failed</Badge>
                    ) : null}
                    {/*
                      * A channel too large to import inside one run. Shown so a
                      * part-imported catalogue is visible rather than looking
                      * like a finished import that lost videos. It clears
                      * itself once the last page is read.
                      */}
                    {channel.importCursor ? (
                      <Badge variant="outline">Still importing…</Badge>
                    ) : null}
                  </div>

                  <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm text-muted-foreground sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt>Imported:</dt>
                      <dd className="font-medium tabular-nums text-foreground">
                        {/*
                          * "1,200 of 5,000" only while an import is unfinished.
                          * `videoCount` is YouTube's own total, so the two
                          * rarely match exactly even when complete — showing
                          * the comparison permanently would read as a fault.
                          */}
                        {channel.importCursor && channel.videoCount
                          ? `${channel._count.videos.toLocaleString()} of ${channel.videoCount.toLocaleString()}`
                          : channel._count.videos.toLocaleString()}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Last sync:</dt>
                      <dd className="font-medium text-foreground">
                        {formatDateTime(channel.lastSyncedAt)}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>Channel ID:</dt>
                      <dd className="font-mono text-xs">{channel.youtubeChannelId}</dd>
                    </div>
                    <div className="flex gap-2">
                      <dt>New videos:</dt>
                      <dd className="font-medium text-foreground">
                        {channel.defaultVideoVisibility === 'AUTO_SHOW'
                          ? 'Automatically show'
                          : 'Review first'}
                      </dd>
                    </div>
                  </dl>
                </div>

                <a
                  href={channel.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  YouTube <ExternalLink className="size-3.5" />
                </a>
              </div>

              {channel.lastSyncError ? (
                <Alert variant="destructive" className="mt-4">
                  <AlertTriangle />
                  <AlertDescription className="font-mono text-xs">
                    {channel.lastSyncError}
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <ActionForm
                  action={syncChannelAction}
                  hiddenFields={{ id: channel.id }}
                  className="contents"
                >
                  <SubmitButton size="sm" pendingLabel="Syncing…">
                    <RefreshCw className="size-4" />
                    Sync now
                  </SubmitButton>
                </ActionForm>

                <ActionForm
                  action={refreshChannelAction}
                  hiddenFields={{ id: channel.id }}
                  className="contents"
                >
                  <SubmitButton size="sm" variant="outline" pendingLabel="Refreshing…">
                    Refresh details
                  </SubmitButton>
                </ActionForm>

                {/*
                 * Guarded, and worded with the real consequence. "Disconnect"
                 * sounds reversible, but the video relation cascades — removing
                 * the channel deletes every imported video and every website
                 * override with it, in one click and with no undo. The count is
                 * interpolated so the number is in front of the operator at the
                 * moment they decide.
                 */}
                <ActionForm
                  action={disconnectChannelAction}
                  hiddenFields={{ id: channel.id }}
                  className="contents"
                  confirmTitle="Remove this channel?"
                  confirm={`This permanently deletes ${channel._count.videos.toLocaleString()} imported ${
                    channel._count.videos === 1 ? 'video' : 'videos'
                  } from Rejoice, along with every website title, description, thumbnail and SEO text you have set on them. This cannot be undone — re-importing brings the videos back from YouTube, but not your edits. The channel on YouTube is not affected.`}
                  confirmLabel="Remove channel"
                >
                  <SubmitButton size="sm" variant="destructive" pendingLabel="Removing…">
                    <Trash2 className="size-4" />
                    Disconnect
                  </SubmitButton>
                </ActionForm>
              </div>

              <Separator />

              <ActionForm
                action={updateChannelAction}
                hiddenFields={{ id: channel.id }}
                className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end"
              >
                <Field label="Default for new videos" htmlFor={`vis-${channel.id}`}>
                  <FormSelect
                    id={`vis-${channel.id}`}
                    name="defaultVideoVisibility"
                    ariaLabel="Default visibility"
                    defaultValue={channel.defaultVideoVisibility}
                    options={[
                      { value: 'REVIEW_FIRST', label: 'Review first' },
                      { value: 'AUTO_SHOW', label: 'Automatically show' },
                    ]}
                  />
                </Field>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Switch name="isActive" defaultChecked={channel.isActive} />
                    Active
                  </label>
                  <SubmitButton size="sm" variant="outline">
                    Save
                  </SubmitButton>
                </div>
              </ActionForm>
            </CardContent>
          </Card>
        ))
      )}

      <p className="text-xs text-muted-foreground">
        Disconnecting removes the channel and its imported records from this website only. Nothing
        on YouTube is changed.
      </p>
    </>
  );
}
