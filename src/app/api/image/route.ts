import { NextResponse } from 'next/server';

import { ACCEPTED_VARIANTS, AVATAR_SIZES } from '@/lib/images/youtubeLoader';
import { rateLimit } from '@/lib/utils/rateLimit';

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
 * Beyond the host, the exact SHAPES this loader produces — nothing else.
 *
 * The host check alone leaves an unbounded surface: a caller can invent any
 * number of distinct paths on those three hosts, and every one of them misses
 * the CDN, wakes this function and makes an upstream request. That is the only
 * way this route's usage grows without bound, and the CPU it burns is metered.
 *
 * Matching the grammar instead means junk is refused in a few microseconds
 * with no fetch and no bandwidth behind it. The catalogue's own images —
 * roughly 8,350 distinct URLs — are each fetched once and then served by the
 * CDN for a year, which is a few CPU-minutes in total.
 */
const VIDEO_ID = /^[\w-]{11}$/;
const VARIANT_NAMES = new Set(ACCEPTED_VARIANTS);

/** `=s176-c-k-...`, the size segment `youtubeLoader` rewrites on an avatar. */
const AVATAR_SIZE_SEGMENT = /=s(\d+)-/;

/**
 * `/vi/<id>/<variant>.jpg` or `/vi_webp/<id>/<variant>.webp` — exactly three
 * path segments, a real video id, and a variant name YouTube publishes.
 */
function isImageWeServe(target: URL): boolean {
  if (target.hostname === 'i.ytimg.com') {
    const parts = target.pathname.split('/');
    if (parts.length !== 4 || parts[0] !== '') return false;

    const [, dir, id, file] = parts;
    if (!VIDEO_ID.test(id)) return false;

    const extension = dir === 'vi_webp' ? '.webp' : dir === 'vi' ? '.jpg' : null;
    if (extension === null || !file.endsWith(extension)) return false;
    return VARIANT_NAMES.has(file.slice(0, -extension.length));
  }

  // A channel avatar, which must carry a size this loader would have asked for.
  const size = AVATAR_SIZE_SEGMENT.exec(target.pathname);
  return size !== null && AVATAR_SIZES.includes(Number(size[1]));
}

/**
 * Requests per address per minute.
 *
 * Well clear of any real page — the busiest carries fewer than a hundred
 * distinct images, and a returning visitor asks for none of them because they
 * are cached for a year. It is here to blunt a flood of invented URLs, which
 * the grammar above already makes worthless but not free.
 *
 * The window is per instance rather than shared, so this slows a single source
 * rather than stopping a distributed one. Bounding it exactly would mean
 * checking every id against the database, which needs Prisma, which forces
 * this route off the edge runtime and raises the CPU per request — spending
 * more of the meter this is protecting.
 */
const RATE_LIMIT = { requests: 300, windowMs: 60_000 };

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

/** One upstream request, carrying nothing about the visitor it is made for. */
function fetchOnce(target: URL) {
  return fetch(target, {
    // No cookies, no referrer: this request must carry nothing about the
    // visitor it is being made for.
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    headers: { accept: 'image/*' },
    cache: 'force-cache',
  }).catch(() => null);
}

/**
 * Fetch the image, stepping down through fallbacks rather than giving up.
 *
 * Two different misses are covered, and both have actually happened:
 *
 *   1. The WebP copy is missing. It is asked for because it is about half the
 *      size, but YouTube has not generated one for every video.
 *   2. The variant itself does not exist. 177 videos in this catalogue have no
 *      `maxresdefault`, and requesting one returned 404 — a tenth of the grid
 *      rendered as blank grey boxes. `youtubeLoader` no longer asks for a
 *      variant larger than the one YouTube reported, so this should not arise;
 *      it is here because "should not" is how the blank boxes happened the
 *      first time.
 *
 * The chain ends at `mqdefault.jpg`, which YouTube publishes for EVERY video.
 * It is small and 16:9, so the worst case is a soft thumbnail rather than a
 * hole in the page.
 *
 * Extra requests only ever happen on a miss, and the answer is cached for a
 * year afterwards like any other.
 */
async function fetchImage(target: URL): Promise<Response | null> {
  const first = await fetchOnce(target);
  if (first?.ok) return first;

  const [, dir, id, file] = target.pathname.split('/');
  if (dir !== 'vi' && dir !== 'vi_webp') return first;

  const variant = file.replace(/\.(webp|jpg)$/, '');

  const fallbacks = [
    // Same picture, the format YouTube always has.
    dir === 'vi_webp' ? `https://i.ytimg.com/vi/${id}/${variant}.jpg` : null,
    // The size every video has. Skipped when that is already what failed,
    // which would mean YouTube is down rather than the variant missing.
    variant === 'mqdefault' ? null : `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  ].filter((url): url is string => url !== null);

  for (const url of fallbacks) {
    const next = await fetchOnce(new URL(url));
    if (next?.ok) return next;
  }

  return first;
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('u');
  if (!raw) return new NextResponse('Missing image', { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Malformed image address', { status: 400 });
  }

  if (
    target.protocol !== 'https:' ||
    !ALLOWED_HOSTS.has(target.hostname) ||
    !isImageWeServe(target)
  ) {
    return new NextResponse('Image address not allowed', { status: 400 });
  }

  /*
   * Checked only AFTER the address is known to be one we serve, so a flood of
   * junk cannot use up a real visitor's allowance.
   */
  const client = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const limit = rateLimit(`image:${client}`, RATE_LIMIT.requests, RATE_LIMIT.windowMs);
  if (!limit.allowed) {
    return new NextResponse('Too many image requests', {
      status: 429,
      headers: { 'retry-after': String(Math.ceil(limit.retryAfterMs / 1000)) },
    });
  }

  const upstream = await fetchImage(target);

  if (!upstream?.ok) {
    /*
     * Not cached for a year, and deliberately not "tidied" to match the
     * success path. A thumbnail can 404 while YouTube is still generating it,
     * and caching that failure for a year would keep a real video looking
     * broken long after its image existed. A minute is long enough to absorb a
     * burst and short enough to correct itself.
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
