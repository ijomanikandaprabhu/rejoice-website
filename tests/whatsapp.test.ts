import { describe, expect, it } from 'vitest';

import { buildEnquiryWhatsappText, whatsappEnquiryUrl, whatsappNumber } from '@/lib/whatsapp';

/**
 * The contact form's WhatsApp button is built from these two functions, and the
 * number one is the reason there is a test file at all: `contactPhone` in
 * Settings is free text, so everything here is about refusing to build a link
 * that would fail in front of a visitor.
 */

describe('whatsappNumber', () => {
  it('reduces an international number to the digits wa.me wants', () => {
    expect(whatsappNumber('+91 91766 00765')).toBe('919176600765');
  });

  it('does not care how the number is punctuated', () => {
    expect(whatsappNumber('+91-91766-00765')).toBe('919176600765');
    expect(whatsappNumber('(+91) 91766 00765')).toBe('919176600765');
    expect(whatsappNumber('  +91 91766 00765  ')).toBe('919176600765');
  });

  it('refuses a number with no country code, rather than guessing one', () => {
    /*
     * The important case. `098765 43210` is a real number to whoever typed it,
     * but nothing says which country — and wa.me answers a wrong guess with a
     * 404, or worse, a stranger.
     */
    expect(whatsappNumber('098765 43210')).toBeNull();
    expect(whatsappNumber('91766 00765')).toBeNull();
    expect(whatsappNumber('(0422) 123-4567')).toBeNull();
  });

  it('refuses nothing at all, which is the default in Settings', () => {
    expect(whatsappNumber('')).toBeNull();
    expect(whatsappNumber('   ')).toBeNull();
    expect(whatsappNumber(null)).toBeNull();
    expect(whatsappNumber(undefined)).toBeNull();
  });

  it('refuses lengths no phone number has', () => {
    expect(whatsappNumber('+123')).toBeNull();
    expect(whatsappNumber('+1234567890123456')).toBeNull();
  });
});

describe('buildEnquiryWhatsappText', () => {
  const enquiry = {
    name: 'Blessy Catherine',
    email: 'blessy@example.com',
    phone: '+91 90000 11111',
    subject: 'Video Production',
    message: 'We would like a quote for a worship video.',
  };

  it('speaks as the visitor, not as the label', () => {
    const text = buildEnquiryWhatsappText(enquiry);

    /*
     * It arrives in a personal inbox appearing to come from the enquirer, so
     * the email's framing — "New enquiry from …" — would read as nonsense.
     */
    expect(text).toContain("Hello Rejoice, I'm Blessy Catherine.");
    expect(text).not.toContain('New enquiry');
  });

  it('carries everything the reader needs to reply', () => {
    const text = buildEnquiryWhatsappText(enquiry);

    expect(text).toContain('Video Production');
    expect(text).toContain('We would like a quote for a worship video.');
    expect(text).toContain('blessy@example.com');
    expect(text).toContain('+91 90000 11111');
  });

  it('drops the fields that were left blank instead of showing empty labels', () => {
    const text = buildEnquiryWhatsappText({ ...enquiry, phone: '', subject: '' });

    expect(text).toContain("Hello Rejoice, I'm Blessy Catherine.");
    expect(text).toContain('You can reach me at blessy@example.com.');
    expect(text).not.toContain('interested in');
    expect(text).not.toContain(' or ');
  });
});

describe('whatsappEnquiryUrl', () => {
  const enquiry = {
    name: 'Blessy Catherine',
    email: 'blessy@example.com',
    message: 'A quote, please.',
  };

  it('builds a wa.me link with the message encoded into it', () => {
    const url = whatsappEnquiryUrl('+91 91766 00765', enquiry);

    expect(url).toMatch(/^https:\/\/wa\.me\/919176600765\?text=/);
    expect(decodeURIComponent(url!.split('?text=')[1])).toBe(buildEnquiryWhatsappText(enquiry));
  });

  it('builds nothing when the number cannot be trusted', () => {
    // The component uses this to decide whether the button exists at all.
    expect(whatsappEnquiryUrl('098765 43210', enquiry)).toBeNull();
    expect(whatsappEnquiryUrl('', enquiry)).toBeNull();
  });
});
