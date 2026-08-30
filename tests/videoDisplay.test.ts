import { describe, expect, it } from 'vitest';

import {
  VIDEO_OVERRIDE_FIELDS,
  buildMetaDescription,
  clearedOverrides,
  fallbackThumbnailUrl,
  resolveVideoDisplay,
  type DisplayableVideo,
} from '@/lib/utils/videoDisplay';

/** Section 18 — the website value wins, otherwise the YouTube value shows. */

function makeVideo(overrides: Partial<DisplayableVideo> = {}): DisplayableVideo {
  return {
    id: 'v1',
    youtubeVideoId: 'abc123XYZ',
    youtubeTitle: 'REJOICE GOSPEL COMMUNICATIONS NEW WORSHIP SONG 2026 OFFICIAL VIDEO',
    youtubeDescription: 'First paragraph of the YouTube description.\n\nSecond paragraph.',
    youtubeThumbnail: 'https://i.ytimg.com/vi/abc123XYZ/maxresdefault.jpg',
    youtubePublishedAt: new Date('2026-01-15T10:00:00Z'),
    youtubeUrl: 'https://www.youtube.com/watch?v=abc123XYZ',
    displayTitle: null,
    displayDescription: null,
    displayThumbnail: null,
    showChannelName: true,
    seoTitle: null,
    seoDescription: null,
    ...overrides,
  };
}

describe('resolveVideoDisplay', () => {
  it('falls back to the YouTube values when no overrides are set', () => {
    const video = makeVideo();
    const resolved = resolveVideoDisplay(video);

    expect(resolved.title).toBe(video.youtubeTitle);
    expect(resolved.description).toBe(video.youtubeDescription);
    expect(resolved.thumbnail).toBe(video.youtubeThumbnail);
    expect(resolved.publishedAt).toEqual(video.youtubePublishedAt);
  });

  it('prefers the website values when the administrator has set them', () => {
    const resolved = resolveVideoDisplay(
      makeVideo({
        displayTitle: 'New Worship Release 2026',
        displayDescription: 'A short website description.',
        displayThumbnail: 'https://cdn.rejoice.example/custom.jpg',
      }),
    );

    expect(resolved.title).toBe('New Worship Release 2026');
    expect(resolved.description).toBe('A short website description.');
    expect(resolved.thumbnail).toBe('https://cdn.rejoice.example/custom.jpg');
  });

  it('treats a whitespace-only override as not set', () => {
    const video = makeVideo({ displayTitle: '   ' });
    expect(resolveVideoDisplay(video).title).toBe(video.youtubeTitle);
  });

  it('derives a thumbnail from the video ID when YouTube gave none', () => {
    const resolved = resolveVideoDisplay(makeVideo({ youtubeThumbnail: null }));
    expect(resolved.thumbnail).toBe(fallbackThumbnailUrl('abc123XYZ'));
  });

  it('falls SEO fields back to the resolved title and description', () => {
    const resolved = resolveVideoDisplay(makeVideo({ displayTitle: 'New Worship Release 2026' }));
    expect(resolved.seoTitle).toBe('New Worship Release 2026');
    expect(resolved.seoDescription.length).toBeLessThanOrEqual(160);
  });
});

describe('clearedOverrides — "Reset to YouTube Details" (section 19)', () => {
  it('nulls every override field', () => {
    const cleared = clearedOverrides();
    for (const field of VIDEO_OVERRIDE_FIELDS) {
      expect(cleared[field]).toBeNull();
    }
  });

  it('does not touch publishing decisions', () => {
    const keys = Object.keys(clearedOverrides());
    for (const publishing of ['isVisible', 'isAiDisclosed']) {
      expect(keys).not.toContain(publishing);
    }
  });

  it('restores the YouTube values once applied', () => {
    const customised = makeVideo({
      displayTitle: 'New Worship Release 2026',
      displayThumbnail: 'https://cdn.rejoice.example/custom.jpg',
    });
    expect(resolveVideoDisplay(customised).title).toBe('New Worship Release 2026');

    const reset = { ...customised, ...clearedOverrides() };
    expect(resolveVideoDisplay(reset).title).toBe(customised.youtubeTitle);
    expect(resolveVideoDisplay(reset).thumbnail).toBe(customised.youtubeThumbnail);
  });
});

/**
 * The automatic meta description.
 *
 * Every fixture here is the real shape of a Rejoice description, taken from the
 * live catalogue. Before this existed the published description was the raw
 * text cut at 160 characters, which for most of these is a row of dashes.
 */
describe('buildMetaDescription', () => {
  const TITLE = 'Some Song | Rejoice';

  it('composes a sentence from the credit sheet', () => {
    const out = buildMetaDescription(
      [
        'Song : UMMAI ARATHIPPEN',
        'Album : ELLAM AAGUM - 2',
        'Sung By : Eva.JEEVA',
        'Music: ALWYN . M',
        'Keys :ALWYN, KINGSLEY DAVIS',
      ].join('\n'),
      TITLE,
    );

    expect(out).toContain('UMMAI ARATHIPPEN');
    expect(out).toContain('sung by Eva.JEEVA');
    expect(out).toContain('from the album ELLAM AAGUM - 2');
  });

  it('does not report "SINGLE" as an album', () => {
    const out = buildMetaDescription('Song : Neerea\nAlbum : Single\nMusic : Reegan', TITLE);
    expect(out).toContain('Neerea');
    expect(out).not.toMatch(/album/i);
  });

  it('strips a separator rule that follows real text on the same line', () => {
    // This exact line published a description that was almost entirely dashes.
    const out = buildMetaDescription(
      'ஆயிரம் ஸ்தோத்திர பலிகள் - 1000 praises to god ' + '-'.repeat(120),
      TITLE,
    );
    expect(out).toContain('1000 praises to god');
    expect(out).not.toContain('---');
  });

  it('ignores promotional lines', () => {
    const out = buildMetaDescription(
      [
        '🤝Enjoy And Stay Connected With Us🤝',
        'Subscribe to Rejoice Gospel communications : http://bit.ly/RejoiceGospelGCSubscribe',
        'Like and Follow us on Facebook',
      ].join('\n'),
      TITLE,
    );
    expect(out).not.toMatch(/subscribe|connected|facebook/i);
  });

  it('ignores a list of streaming platforms', () => {
    const out = buildMetaDescription(
      ['Listen to "Neerae" on your favorite Streaming Platforms.', 'Gaana -', 'Spotify -', 'Wynk -'].join('\n'),
      TITLE,
    );
    expect(out).not.toMatch(/spotify|gaana|wynk/i);
  });

  it('rejects a credit written with a dash instead of a colon', () => {
    const out = buildMetaDescription('Lyrics,Tune-Rev.H.Immanuel Jacob', TITLE);
    expect(out).not.toContain('Immanuel Jacob');
  });

  it('keeps a description that is already good', () => {
    const prose =
      'A live worship recording from the Rejoice Christmas gathering in Chennai, featuring the full choir and orchestra.';
    expect(buildMetaDescription(prose, TITLE)).toBe(prose);
  });

  it('falls back to the title, without its hashtags, when nothing survives', () => {
    const out = buildMetaDescription('#Shorts #worship\n\n' + '='.repeat(80), 'மௌனமாய் இருக்காதே #Shorts');
    expect(out).toBe('மௌனமாய் இருக்காதே');
  });

  it('never returns empty, and never exceeds 160 characters', () => {
    for (const input of ['', '---', '#a', 'x'.repeat(4000), 'Song : ' + 'y'.repeat(400)]) {
      const out = buildMetaDescription(input, TITLE);
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThanOrEqual(160);
    }
  });
});
