import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

import {
  ActionButton,
  ActionForm,
  Field,
  FieldError,
  SubmitButton,
} from '@/components/admin/ActionForm';
import { CarouselSlots } from '@/components/admin/CarouselSlots';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  isYouTubeAnalyticsConfigured,
  isYouTubeConfigured,
  youtubeConfig,
} from '@/config/youtube.config';
import { changeEmailAction, changePasswordAction } from '@/features/auth/actions';
import {
  disconnectYouTubeAnalyticsAction,
  saveCarouselSettingsAction,
  saveContactSettingsAction,
  saveSocialLinksAction,
} from '@/features/settings/actions';
import {
  getCarouselSettings,
  getGeneralSettings,
  getSocialSettings,
} from '@/features/settings/queries';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { formatDateTime } from '@/lib/utils';
import { svgToDataUri } from '@/lib/utils/svg';
import { getConnection } from '@/services/youtube/analyticsService';
import { getLastSyncRecord } from '@/services/youtube/videoSyncService';

export const dynamic = 'force-dynamic';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="text-right">{children}</div>
      </div>
      <Separator />
    </>
  );
}

/**
 * Admin → Settings (section 24).
 *
 * Technical and global configuration only. Page copy lives in
 * `config/content.config.ts`; the contact details here are the exception,
 * because they change without a deploy.
 */
export default async function SettingsPage({
  searchParams,
}: {
  // The OAuth callback returns here with the outcome in the query string.
  searchParams?: { analytics?: string; reason?: string };
}) {
  const session = await auth();

  const [general, carousel, lastSync, channelCount, videoCount, social, admin, analytics] =
    await Promise.all([
    getGeneralSettings(),
    getCarouselSettings(),
    getLastSyncRecord(),
    prisma.youTubeChannel.count({ where: { isActive: true } }),
    prisma.youTubeVideo.count(),
    getSocialSettings(),
    // From the database, not the session — the JWT keeps the pre-change address
    // until the token expires. Same reasoning as the admin layout.
    session?.user?.id
      ? prisma.admin.findUnique({ where: { id: session.user.id }, select: { email: true } })
      : null,
      getConnection(),
    ]);

  /*
   * Outcome of an OAuth round trip, if we just came back from one.
   * "connected-no-revenue" is deliberately a warning rather than a success:
   * the connection works, but the one number the owner most likely wanted is
   * missing, and finding that out from an empty panel later is worse.
   */
  const status = ((): { tone: 'ok' | 'warn' | 'error'; message: string } | null => {
    switch (searchParams?.analytics) {
      case 'connected':
        return { tone: 'ok', message: 'Google account connected. Analytics will appear on the dashboard shortly.' };
      case 'connected-no-revenue':
        return {
          tone: 'warn',
          message:
            'Connected, but revenue access was not granted. Reconnect and allow the earnings permission to see revenue.',
        };
      case 'cancelled':
        return { tone: 'warn', message: 'Connection cancelled — nothing was changed.' };
      case 'error':
        return { tone: 'error', message: searchParams.reason ?? 'The connection could not be completed.' };
      default:
        return null;
    }
  })();

  const adminEmail = admin?.email ?? session?.user?.email ?? '';
  const socialRows = social.links;

  /*
   * Hydrate the saved ids into cards for the picker, keeping the SAVED ORDER —
   * `findMany` returns database order, so the result is re-sorted by the id's
   * position. Ids whose video has since gone simply drop out.
   */
  const carouselRows = await prisma.youTubeVideo.findMany({
    where: { id: { in: carousel.videoIds } },
    select: {
      id: true,
      youtubeTitle: true,
      displayTitle: true,
      youtubeThumbnail: true,
      displayThumbnail: true,
      youtubeVideoId: true,
      isVisible: true,
      channel: { select: { name: true, isActive: true } },
    },
  });
  const carouselOrder = new Map(carousel.videoIds.map((id, index) => [id, index]));
  const carouselPicks = carouselRows
    .sort((a, b) => (carouselOrder.get(a.id) ?? 0) - (carouselOrder.get(b.id) ?? 0))
    .map((row) => ({
      id: row.id,
      title: row.displayTitle ?? row.youtubeTitle,
      channelName: row.channel.name,
      thumbnail:
        row.displayThumbnail ??
        row.youtubeThumbnail ??
        `https://i.ytimg.com/vi/${row.youtubeVideoId}/hqdefault.jpg`,
      isVisible: row.isVisible && row.channel.isActive,
    }));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Global website configuration. Page text lives in{' '}
          <code className="font-mono text-xs">src/config/content.config.ts</code> and needs a
          redeploy to change.
        </p>
      </div>

      {/*
       * Contact details.
       *
       * There was a General card above this one — website name, logo URL,
       * favicon URL — sharing this form and this action. It is gone: the name
       * lives in `app.config.ts`, and the logo and favicon fields were read by
       * nothing on the site. The action and schema were narrowed in the same
       * change, because a required `siteName` with no input left on screen
       * would have failed validation on every save from here.
       */}
      <ActionForm action={saveContactSettingsAction} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
            <CardDescription>
              Shown on the contact page and in the footer. Leave a field empty to hide it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email address" htmlFor="contactEmail">
                <Input id="contactEmail" name="contactEmail" defaultValue={general.contactEmail} />
                <FieldError name="contactEmail" />
              </Field>
              <Field label="Phone number" htmlFor="contactPhone">
                <Input id="contactPhone" name="contactPhone" defaultValue={general.contactPhone} />
                <FieldError name="contactPhone" />
              </Field>
            </div>

            <Field label="Address" htmlFor="contactAddress">
              <Textarea
                id="contactAddress"
                name="contactAddress"
                rows={7}
                defaultValue={general.contactAddress}
              />
              <FieldError name="contactAddress" />
            </Field>

            <SubmitButton>Save contact details</SubmitButton>
          </CardContent>
        </Card>
      </ActionForm>

      <Card>
        <CardHeader>
          <CardTitle>YouTube</CardTitle>
          <CardDescription>
            The API key is configured through the server environment and is never shown here.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <Row label="API configuration">
            {isYouTubeConfigured() ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="size-3" /> Not set
              </Badge>
            )}
          </Row>

          <Row label="Automatic synchronization">
            <Badge variant={isYouTubeConfigured() ? 'secondary' : 'outline'}>
              {isYouTubeConfigured() ? 'On' : 'Off'}
            </Badge>
          </Row>

          <Row label="Schedule">
            <span className="font-medium">{youtubeConfig.scheduleLabel}</span>
            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
              {youtubeConfig.scheduleCron} UTC
            </span>
          </Row>

          <Row label="Active channels">
            <span className="font-medium tabular-nums">{channelCount}</span>
          </Row>

          <Row label="Imported videos">
            <span className="font-medium tabular-nums">{videoCount.toLocaleString()}</span>
          </Row>

          {/*
           * Two separate facts. `lastOkAt` is the last time it actually worked,
           * which survives a failed run; `at`/`ok` describe the most recent
           * attempt. Showing only the latter meant one bad night wiped a month
           * of good ones off the screen.
           */}
          <div className="flex items-center justify-between gap-4 py-3 text-sm">
            <span className="text-muted-foreground">Last successful synchronization</span>
            <span className="font-medium tabular-nums">
              {/* Records written before `lastOkAt` existed fall back to `at`
                  when that run succeeded, so history is not lost on upgrade. */}
              {(() => {
                const okAt = lastSync?.lastOkAt ?? (lastSync?.ok ? lastSync.at : null);
                return okAt ? formatDateTime(okAt) : 'None recorded';
              })()}
            </span>
          </div>

          {lastSync && !lastSync.ok ? (
            <div className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-muted-foreground">Last attempt</span>
              <span className="font-medium tabular-nums text-destructive">
                {formatDateTime(lastSync.at)} — failed
              </span>
            </div>
          ) : null}

          <Button asChild variant="link" size="sm" className="-ml-3">
            <Link href="/admin/youtube-channels">Manage channels →</Link>
          </Button>
        </CardContent>
      </Card>

      {/*
        YouTube analytics is a SEPARATE connection from the API key above.
        The key reads public data; revenue and watch time need OAuth as the
        account that owns the channels. Two cards, because they fail
        independently and the difference matters when one of them is broken.
      */}
      <Card id="youtube-analytics">
        <CardHeader>
          <CardTitle>YouTube analytics</CardTitle>
          <CardDescription>
            Revenue, watch time and subscriber movement come from the YouTube Analytics API, which
            only the Google account that owns the channels can authorise.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {status ? (
            <div
              className={`mb-4 rounded-input border px-4 py-3 text-sm ${
                status.tone === 'ok'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : status.tone === 'warn'
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                    : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}
            >
              {status.message}
            </div>
          ) : null}

          {!isYouTubeAnalyticsConfigured() ? (
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>
                Not set up on this deployment. It needs an OAuth client from Google Cloud Console
                with the YouTube Analytics API enabled, and these two variables in the server
                environment:
              </p>
              <pre className="overflow-x-auto rounded-input bg-muted px-4 py-3 font-mono text-xs">
                YOUTUBE_OAUTH_CLIENT_ID
                <br />
                YOUTUBE_OAUTH_CLIENT_SECRET
              </pre>
              <p>
                The OAuth client must list{' '}
                <code className="font-mono text-xs">{youtubeConfig.oauth.callbackPath}</code> as an
                authorised redirect URI.
              </p>
            </div>
          ) : analytics ? (
            <>
              <Row label="Connected as">
                <span className="font-medium">{analytics.email}</span>
              </Row>
              <Row label="Revenue access">
                {analytics.hasMonetaryScope ? (
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="size-3" /> Granted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <XCircle className="size-3" /> Not granted
                  </Badge>
                )}
              </Row>
              <Row label="Connected on">
                <span className="font-medium tabular-nums">
                  {formatDateTime(analytics.connectedAt)}
                </span>
              </Row>

              <div className="flex flex-wrap items-center gap-2 pt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href="/api/youtube/oauth">Reconnect</Link>
                </Button>
                <ActionButton
                  action={disconnectYouTubeAnalyticsAction}
                  variant="destructive"
                  confirm="This removes the stored Google credential and the cached reports from this website. It does not revoke access on Google's side — do that at myaccount.google.com/permissions."
                >
                  Disconnect
                </ActionButton>
              </div>
            </>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                No account connected. Sign in with the Google account that owns the Rejoice
                channels — a different account will authorise successfully but report nothing.
              </p>
              <Button asChild size="sm">
                <Link href="/api/youtube/oauth">Connect Google account</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <ActionForm action={saveCarouselSettingsAction} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Channels carousel</CardTitle>
            <CardDescription>
              The ten videos in the Channels page hero, in order. Click a slot to choose a video.
              Leave slots empty to show fewer — with none chosen, the newest videos are shown
              instead.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CarouselSlots initial={carouselPicks} />
            <SubmitButton>Save carousel</SubmitButton>
          </CardContent>
        </Card>
      </ActionForm>


      {/*
       * Social links.
       *
       * These feed every social surface on the site at once — the footer, the
       * contact page, the buttons on a video page and the homepage's structured
       * data — because they all read one query.
       */}
      <ActionForm action={saveSocialLinksAction} className="contents">
        <Card>
          <CardHeader>
            <CardTitle>Social links</CardTitle>
            <CardDescription>
              Upload an SVG icon and set the address for each account. Clear the name to remove a
              row, and leave the address empty to hide it from the website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {socialRows.map((link, index) => (
              <div key={link.id} className="grid gap-4 sm:grid-cols-[auto,1fr,1fr]">
                <input type="hidden" name="social.id" value={link.id} />

                <div className="flex items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border bg-muted">
                    {link.svg ? (
                      // An <img>, never inlined: see src/lib/utils/svg.ts.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={svgToDataUri(link.svg)} alt="" className="size-5" />
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        {link.label.slice(0, 2)}
                      </span>
                    )}
                  </span>
                </div>

                <Field label="Name" htmlFor={`social-label-${index}`}>
                  <Input
                    id={`social-label-${index}`}
                    name={`social.${index}.label`}
                    defaultValue={link.label}
                  />
                  <FieldError name={`social.${index}.label`} />
                </Field>

                <Field label="Address" htmlFor={`social-url-${index}`}>
                  <Input
                    id={`social-url-${index}`}
                    name={`social.${index}.url`}
                    defaultValue={link.url}
                    placeholder="https://"
                  />
                  <FieldError name={`social.${index}.url`} />
                </Field>

                <div className="sm:col-span-3">
                  <Field
                    label="Icon (SVG)"
                    htmlFor={`social-icon-${index}`}
                    hint="Leave empty to keep the current icon. Max 32KB."
                  >
                    <Input
                      id={`social-icon-${index}`}
                      name={`social.${index}.icon`}
                      type="file"
                      accept="image/svg+xml,.svg"
                    />
                    <FieldError name={`social.${index}.icon`} />
                  </Field>
                </div>
              </div>
            ))}

            <SubmitButton>Save social links</SubmitButton>
          </CardContent>
        </Card>
      </ActionForm>

      <Card>
        <CardHeader>
          <CardTitle>Administrator</CardTitle>
          <CardDescription>
            Signed in as <strong>{adminEmail}</strong>. This is the only account — there
            is no registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-2">
          <ActionForm action={changeEmailAction}>
            <h3 className="text-sm font-semibold">Change email</h3>

            <Field label="New email address" htmlFor="new-email">
              <Input
                id="new-email"
                name="email"
                type="email"
                defaultValue={adminEmail}
              />
              <FieldError name="email" />
            </Field>

            <Field label="Current password" htmlFor="email-password">
              <Input
                id="email-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
              <FieldError name="currentPassword" />
            </Field>

            <SubmitButton variant="outline">Update email</SubmitButton>
          </ActionForm>

          <ActionForm action={changePasswordAction}>
            <h3 className="text-sm font-semibold">Change password</h3>

            <Field label="Current password" htmlFor="current-password">
              <Input
                id="current-password"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
              />
              <FieldError name="currentPassword" />
            </Field>

            <Field
              label="New password"
              htmlFor="new-password"
              hint="At least 10 characters, with upper case, lower case and a number."
            >
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
              />
              <FieldError name="newPassword" />
            </Field>

            <Field label="Confirm new password" htmlFor="confirm-password">
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
              />
              <FieldError name="confirmPassword" />
            </Field>

            <SubmitButton variant="outline">Update password</SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
