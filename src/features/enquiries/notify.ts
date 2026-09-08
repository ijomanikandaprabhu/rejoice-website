import 'server-only';

import { prisma } from '@/lib/db/prisma';

import { appConfig } from '@/config/app.config';
import { isMailConfigured } from '@/config/mail.config';
import { getGeneralSettings } from '@/features/settings/queries';
import { createLogger } from '@/lib/logger';
import { sendMail } from '@/services/mail/mailer';
import { renderMail } from '@/services/mail/template';

/**
 * Tells Rejoice that an enquiry has arrived.
 *
 * Without this the contact form was silent: the row landed in the database and
 * waited for somebody to open the admin, while the visitor had been told
 * "we will reply by email".
 */

const log = createLogger('enquiry-notify');

export type EnquiryNotification = {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  message: string;
};

/**
 * Builds the message. Pure, so it can be tested without SMTP.
 *
 * BOTH PARTS, from one description. This was plain text only, and the reason
 * was good: the body is composed almost entirely of attacker-supplied strings,
 * and plain text removes the HTML-escaping question rather than depending on
 * getting it right. The branded version does not get to forget that — it is why
 * `renderMail` takes DATA and escapes every value itself, and why the text part
 * is still built and still sent.
 */
export function buildEnquiryEmail(enquiry: EnquiryNotification, to: string) {
  const { html, text } = renderMail({
    heading: 'New enquiry',
    intro: `${enquiry.name} has written in through the website.`,
    rows: [
      { label: 'Name', value: enquiry.name },
      { label: 'Email', value: enquiry.email },
      ...(enquiry.phone ? [{ label: 'Phone', value: enquiry.phone }] : []),
      ...(enquiry.subject ? [{ label: 'Subject', value: enquiry.subject }] : []),
    ],
    message: enquiry.message,
    action: { label: 'Read and reply', href: `${appConfig.url}/admin/enquiries` },
  });

  return {
    to,
    subject: `New enquiry from ${enquiry.name}`,
    text,
    html,
    /*
     * Replies go to the person who wrote in.
     *
     * The mail is sent from the Rejoice account TO the Rejoice account, so
     * without this, hitting Reply in Gmail would address it to yourself.
     */
    replyTo: enquiry.email,
  };
}

/**
 * Best-effort: never throws.
 *
 * The enquiry is already stored by the time this runs. A mail problem must not
 * turn a successful submission into a failure for the visitor, so everything
 * here is caught and logged.
 *
 * Returns whether the mail was accepted, which is what the caller stamps into
 * `Enquiry.notifiedAt`. `false` covers "SMTP is not configured" and "no contact
 * address set" as well as a genuine failure: in all three the message did not
 * go, and the sweep should look at it again.
 */
export async function notifyNewEnquiry(enquiry: EnquiryNotification): Promise<boolean> {
  /*
   * Timed, because this is the slowest thing in the request and the only way
   * anyone will notice it drifting again is if the number is in the log. It
   * once reached 9.5 seconds without a single line saying so.
   */
  const startedAt = Date.now();

  try {
    if (!isMailConfigured()) {
      log.info('SMTP is not configured; skipping the enquiry notification.');
      return false;
    }

    const { contactEmail } = await getGeneralSettings();
    if (!contactEmail) {
      log.warn('No contact address set in Settings; nowhere to send the enquiry notification.');
      return false;
    }

    await sendMail(buildEnquiryEmail(enquiry, contactEmail));
    log.info(
      `Notified ${contactEmail} of an enquiry from ${enquiry.email} in ${Date.now() - startedAt}ms`,
    );
    return true;
  } catch (error) {
    /*
     * `ENQUIRY_MAIL_FAILED` is a fixed token to search the logs for. The message
     * itself will be reworded one day; something stable has to survive that.
     */
    log.error(
      `ENQUIRY_MAIL_FAILED after ${Date.now() - startedAt}ms: could not send the enquiry notification`,
      error,
    );
    return false;
  }
}

/**
 * Send the notification and record that it went, in one step.
 *
 * Both callers want the same thing — the submission itself and the sweep that
 * retries what the submission could not send — and neither should be able to
 * mark a row notified without having actually notified anyone. Keeping the send
 * and the stamp together is what stops those drifting apart.
 */
export async function notifyAndRecord(
  enquiryId: string,
  enquiry: EnquiryNotification,
): Promise<boolean> {
  const sent = await notifyNewEnquiry(enquiry);
  if (!sent) return false;

  try {
    await prisma.enquiry.update({
      where: { id: enquiryId },
      data: { notifiedAt: new Date() },
    });
  } catch (error) {
    /*
     * The mail went but the stamp did not. Harmless: the sweep will send a
     * second copy one day later, which is a duplicate email rather than a lost
     * enquiry — the right way round for this to fail.
     */
    log.error('Sent the enquiry notification but could not record it', error);
  }

  return true;
}

/**
 * Retry the enquiries whose notification never went.
 *
 * The safety net under `runAfterResponse`. If the platform did not keep the
 * function alive, or Gmail was refusing connections at that moment, the row is
 * sitting there with `notifiedAt` null and nobody has been told about it. This
 * finds those and sends them.
 *
 * OLDEST FIRST: someone has been waiting longest for a reply to that one.
 *
 * Capped per run, because this shares an invocation with the YouTube sync and
 * each send costs a second or two. Anything left over is picked up by the next
 * run — the rows do not go anywhere.
 *
 * The window is what stops it retrying forever. An enquiry that has failed for
 * a fortnight is not going to start working, and the row is still in the admin
 * for the owner to read; continuing to retry it would only crowd out the ones
 * that can still be delivered.
 */
export async function sweepUnsentEnquiries(limit = 10): Promise<{ sent: number; failed: number }> {
  const fortnightAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const pending = await prisma.enquiry.findMany({
    where: { notifiedAt: null, createdAt: { gte: fortnightAgo } },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, name: true, email: true, phone: true, subject: true, message: true },
  });

  if (pending.length === 0) return { sent: 0, failed: 0 };

  let sent = 0;
  for (const row of pending) {
    const ok = await notifyAndRecord(row.id, {
      name: row.name,
      email: row.email,
      phone: row.phone ?? '',
      subject: row.subject ?? '',
      message: row.message,
    });
    if (ok) sent += 1;
  }

  const failed = pending.length - sent;
  log.info(`Enquiry sweep: ${sent} sent, ${failed} still unsent`);
  return { sent, failed };
}
