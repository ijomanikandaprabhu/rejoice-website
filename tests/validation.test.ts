import { describe, expect, it } from 'vitest';

import { parseChannelUrl, parseIsoDuration } from '@/services/youtube/youtubeClient';
import { rateLimit, resetRateLimit } from '@/lib/utils/rateLimit';
import {
  adminPasswordSchema,
  contactSchema,
  loginSchema,
  updateVideoSchema,
} from '@/lib/validation';

describe('contactSchema', () => {
  const valid = {
    name: 'Grace Mensah',
    email: 'grace@example.com',
    message: 'I would like to book a recording session for our choir.',
  };

  it('accepts a well-formed enquiry', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = contactSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects a message that is too short', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'hi' }).success).toBe(false);
  });

  /*
   * The schema must ACCEPT a filled honeypot, and the route decides what to do
   * with it.
   *
   * It used to reject one, which meant a bot got a 400 whose field errors named
   * `website` — pointing straight at the trap and teaching it to leave the field
   * blank next time. Parsing has to succeed for the route to be able to answer
   * with the ordinary success response instead.
   */
  it('accepts a filled honeypot so the route can answer as if it worked', () => {
    const result = contactSchema.safeParse({ ...valid, website: 'spam' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.website).toBe('spam');
  });

  it('allows phone and subject to be omitted', () => {
    const result = contactSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

/*
 * Sign-in takes an email address OR a short User ID, so that reaching the admin
 * on a phone does not mean typing a long address. Both are identifiers; the
 * password is still the only thing that grants access.
 */
describe('loginSchema', () => {
  const check = (identifier: string) =>
    loginSchema.safeParse({ identifier, password: 'a-real-password' });

  it('accepts an email address', () => {
    expect(check('rejoicegospelcommunications@gmail.com').success).toBe(true);
  });

  it('accepts a User ID', () => {
    expect(check('1975').success).toBe(true);
  });

  it('trims surrounding space rather than rejecting it', () => {
    const result = check('  1975  ');
    expect(result.success).toBe(true);
    expect(result.success && result.data.identifier).toBe('1975');
  });

  const rejected = ['', '   ', 'abc', '19 75', '19-75', 'not@an', '1975@'];

  for (const value of rejected) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(check(value).success).toBe(false);
    });
  }

  it('still requires a password', () => {
    expect(loginSchema.safeParse({ identifier: '1975', password: '' }).success).toBe(false);
  });
});

describe('updateVideoSchema', () => {
  const base = {
    id: 'video-1',
    isVisible: true,
    showChannelName: true,
    isAiDisclosed: false,
  };

  it('never accepts a youtubeVideoId (Rule 8)', () => {
    const result = updateVideoSchema.parse({ ...base, youtubeVideoId: 'hacked' });
    expect(result).not.toHaveProperty('youtubeVideoId');
  });

  it('turns empty overrides into null so the YouTube value is used', () => {
    const result = updateVideoSchema.parse({ ...base, displayTitle: '   ' });
    expect(result.displayTitle).toBeNull();
  });

  it('keeps a real override', () => {
    const result = updateVideoSchema.parse({ ...base, displayTitle: 'New Worship Release 2026' });
    expect(result.displayTitle).toBe('New Worship Release 2026');
  });
});

describe('adminPasswordSchema', () => {
  const base = { currentPassword: 'old-password' };

  it('requires the confirmation to match', () => {
    const result = adminPasswordSchema.safeParse({
      ...base,
      newPassword: 'StrongPass1',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
  });

  it('requires length and mixed characters', () => {
    expect(
      adminPasswordSchema.safeParse({ ...base, newPassword: 'short1A', confirmPassword: 'short1A' })
        .success,
    ).toBe(false);

    expect(
      adminPasswordSchema.safeParse({
        ...base,
        newPassword: 'alllowercase1',
        confirmPassword: 'alllowercase1',
      }).success,
    ).toBe(false);
  });

  it('accepts a strong password', () => {
    expect(
      adminPasswordSchema.safeParse({
        ...base,
        newPassword: 'RejoiceGospel2026',
        confirmPassword: 'RejoiceGospel2026',
      }).success,
    ).toBe(true);
  });
});

describe('parseChannelUrl', () => {
  it('reads a handle URL', () => {
    expect(parseChannelUrl('https://www.youtube.com/@RejoiceGospelCommunications')).toEqual({
      type: 'handle',
      value: 'RejoiceGospelCommunications',
    });
  });

  it('reads a /channel/ URL', () => {
    expect(parseChannelUrl('https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv')).toEqual({
      type: 'id',
      value: 'UCabcdefghijklmnopqrstuv',
    });
  });

  it('reads a legacy /c/ URL', () => {
    expect(parseChannelUrl('https://www.youtube.com/c/RejoiceMusic')).toEqual({
      type: 'legacy',
      value: 'RejoiceMusic',
    });
  });

  it('accepts a bare handle and a bare channel ID', () => {
    expect(parseChannelUrl('@Rejoice')).toEqual({ type: 'handle', value: 'Rejoice' });
    expect(parseChannelUrl('UCabcdefghijklmnopqrstuv')).toEqual({
      type: 'id',
      value: 'UCabcdefghijklmnopqrstuv',
    });
  });

  it('rejects a non-YouTube URL', () => {
    expect(parseChannelUrl('https://vimeo.com/rejoice')).toBeNull();
    expect(parseChannelUrl('')).toBeNull();
  });
});

describe('parseIsoDuration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT4M13S')).toBe(253);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT45S')).toBe(45);
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});

describe('rateLimit', () => {
  it('allows up to the limit then blocks', () => {
    resetRateLimit('test-key');

    for (let i = 0; i < 5; i++) {
      expect(rateLimit('test-key', 5, 60_000).allowed).toBe(true);
    }

    const blocked = rateLimit('test-key', 5, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('tracks keys independently', () => {
    resetRateLimit();
    rateLimit('ip-a', 1, 60_000);
    expect(rateLimit('ip-a', 1, 60_000).allowed).toBe(false);
    expect(rateLimit('ip-b', 1, 60_000).allowed).toBe(true);
  });
});
