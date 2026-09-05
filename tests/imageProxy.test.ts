import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The image route and the loader that feeds it.
 *
 * These exist because this pair replaced Vercel's image optimizer after it ran
 * out of its monthly allowance mid-month, and the route is the only thing on
 * the site that fetches an address a caller supplied. Two properties matter:
 *
 *   - Everything the loader can produce must be accepted, or images silently
 *     stop loading.
 *   - Everything else must be refused BEFORE any upstream request, because a
 *     caller who can invent unlimited distinct URLs can otherwise run up the
 *     metered function time this whole change was made to protect.
 */

import loader, { ACCEPTED_VARIANTS, AVATAR_SIZES, VIDEO_VARIANTS } from '@/lib/images/youtubeLoader';
import { resetRateLimit } from '@/lib/utils/rateLimit';

const { GET } = await import('@/app/api/image/route');

/** The proxied address the loader would emit, decoded back to a plain URL. */
function targetFor(src: string, width: number): string {
  const emitted = loader({ src, width });
  return decodeURIComponent(emitted.replace('/api/image?u=', ''));
}

function call(target: string) {
  return GET(
    new Request(`https://rejoice.test/api/image?u=${encodeURIComponent(target)}`, {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    }),
  );
}

const THUMBNAIL = 'https://i.ytimg.com/vi/0Qj2AIw8o3E/maxresdefault.jpg';
const AVATAR =
  'https://yt3.ggpht.com/ytc/AIdro_lrJ1Q9xwaDoKG_IV90avdn2jkGqKkg-sEdqrNmhsmymA=s800-c-k-c0x00ffffff-no-rj';

let fetched: string[] = [];

beforeEach(() => {
  fetched = [];
  resetRateLimit();
  // Nothing in these tests may reach the network. The spy doubles as the
  // assertion that a refused address is refused before any fetch.
  vi.stubGlobal('fetch', async (input: URL | string) => {
    fetched.push(String(input));
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
    });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the loader and the route agree', () => {
  it('accepts every thumbnail variant the loader can ask for', async () => {
    for (const variant of VIDEO_VARIANTS) {
      const target = targetFor(THUMBNAIL, variant.width);
      // The extension depends on whether a WebP copy is asked for; the variant
      // name is the part that must survive.
      expect(target, `width ${variant.width}`).toContain(`/${variant.name}.`);
      expect((await call(target)).status, target).toBe(200);
    }
  });

  it('accepts every avatar size the loader can ask for', async () => {
    for (const size of AVATAR_SIZES) {
      const target = targetFor(AVATAR, size);
      expect(target, `size ${size}`).toContain(`=s${size}-`);
      expect((await call(target)).status, target).toBe(200);
    }
  });

  /*
   * The bug this guards against: `hqdefault` is 480x360 \u2014 4:3, with black bars
   * baked into the picture \u2014 and the site frames thumbnails in 16:9 boxes.
   * Offering it put dark pillars down both sides of every card in the
   * coverflow carousel.
   */
  it('never asks for a 4:3 variant, whatever width is requested', () => {
    for (let width = 16; width <= 4000; width += 16) {
      const emitted = loader({ src: THUMBNAIL, width });
      expect(emitted, `width ${width}`).not.toMatch(/hqdefault|sddefault|\/default\.jpg/);
    }
  });

  it('still serves the 4:3 variants a stale page may already reference', async () => {
    for (const name of ACCEPTED_VARIANTS) {
      const target = `https://i.ytimg.com/vi/0Qj2AIw8o3E/${name}.jpg`;
      expect((await call(target)).status, name).toBe(200);
    }
  });

  it('leaves this site\u2019s own files alone rather than proxying them', () => {
    expect(loader({ src: '/about/film-video.webp', width: 1080 })).toBe('/about/film-video.webp');
  });
});

describe('the route refuses everything else, without fetching', () => {
  const refused: Array<[string, string]> = [
    ['another host entirely', 'https://evil.example.com/x.jpg'],
    ['a lookalike host', 'https://i.ytimg.com.evil.example.com/vi/0Qj2AIw8o3E/hqdefault.jpg'],
    ['plain http', 'http://i.ytimg.com/vi/0Qj2AIw8o3E/hqdefault.jpg'],
    ['a variant name YouTube does not publish', 'https://i.ytimg.com/vi/0Qj2AIw8o3E/oardefault.jpg'],
    ['a webp under the jpeg directory', 'https://i.ytimg.com/vi/0Qj2AIw8o3E/maxresdefault.webp'],
    ['a jpeg under the webp directory', 'https://i.ytimg.com/vi_webp/0Qj2AIw8o3E/maxresdefault.jpg'],
    ['an invented directory', 'https://i.ytimg.com/vi_raw/0Qj2AIw8o3E/maxresdefault.jpg'],
    ['an id of the wrong length', 'https://i.ytimg.com/vi/0Qj2AIw8o3/hqdefault.jpg'],
    ['a deeper path', 'https://i.ytimg.com/vi/0Qj2AIw8o3E/extra/hqdefault.jpg'],
    ['path traversal', 'https://i.ytimg.com/vi/0Qj2AIw8o3E/../../etc/passwd'],
    ['an avatar size the loader never emits', AVATAR.replace('=s800-', '=s1234-')],
    ['an avatar with no size at all', 'https://yt3.ggpht.com/ytc/AIdro_lrJ1Q9xwa'],
    ['something that is not a URL', 'not-a-url'],
  ];

  for (const [what, target] of refused) {
    it(`refuses ${what}`, async () => {
      const response = await call(target);
      expect(response.status).toBe(400);
      expect(fetched, 'must be refused before any upstream request').toEqual([]);
    });
  }

  it('refuses a missing address', async () => {
    const response = await GET(new Request('https://rejoice.test/api/image'));
    expect(response.status).toBe(400);
    expect(fetched).toEqual([]);
  });
});

describe('the route protects itself from a flood', () => {
  it('cuts off one address after its allowance, and says when to retry', async () => {
    const target = targetFor(THUMBNAIL, 480);

    let last = await call(target);
    for (let i = 0; i < 400 && last.status === 200; i++) last = await call(target);

    expect(last.status).toBe(429);
    expect(Number(last.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('serves an upstream failure briefly rather than for a year', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 404 }));

    const response = await call(targetFor(THUMBNAIL, 480));

    expect(response.status).toBe(502);
    // A thumbnail YouTube has not generated yet must be able to appear later.
    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('refuses an upstream response that is not an image', async () => {
    vi.stubGlobal(
      'fetch',
      async () =>
        new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    );

    expect((await call(targetFor(THUMBNAIL, 480))).status).toBe(502);
  });
});

/*
 * WebP halves the bytes — 135KB becomes 68KB on this catalogue — but YouTube
 * has not generated one for every video, and a miss must not become a broken
 * image on the page.
 */
describe('the WebP copy, and what happens when there is not one', () => {
  it('asks for WebP at the large size and plain JPEG at the small one', () => {
    expect(loader({ src: THUMBNAIL, width: 1280 })).toContain('vi_webp');
    expect(loader({ src: THUMBNAIL, width: 1280 })).toContain('.webp');
    // mqdefault's WebP is BIGGER than its JPEG, so it stays a JPEG.
    expect(loader({ src: THUMBNAIL, width: 320 })).toContain('mqdefault.jpg');
  });

  it('falls back to the JPEG when the WebP is missing', async () => {
    vi.stubGlobal('fetch', async (input: URL | string) => {
      const url = String(input);
      fetched.push(url);
      if (url.includes('vi_webp')) return new Response('nope', { status: 404 });
      return new Response(new Uint8Array([1]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });
    });

    const response = await call(targetFor(THUMBNAIL, 1280));

    expect(response.status).toBe(200);
    expect(fetched[0]).toContain('vi_webp');
    expect(fetched[1]).toContain('/vi/0Qj2AIw8o3E/maxresdefault.jpg');
  });

  it('does not make a second request when the WebP is there', async () => {
    await call(targetFor(THUMBNAIL, 1280));
    expect(fetched).toHaveLength(1);
  });
});
