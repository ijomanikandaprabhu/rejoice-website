import { NextResponse } from 'next/server';

import { reportFault } from '@/features/monitoring/report';
import { clientIpFrom, rateLimit } from '@/lib/utils/rateLimit';

/**
 * Where the error boundaries report a broken page.
 *
 * The boundaries are client components, so they cannot email anything
 * themselves — mail is server-only. They post here instead, and this is the one
 * piece of the fault reporting a visitor's browser can reach.
 *
 * ## This endpoint is open, so treat everything it receives as untrusted
 *
 * Anyone can post to it. That is unavoidable — the whole point is that a
 * visitor's browser reports a fault — so the defences are the ones that matter
 * for an open endpoint rather than an attempt to authenticate it:
 *
 *   - Nothing from the body is trusted. `scope` is matched against a fixed list
 *     and anything else is rejected, so the subject line of the email cannot be
 *     chosen by a stranger.
 *   - Every field is truncated hard. An email is a poor place to discover
 *     someone posted a megabyte of text.
 *   - Rate limited per IP, on top of the one-per-hour-per-fault limit inside
 *     `reportFault`. Two different limits because they stop two different
 *     things: this one stops a single source flooding, that one stops a genuine
 *     fault sending the same mail a hundred times.
 *
 * It always answers 204, including when it drops the report. There is nothing
 * useful to tell the caller, and saying "rejected" only helps someone probing
 * for what gets through.
 */

export const dynamic = 'force-dynamic';

/** Only these. An unknown scope is a report we did not write, so it is dropped. */
const SCOPES = new Set(['public-page', 'admin-page', 'immersive-page']);

const LIMIT = { requests: 10, windowMs: 60 * 60 * 1000 };

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  if (!rateLimit(`report:${ip}`, LIMIT.requests, LIMIT.windowMs).allowed) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const payload = body as Record<string, unknown> | null;
  const scope = String(payload?.scope ?? '');
  if (!SCOPES.has(scope)) return new NextResponse(null, { status: 204 });

  const digest = trim(payload?.digest, 64);
  const path = trim(payload?.path, 200);
  const message = trim(payload?.message, 300) || 'No message was included.';

  await reportFault({
    scope,
    message: 'A page failed to load for a visitor.',
    /*
     * The browser's message goes in `error`, not in `message`. `message` is part
     * of the once-an-hour signature, and letting a caller vary it would let one
     * source send an unlimited number of "different" faults.
     */
    error: message,
    context: { path, digest },
  });

  return new NextResponse(null, { status: 204 });
}

function trim(value: unknown, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : '';
}
