import { describe, expect, it } from 'vitest';

import {
  VIDEO_OVERRIDE_FIELDS,
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
