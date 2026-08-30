import 'server-only';

import { appConfig } from '@/config/app.config';
import { isMailConfigured } from '@/config/mail.config';
import { getGeneralSettings } from '@/features/settings/queries';
import { createLogger } from '@/lib/logger';
import { sendMail } from '@/services/mail/mailer';

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
 * Plain text on purpose. The body is composed almost entirely of
 * attacker-supplied strings, and plain text removes the HTML-escaping question
 * rather than depending on getting it right.
 */
export function buildEnquiryEmail(enquiry: EnquiryNotification, to: string) {
  const lines = [
    `Name:    ${enquiry.name}`,
    `Email:   ${enquiry.email}`,
    enquiry.phone ? `Phone:   ${enquiry.phone}` : null,
    enquiry.subject ? `Subject: ${enquiry.subject}` : null,
    '',
    enquiry.message,
    '',
    '—',
    `Read and reply in the admin: ${appConfig.url}/admin/enquiries`,
  ].filter((line): line is string => line !== null);

  return {
    to,
    subject: `New enquiry from ${enquiry.name}`,
    text: lines.join('\n'),
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
