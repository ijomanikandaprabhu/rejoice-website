import { describe, expect, it } from 'vitest';

import { buildEnquiryEmail } from '@/features/enquiries/notify';

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
