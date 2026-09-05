import { describe, expect, it } from 'vitest';

/**
 * Songs and the platforms they can be heard on.
 *
 * The rules worth pinning are the ones a form cannot enforce for itself: what
 * counts as a usable link, and what happens to a row someone left blank.
 */

import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  platformSchema,
  songLinkSchema,
  songSchema,
} from '@/lib/validation';
import { slugify } from '@/lib/utils';

describe('songSchema', () => {
  const valid = { title: 'Devan', artist: 'Elisha Isaac', description: '', releasedAt: '' };

  it('needs a title', () => {
    expect(songSchema.safeParse({ ...valid, title: '   ' }).success).toBe(false);
  });

  it('accepts a song with nothing but a title', () => {
    const result = songSchema.safeParse({ title: 'Devan' });
    expect(result.success).toBe(true);
  });

  it('takes a release date from the date picker', () => {
    expect(songSchema.safeParse({ ...valid, releasedAt: '2026-03-14' }).success).toBe(true);
  });

  it('refuses a date typed in some other shape', () => {
    for (const bad of ['14/03/2026', '2026-3-4', 'March 2026']) {
      expect(songSchema.safeParse({ ...valid, releasedAt: bad }).success, bad).toBe(false);
    }
  });

  it('allows the date to be left empty', () => {
    expect(songSchema.safeParse({ ...valid, releasedAt: '' }).success).toBe(true);
  });
});

describe('songLinkSchema', () => {
  const platformId = 'ckplatform000';

  it('accepts an https link', () => {
    const result = songLinkSchema.safeParse({
      platformId,
      url: 'https://open.spotify.com/track/abc',
    });
    expect(result.success).toBe(true);
  });

  /*
   * http, not https: these are links a visitor clicks from our page, and
   * sending them somewhere unencrypted is a downgrade we would be responsible
   * for. Every streaming service supports https.
   */
  it('refuses a plain http link', () => {
    expect(
      songLinkSchema.safeParse({ platformId, url: 'http://open.spotify.com/track/abc' }).success,
    ).toBe(false);
  });

  it('refuses something that is not a link at all', () => {
    for (const bad of ['spotify', 'open.spotify.com/track/abc', '', 'javascript:alert(1)']) {
      expect(songLinkSchema.safeParse({ platformId, url: bad }).success, bad).toBe(false);
    }
  });

  it('needs a platform', () => {
    expect(songLinkSchema.safeParse({ platformId: '', url: 'https://example.com' }).success).toBe(
      false,
    );
  });
});

describe('platformSchema', () => {
  it('needs a name', () => {
    expect(platformSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(platformSchema.safeParse({ name: 'Spotify' }).success).toBe(true);
  });
});

describe('song addresses', () => {
  it('turns a title into the address it will live at', () => {
    expect(slugify('Abrahamin Devan')).toBe('abrahamin-devan');
    expect(slugify('ஸ்தோத்திரம் | Karaoke')).toBe('karaoke');
  });

  /*
   * A title of nothing but punctuation or non-Latin script slugifies to an
   * empty string, which would be an unreachable address. `addSongAction` falls
   * back to 'song' for exactly this.
   */
  it('can produce nothing, which the action has to handle', () => {
    expect(slugify('ஸ்தோத்திரம்')).toBe('');
  });
});

describe('what may be uploaded', () => {
  it('allows the three formats a browser can produce', () => {
    expect([...IMAGE_MIME_TYPES]).toEqual(['image/webp', 'image/png', 'image/jpeg']);
  });

  /*
   * The ceiling is generous next to a real upload — the browser downscales a
   * 3000x3000 cover to roughly 150KB — because it exists to catch a file that
   * skipped the resize, not to second-guess the encoder. It must stay well
   * under Vercel's ~4.5MB request limit, or the rejection would arrive as a
   * platform error rather than our sentence.
   */
  it('caps an upload below the platform request limit', () => {
    expect(MAX_IMAGE_BYTES).toBeLessThan(4_000_000);
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(500_000);
  });
});
