import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db/prisma';

/**
 * Serves an uploaded image — a song's cover or a platform's logo — from the
 * database.
 *
 * Node runtime, not edge, because it reads through Prisma. That is the whole
 * reason this is a separate route from `/api/image`, which proxies YouTube on
 * the edge and must stay there.
 *
 * These are already web-sized: the browser downscales before uploading, so
 * there is no resizing to do here and Vercel's image optimizer is not involved
 * at all. `youtubeLoader` passes any path beginning with `/` straight through,
 * so `<Image src="/api/media/...">` reaches this untouched.
 */

export const runtime = 'nodejs';

/**
 * A year, immutable.
 *
 * Safe because these URLs are effectively content-addressed: replacing a song's
 * cover stores a NEW asset with a new id and points the song at it, so a
 * changed picture always arrives at a different address. The old row is deleted
 * rather than overwritten.
 */
const CACHE_CONTROL = 'public, max-age=31536000, s-maxage=31536000, immutable';

/** Only what the upload path is allowed to store, echoed back verbatim. */
const SERVABLE = new Set(['image/webp', 'image/png', 'image/jpeg']);

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: params.id },
    select: { bytes: true, mimeType: true },
  });

  if (!asset) {
    // Not cached for a year: an image can be uploaded a moment after someone
    // followed a stale link, and remembering "missing" would outlive the gap.
    return new NextResponse('Not found', {
      status: 404,
      headers: { 'cache-control': 'public, max-age=60' },
    });
  }

  /*
   * Belt and braces. The upload path already restricts what may be stored, but
   * this route is what a browser actually executes against, and serving an
   * unexpected type from our own domain is the kind of mistake that only shows
   * up as a security finding much later.
   */
  const mimeType = SERVABLE.has(asset.mimeType) ? asset.mimeType : 'application/octet-stream';

  return new NextResponse(new Uint8Array(asset.bytes), {
    headers: {
      'content-type': mimeType,
      'cache-control': CACHE_CONTROL,
      'x-content-type-options': 'nosniff',
    },
  });
}
