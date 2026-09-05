import { NextResponse } from 'next/server';

/**
 * Serves YouTube's thumbnails and channel avatars from this domain.
 *
 * Why this exists rather than `next/image`'s optimizer: the optimizer is
 * metered, the free allowance is far smaller than this catalogue, and once it
 * ran out every newly imported video and channel logo rendered as a broken
 * image with a "402 Payment required" behind it. Nothing here is metered.
 *
 * It also keeps the Privacy Policy's claim true — a visitor's browser talks to
 * this domain, not to Google, until they actually press play on a video.
 *
 * NO RESIZING happens here. `youtubeLoader.ts` asks YouTube for a size close
 * to the one being rendered, so this route only has to pass bytes along.
 */

export const runtime = 'edge';

/**
 * The ONLY hosts this will fetch from.
 *
 * A route that fetches a URL a caller supplies is an open proxy unless it is
 * pinned like this: someone could otherwise hand it any address and have this
 * domain fetch it for them, including addresses only this server can reach.
 * Matched against the parsed hostname, never against the raw string, so
 * `https://i.ytimg.com.example.com/x` cannot slip through.
 */
const ALLOWED_HOSTS = new Set([
  'i.ytimg.com',
  'yt3.ggpht.com',
  'yt3.googleusercontent.com',
]);

/**
 * A year, and immutable.
 *
 * These URLs are content-addressed — a video's thumbnail lives at an address
 * containing its id, and a channel's avatar at one containing a hash — so a
 * changed image arrives at a different address rather than replacing this one.
 * The long life is what makes this cheap: the CDN answers almost every request
 * without this function running at all.
 */
const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u');
  if (!raw) return new NextResponse('Missing image', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Malformed image address', { status: 400 });
  }

  if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
    return new NextResponse('Image address not allowed', { status: 400 });
  }

  const upstream = await fetch(target, {
    // No cookies, no referrer: this request must carry nothing about the
    // visitor it is being made for.
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { accept: 'image/*' },
    cache: 'force-cache',
  }).catch(() => null);

  if (!upstream?.ok) {
    /*
     * Not cached for a year. A thumbnail can 404 while YouTube is still
     * generating it, and caching that failure would keep the video looking
     * broken long after the image existed.
     */
    return new NextResponse('Image unavailable', {
      status: 502,
      headers: { 'cache-control': 'public, max-age=60' },
    });
  }

  const type = upstream.headers.get('content-type') ?? '';
  // Refuse anything that is not an image, so this can never be used to serve
  // HTML or a script from this domain.
  if (!type.startsWith('image/')) {
    return new NextResponse('Not an image', { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      'content-type': type,
      'cache-control': CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    },
  });
}
