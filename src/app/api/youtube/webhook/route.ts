import crypto from 'node:crypto';

import { NextResponse } from 'next/server';

import { rateLimits } from '@/config/app.config';
import { createLogger } from '@/lib/logger';
import { clientIpFrom, rateLimit } from '@/lib/utils/rateLimit';
import { importVideosByIds } from '@/services/youtube/videoSyncService';

/**
 * YouTube WebSub (PubSubHubbub) push endpoint — the primary detection
 * mechanism (section 12).
 *
 *   GET  — the hub's subscription verification handshake.
 *   POST — an Atom notification that a channel published or updated a video.
 *
 * The scheduled sync in ../sync covers anything this misses, so a dropped push
 * costs at most one sync interval.
 */

export const dynamic = 'force-dynamic';

const log = createLogger('youtubeWebhook');

/** One notification announces one video; anything beyond this is not a real feed. */
const MAX_IDS_PER_NOTIFICATION = 20;

/** Subscription handshake: echo hub.challenge back to prove we own this URL. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('hub.challenge');
  const mode = url.searchParams.get('hub.mode');

  if (!challenge) {
    return NextResponse.json({ message: 'Missing hub.challenge' }, { status: 400 });
  }

  log.info(`WebSub ${mode ?? 'verification'} for ${url.searchParams.get('hub.topic') ?? 'unknown'}`);

  return new NextResponse(challenge, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}

/**
 * Verify the hub's HMAC signature over the raw body.
 *
 * Closed by default. This used to return `true` when no secret was configured,
 * which left a public endpoint that anyone could POST an Atom body to — every
 * call drives live YouTube Data API requests, so an unauthenticated caller could
 * burn the daily quota and stop the real sync. With no secret set there is no
 * way to tell the hub from an attacker, so nothing is accepted.
 *
 * The digest is fixed at sha1, which is what WebSub specifies. Reading the
 * algorithm out of the header let the caller choose it — `md5` included.
 */
function signatureValid(rawBody: string, header: string | null): boolean {
  const secret = process.env.YOUTUBE_WEBHOOK_SECRET;
  if (!secret || !header) return false;

  const [algorithm, signature] = header.split('=');
  if (algorithm !== 'sha1' || !signature) return false;

  const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');

  const a = Buffer.from(signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Pull <yt:videoId> values out of the Atom feed the hub posts. */
function extractVideoIds(xml: string): string[] {
  const ids = new Set<string>();
  const pattern = /<yt:videoId>([\w-]{6,})<\/yt:videoId>/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    ids.add(match[1]);
  }

  // A real notification carries one entry. The cap stops a single body from
  // fanning out into hundreds of YouTube API lookups.
  return [...ids].slice(0, MAX_IDS_PER_NOTIFICATION);
}

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  const limit = rateLimit(`youtubeWebhook:${ip}`, rateLimits.webhook.limit, rateLimits.webhook.windowMs);

  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many notifications.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const rawBody = await request.text();

  if (!signatureValid(rawBody, request.headers.get('x-hub-signature'))) {
    log.warn('Rejected WebSub notification with an invalid signature');
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  // A <at:deleted-entry> means the video was removed from YouTube. We keep our
  // record — hiding it is the administrator's decision, not YouTube's.
  if (rawBody.includes('deleted-entry')) {
    return new NextResponse(null, { status: 204 });
  }

  const videoIds = extractVideoIds(rawBody);
  if (videoIds.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const imported = await importVideosByIds(videoIds);
    log.info(`Push notification: ${imported} new video(s) from ${videoIds.length} entries`);
  } catch (error) {
    log.error('Failed to import pushed video', error);
    // Return 200 anyway: the hub retries on failure, and the scheduled sync will
    // pick this video up regardless. Retrying a broken import adds no value.
  }

  // The hub only needs to know we received it.
  return new NextResponse(null, { status: 204 });
}
