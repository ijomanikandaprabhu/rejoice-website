import { describe, expect, it } from 'vitest';

/**
 * The branded email template, and the escaping it exists to guarantee.
 *
 * `mailer.ts` sent plain text only, and its comment said why: the body is
 * composed almost entirely of attacker-supplied strings, and plain text removes
 * the HTML-escaping question rather than depending on getting it right. Sending
 * HTML puts that question back. These tests are the answer being checked rather
 * than asserted — anyone can write an escape function, and the ones that are
 * never tested are the ones that miss a character.
 */

import { buildEnquiryEmail } from '@/features/enquiries/notify';
import { escapeHtml, renderMail } from '@/services/mail/template';

describe('escapeHtml', () => {
  it('escapes every character that can change the meaning of HTML', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
    expect(escapeHtml("it's")).toBe('it&#39;s');
  });

  it('escapes the ampersand first, so escapes are not double-escaped', () => {
    // Getting this order wrong turns `<` into `&amp;lt;`, which the reader
    // sees as literal "&lt;" rather than "<".
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves ordinary text alone', () => {
    expect(escapeHtml('Roshan Shelton — Sthotharipen')).toBe('Roshan Shelton — Sthotharipen');
  });
});

describe('renderMail', () => {
  it('escapes values in rows, the message and the action', () => {
    const { html } = renderMail({
      heading: 'New <b>enquiry</b>',
      intro: 'From <em>someone</em>',
      rows: [{ label: 'Name', value: '<img src=x onerror=alert(1)>' }],
      message: '</div><script>alert(1)</script>',
      action: { label: 'Read & reply', href: 'https://example.com/?a=1&b=2' },
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('New <b>enquiry</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Read &amp; reply');
  });

  it('always produces a plain-text part alongside the HTML', () => {
    const { text, html } = renderMail({
      heading: 'New enquiry',
      rows: [{ label: 'Name', value: 'Roshan' }],
      message: 'Hello there',
      action: { label: 'Read and reply', href: 'https://example.com/admin' },
    });

    // A message with no text part renders as nothing in a text-only client and
    // scores worse with spam filters.
    expect(text).toContain('New enquiry');
    expect(text).toContain('Roshan');
    expect(text).toContain('Hello there');
    expect(text).toContain('https://example.com/admin');
    // The text part must be text, not markup with the tags stripped.
    expect(text).not.toContain('<');
    expect(html).toContain('<!doctype html>');
  });

  it('carries the logo with STYLED alt text, for the clients that block images', () => {
    const { html } = renderMail({ heading: 'Anything' });

    expect(html).toContain('/brand/logo-wordmark-light.png');
    expect(html).toContain('alt="REJOICE"');

    /*
     * The styling on the `img` is what a client applies to the text it shows
     * INSTEAD of a blocked image. Without it Gmail draws a torn-page icon and a
     * tiny grey caption; with it, a white wordmark on the dark header. Asserted
     * because it looks like decoration and is the whole reason a blocked
     * message still looks like Rejoice.
     */
    expect(html).toMatch(/alt="REJOICE"[^>]*color:#FFFFFF/);
    expect(html).toMatch(/alt="REJOICE"[^>]*font:700/);
  });

  it('centres the card three ways, because Gmail honours only some of them', () => {
    const { html } = renderMail({ heading: 'Anything' });

    // It arrived right-of-centre in Gmail with `align` on the cell alone.
    expect(html).toContain('margin:0 auto');
    expect(html).toContain('<table align="center"');
    expect(html).toContain('text-align:center');
  });
});

describe('buildEnquiryEmail', () => {
  const enquiry = {
    name: '<script>alert(1)</script>',
    email: 'someone@example.com',
    phone: null,
    subject: 'Booking & rates',
    message: 'Line one\nLine two <b>bold</b>',
  };

  it('never lets an enquiry field reach the HTML unescaped', () => {
    const mail = buildEnquiryEmail(enquiry, 'rejoice@example.com');

    expect(mail.html).toBeDefined();
    expect(mail.html).not.toContain('<script>alert(1)</script>');
    expect(mail.html).toContain('&lt;script&gt;');
    expect(mail.html).toContain('Booking &amp; rates');
    expect(mail.html).not.toContain('<b>bold</b>');
  });

  it('keeps the subject line and reply-to behaviour the mail depended on', () => {
    const mail = buildEnquiryEmail(enquiry, 'rejoice@example.com');

    // The subject is a header, not HTML, and must stay unescaped or the reader
    // sees the entities.
    expect(mail.subject).toBe('New enquiry from <script>alert(1)</script>');
    // Replies go to the person who wrote in, not to the Rejoice account.
    expect(mail.replyTo).toBe('someone@example.com');
    expect(mail.to).toBe('rejoice@example.com');
  });

  it('still sends a readable plain-text part', () => {
    const mail = buildEnquiryEmail(enquiry, 'rejoice@example.com');

    expect(mail.text).toContain('someone@example.com');
    expect(mail.text).toContain('Line one\nLine two');
  });
});
