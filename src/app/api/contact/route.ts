import { NextResponse } from 'next/server';

import { rateLimits } from '@/config/app.config';
import { notifyNewEnquiry } from '@/features/enquiries/notify';
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

  try {
    await prisma.enquiry.create({
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
   * Notify AFTER the row is committed, and never let it fail the request.
   *
   * The enquiry is safely stored by this point. If SMTP is misconfigured or
   * Gmail is refusing connections, the visitor must still be told their message
   * went through — because it did. `notifyNewEnquiry` swallows its own errors;
   * this is awaited rather than fired-and-forgotten because a serverless
   * function can be frozen the moment the response returns, which would drop
   * the send mid-flight.
   */
  await notifyNewEnquiry({ name, email, phone, subject, message });

  return NextResponse.json({ message: 'Message sent. We will reply by email.' });
}
