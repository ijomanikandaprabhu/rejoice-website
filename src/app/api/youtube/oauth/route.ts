import { randomBytes } from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getYouTubeOAuthCredentials, youtubeConfig } from '@/config/youtube.config';
import { isAuthenticated } from '@/lib/auth/guard';

/**
 * Step 1 of connecting the Google account that owns the channels: redirect to
 * Google's consent screen.
 *
 * Admin-guarded. Without the guard anyone who found this URL could start a
 * consent flow whose callback writes a credential into the Rejoice database.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const credentials = getYouTubeOAuthCredentials();
  if (!credentials) {
    return NextResponse.json(
      { message: 'YOUTUBE_OAUTH_CLIENT_ID and YOUTUBE_OAUTH_CLIENT_SECRET are not configured.' },
      { status: 503 },
    );
  }

  /*
   * CSRF defence: a random value sent to Google and echoed back, checked
   * against a cookie only this browser has. Without it, an attacker could hand
   * the admin a crafted callback URL and bind THEIR Google account to the
   * Rejoice install.
   */
  const state = randomBytes(32).toString('base64url');

  cookies().set(youtubeConfig.oauth.stateCookie, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });

  const redirectUri = new URL(youtubeConfig.oauth.callbackPath, new URL(request.url).origin);

  const authUrl = new URL(youtubeConfig.oauth.authUrl);
  authUrl.search = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: redirectUri.toString(),
    response_type: 'code',
    scope: youtubeConfig.oauth.scopes.join(' '),
    /*
     * `offline` is what makes Google return a REFRESH token — without it the
     * connection dies in an hour. `consent` forces the consent screen even on a
     * reconnect, because Google only re-issues a refresh token when consent is
     * granted afresh, and a reconnect that silently returns no refresh token
     * would leave the install unable to read anything.
     */
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  }).toString();

  return NextResponse.redirect(authUrl);
}
