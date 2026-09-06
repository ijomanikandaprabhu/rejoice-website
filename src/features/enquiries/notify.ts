import 'server-only';

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
 */
export async function notifyNewEnquiry(enquiry: EnquiryNotification): Promise<void> {
  try {
    if (!isMailConfigured()) {
      log.info('SMTP is not configured; skipping the enquiry notification.');
      return;
    }

    const { contactEmail } = await getGeneralSettings();
    if (!contactEmail) {
      log.warn('No contact address set in Settings; nowhere to send the enquiry notification.');
      return;
    }

    await sendMail(buildEnquiryEmail(enquiry, contactEmail));
    log.info(`Notified ${contactEmail} of an enquiry from ${enquiry.email}`);
  } catch (error) {
    log.error('Could not send the enquiry notification', error);
  }
}
