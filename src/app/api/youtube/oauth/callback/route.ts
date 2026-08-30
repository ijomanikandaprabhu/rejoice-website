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

  if (!code || !state || !expected || state !== expected) {
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

    // One connection at a time: this is "which account owns the channels", and
    // a second row would leave which one is used to chance.
    await prisma.youTubeOAuthToken.deleteMany();
    await prisma.youTubeOAuthToken.create({
      data: {
        googleAccountEmail: email || 'Unknown account',
        refreshToken: seal(token.refresh_token),
        accessToken: seal(token.access_token),
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
        scopes: token.scope,
      },
    });

    // Any cached report belongs to the previous connection.
    await prisma.siteSetting.deleteMany({ where: { key: 'youtube.analytics.cache' } });

    log.info(`YouTube analytics connected as ${email || 'unknown account'}`);

    const monetary = token.scope.includes(youtubeConfig.oauth.monetaryScope);
    return back(origin, { analytics: monetary ? 'connected' : 'connected-no-revenue' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    log.error('OAuth callback failed', message);
    return back(origin, { analytics: 'error', reason: message });
  }
}
