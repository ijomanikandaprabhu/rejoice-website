import { NextResponse } from 'next/server';

import { rateLimits } from '@/config/app.config';
import { notifyAndRecord } from '@/features/enquiries/notify';
import { raise } from '@/features/notifications/notify';
import { runAfterResponse } from '@/lib/afterResponse';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { clientIpFrom, rateLimit } from '@/lib/utils/rateLimit';
import { contactSchema, fieldErrors } from '@/lib/validation';

/**
 * Public enquiry submission (sections 5, 23).
 *
 * Validated with Zod and rate-limited per IP (section 37). Submissions are stored
 * as Enquiry rows and surface under Admin -> Enquiries.
 */

const log = createLogger('contact');

export async function POST(request: Request) {
  const ip = clientIpFrom(request.headers);
  const limit = rateLimit(`contact:${ip}`, rateLimits.contact.limit, rateLimits.contact.windowMs);

  if (!limit.allowed) {
    return NextResponse.json(
      { message: 'Too many messages sent. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request.' }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Please check the form and try again.', errors: fieldErrors(parsed.error) },
      { status: 400 },
    );
  }

  // Honeypot filled in means a bot. Respond as if it worked so it does not retry.
  if (parsed.data.website) {
    return NextResponse.json({ message: 'Message sent. We will reply by email.' });
  }

  const { name, email, phone, subject, message } = parsed.data;

  let enquiry: { id: string };

  try {
    enquiry = await prisma.enquiry.create({
      data: {
        name,
        email: email.toLowerCase(),
        phone: phone || null,
        subject: subject || null,
        message,
      },
    });
  } catch (error) {
    log.error('Failed to store enquiry', error);
    return NextResponse.json(
      { message: 'We could not save your message. Please try again shortly.' },
      { status: 500 },
    );
  }

  /*
   * The bell BEFORE the email, which is the point of this ordering: it is one
   * local insert of a few milliseconds, and it used to sit behind a network call
   * to Google that took seconds.
   *
   * It is a different job from the email — the mail reaches whoever reads that
   * inbox, the bell reaches whoever is in the admin. Either one alone leaves a
   * gap. `raise` swallows its own errors because the enquiry is already stored,
   * and nothing about a note can be allowed to tell the visitor their message
   * failed.
   */
  await raise({
    kind: 'ENQUIRY',
    title: `New enquiry from ${name}`,
    body: subject || message.slice(0, 140),
    href: '/admin/enquiries',
  });

  /*
   * The email AFTER the response, not before it.
   *
   * This used to be awaited, and the visitor waited with it: 3.7-3.8s measured
   * on the live site, all of it Gmail accepting the message. The enquiry is
   * already stored and the bell has already rung by this point, so nothing the
   * visitor is told depends on the send.
   *
   * `runAfterResponse` hands the work to the platform when it can and tells us
   * when it cannot — see the note in `lib/afterResponse.ts` about why that is
   * detected rather than assumed. When it cannot, we await exactly as before:
   * slower, never lost.
   *
   * And either way `notifyAndRecord` stamps `notifiedAt`, so an enquiry whose
   * mail never went is a row the daily sweep can find. That column is what makes
   * answering early safe rather than merely fast.
   */
  const send = () => notifyAndRecord(enquiry.id, { name, email, phone, subject, message });

  if (!runAfterResponse(send)) {
    /*
     * Caught here as well as inside `notifyAndRecord`, which already swallows
     * everything. Belt and braces, because on THIS path the send is awaited: an
     * unexpected throw would turn a stored enquiry into a 500, telling someone
     * their message failed when it is sitting in the admin. That is the one
     * outcome this whole change exists to prevent.
     */
    await send().catch((error) => {
      log.error('ENQUIRY_MAIL_FAILED: the deferred send threw', error);
    });
  }

  return NextResponse.json({ message: 'Message sent. We will reply by email.' });
}
