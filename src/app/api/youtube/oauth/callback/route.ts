import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getYouTubeOAuthCredentials, youtubeConfig } from '@/config/youtube.config';
import { isAuthenticated } from '@/lib/auth/guard';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { seal } from '@/lib/utils/secretBox';

/**
 * Step 2: Google redirects back here with a one-time code, which is exchanged
 * for a refresh token and stored encrypted.
 *
 * Every exit path returns to Settings with a message in the query string, so a
 * failure is something the administrator reads on the page they started from
 * rather than a raw JSON error.
 */

export const dynamic = 'force-dynamic';

const log = createLogger('youtubeOAuth');

/**
 * Which of our channels does this token speak for?
 *
 * The Analytics API will not name its own channel, and identifying it directly
 * needs the `youtube.readonly` scope this app deliberately does not request.
 * So it is asked for its top videos and those are matched against the
 * catalogue — every video a token can report on belongs to its own channel, so
 * the first recognised one settles it.
 */
async function resolveChannelFromToken(accessToken: string): Promise<string | null> {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 90);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const url = new URL(`${youtubeConfig.analyticsBaseUrl}/reports`);
  url.search = new URLSearchParams({
    ids: 'channel==MINE',
    startDate: ymd(start),
    endDate: ymd(today),
    metrics: 'views',
    dimensions: 'video',
    sort: '-views',
    maxResults: '10',
  }).toString();

  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;

    const body = (await response.json()) as { rows?: unknown[][] };
    const ids = (body.rows ?? []).map((r) => String(r[0]));
    if (ids.length === 0) return null;

    const match = await prisma.youTubeVideo.findFirst({
      where: { youtubeVideoId: { in: ids } },
      select: { channelId: true },
    });
    return match?.channelId ?? null;
  } catch (error) {
    // Not fatal: the credential is still stored, just unattributed.
    log.error('Could not identify the channel for a new connection', error);
    return null;
  }
}

function back(origin: string, params: Record<string, string>) {
  const url = new URL('/admin/settings', origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.hash = 'youtube-analytics';
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);

  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getYouTubeOAuthCredentials();
  if (!credentials) {
    return back(origin, { analytics: 'error', reason: 'OAuth credentials are not configured.' });
  }

  // The administrator pressed Cancel on Google's consent screen. Not an error.
  const denied = searchParams.get('error');
  if (denied) {
    return back(origin, { analytics: 'cancelled' });
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const expected = cookies().get(youtubeConfig.oauth.stateCookie)?.value;

  // Consumed either way: a state value must never be reusable.
  cookies().delete(youtubeConfig.oauth.stateCookie);

  // `<nonce>.<channelId>` — only the nonce is compared; see the authorise route.
  const [nonce, intendedChannel] = (state ?? '').split('.');

  if (!code || !nonce || !expected || nonce !== expected) {
    log.warn('OAuth callback rejected: state mismatch');
    return back(origin, { analytics: 'error', reason: 'The sign-in response could not be verified.' });
  }

  try {
    const redirectUri = new URL(youtubeConfig.oauth.callbackPath, origin);

    const response = await fetch(youtubeConfig.oauth.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        redirect_uri: redirectUri.toString(),
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      log.error('Token exchange failed', await response.text());
      return back(origin, { analytics: 'error', reason: 'Google rejected the sign-in.' });
    }

    const token = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
    };

    /*
     * No refresh token means the connection would silently die within the hour.
     * Google omits it when consent was previously granted and not re-requested;
     * `prompt=consent` on the authorise step is what prevents this, so reaching
     * here means something is wrong rather than merely unusual.
     */
    if (!token.refresh_token) {
      return back(origin, {
        analytics: 'error',
        reason: 'Google did not return a refresh token. Remove the app at myaccount.google.com/permissions and try again.',
      });
    }

    const profile = await fetch(youtubeConfig.oauth.userInfoUrl, {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    const email = profile.ok ? (((await profile.json()) as { email?: string }).email ?? '') : '';

    /*
     * Which channel did this token actually come from?
     *
     * Asked of the API rather than taken from `intendedChannel`, because the
     * Google account picker lists every brand account and choosing the wrong
     * one is easy. Filing the credential under the channel the administrator
     * MEANT would put one channel's revenue under another channel's name.
     */
    const resolvedChannelId = await resolveChannelFromToken(token.access_token);

    const data = {
      googleAccountEmail: email || 'Unknown account',
      refreshToken: seal(token.refresh_token),
      accessToken: seal(token.access_token),
      expiresAt: new Date(Date.now() + token.expires_in * 1000),
      scopes: token.scope,
    };

    if (resolvedChannelId) {
      /*
       * Replace THIS channel's credential and leave every other one alone.
       * The previous code deleted every row before writing, which is exactly
       * what made a second connection impossible.
       */
      await prisma.youTubeOAuthToken.upsert({
        where: { channelId: resolvedChannelId },
        create: { ...data, channelId: resolvedChannelId },
        update: data,
      });
      await prisma.siteSetting.deleteMany({
        where: { key: `youtube.analytics.cache.${resolvedChannelId}` },
      });
    } else {
      // Unresolved: stored anyway, and adopted by the first channel that turns
      // out to own it. Better than discarding a valid credential.
      await prisma.youTubeOAuthToken.deleteMany({ where: { channelId: null } });
      await prisma.youTubeOAuthToken.create({ data });
    }

    const channelName = resolvedChannelId
      ? ((
          await prisma.youTubeChannel.findUnique({
            where: { id: resolvedChannelId },
            select: { name: true },
          })
        )?.name ?? null)
      : null;

    log.info(
      `YouTube analytics connected as ${email || 'unknown account'} for ${channelName ?? 'an unidentified channel'}`,
    );

    const monetary = token.scope.includes(youtubeConfig.oauth.monetaryScope);

    return back(origin, {
      analytics: monetary ? 'connected' : 'connected-no-revenue',
      ...(channelName ? { channelName } : {}),
      // Surfaced so Settings can say "you connected X, not Y" rather than
      // leaving a mis-picked account to be discovered later as missing data.
      ...(resolvedChannelId && intendedChannel && resolvedChannelId !== intendedChannel
        ? { mismatch: '1' }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    log.error('OAuth callback failed', message);
    return back(origin, { analytics: 'error', reason: message });
  }
}
