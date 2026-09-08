import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildEnquiryEmail, notifyNewEnquiry } from '@/features/enquiries/notify';

const sendMail = vi.fn();
vi.mock('@/services/mail/mailer', () => ({ sendMail: (...args: unknown[]) => sendMail(...args) }));
vi.mock('@/features/settings/queries', () => ({
  getGeneralSettings: async () => ({ contactEmail: 'rejoicegospelcommunications@gmail.com' }),
}));

const TO = 'rejoicegospelcommunications@gmail.com';

describe('buildEnquiryEmail', () => {
  const enquiry = {
    name: 'Blessy Catherine',
    email: 'blessy@example.com',
    phone: '+91 91766 00765',
    subject: 'Music video enquiry',
    message: 'We would like a quote for a worship video.',
  };

  it('names the sender in the subject, so the inbox is scannable', () => {
    expect(buildEnquiryEmail(enquiry, TO).subject).toBe('New enquiry from Blessy Catherine');
  });

  it('carries every detail the reader needs', () => {
    const { text } = buildEnquiryEmail(enquiry, TO);

    expect(text).toContain('Blessy Catherine');
    expect(text).toContain('blessy@example.com');
    expect(text).toContain('+91 91766 00765');
    expect(text).toContain('Music video enquiry');
    expect(text).toContain('We would like a quote for a worship video.');
  });

  it('links straight to the admin screen', () => {
    expect(buildEnquiryEmail(enquiry, TO).text).toContain('/admin/enquiries');
  });

  /*
   * The detail that makes the notification usable. The mail travels from the
   * Rejoice account to the Rejoice account, so without an explicit reply-to,
   * hitting Reply in Gmail would address it to yourself rather than the person
   * who wrote in.
   */
  it('sets reply-to to the enquirer, not the Rejoice address', () => {
    const built = buildEnquiryEmail(enquiry, TO);

    expect(built.replyTo).toBe('blessy@example.com');
    expect(built.to).toBe(TO);
  });

  it('omits optional lines rather than printing empty labels', () => {
    const { text } = buildEnquiryEmail(
      { name: 'Anon', email: 'anon@example.com', message: 'Hello', phone: null, subject: null },
      TO,
    );

    expect(text).not.toContain('Phone:');
    expect(text).not.toContain('Subject:');
    expect(text).toContain('Hello');
  });
});

/**
 * The guarantee the contact route depends on and does not make itself: a mail
 * problem must never turn a stored enquiry into a failure for the visitor.
 *
 * The route awaits this function with no try/catch of its own, so if the
 * swallowing here were ever removed, someone whose message WAS saved would be
 * told it was not. That is the worst outcome the contact form has.
 */
describe('notifyNewEnquiry', () => {
  const enquiry = {
    name: 'Blessy Catherine',
    email: 'blessy@example.com',
    phone: '',
    subject: '',
    message: 'We would like a quote for a worship video.',
  };

  beforeEach(() => {
    sendMail.mockReset();
    vi.stubEnv('SMTP_USER', 'sender@example.com');
    vi.stubEnv('SMTP_PASSWORD', 'app-password');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('reports failure rather than throwing when the send fails', async () => {
    sendMail.mockRejectedValue(new Error('SMTP refused the connection'));

    // `false` is what leaves `notifiedAt` null, so the daily sweep retries it.
    await expect(notifyNewEnquiry(enquiry)).resolves.toBe(false);
  });

  it('logs a fixed token on failure, so the logs can be searched for it', async () => {
    sendMail.mockRejectedValue(new Error('SMTP refused the connection'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await notifyNewEnquiry(enquiry);

    expect(error.mock.calls.flat().join(' ')).toContain('ENQUIRY_MAIL_FAILED');
  });

  it('reports failure, without throwing, when SMTP is not configured at all', async () => {
    vi.stubEnv('SMTP_USER', '');
    vi.stubEnv('SMTP_PASSWORD', '');

    await expect(notifyNewEnquiry(enquiry)).resolves.toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('reports success when the mail goes', async () => {
    sendMail.mockResolvedValue(true);

    await expect(notifyNewEnquiry(enquiry)).resolves.toBe(true);
  });
});
