import { describe, expect, it } from 'vitest';

import { isVertical } from '@/services/youtube/youtubeClient';

/**
 * A video is classified as a Short by its shape, not its length.
 *
 * The dimensions below are the real values YouTube returned for Rejoice videos
 * when asked for `part=player&maxWidth=480`, so these are not invented shapes.
 */
describe('isVertical', () => {
  it('treats a 9:16 video as vertical', () => {
    expect(isVertical({ embedWidth: '480', embedHeight: '853' })).toBe(true);
  });

  it('treats a 16:9 video as not vertical', () => {
    expect(isVertical({ embedWidth: '480', embedHeight: '270' })).toBe(false);
  });

  /*
   * The failure mode this guards against is silent: if a caller forgets the
   * `maxWidth` parameter YouTube omits these fields entirely, and without this
   * check every video in the catalogue would quietly classify as landscape.
   */
  it('falls back to not-vertical when the player block is missing', () => {
    expect(isVertical(undefined)).toBe(false);
    expect(isVertical({})).toBe(false);
  });

  it('rejects unusable dimensions rather than guessing', () => {
    expect(isVertical({ embedWidth: '0', embedHeight: '853' })).toBe(false);
    expect(isVertical({ embedWidth: 'abc', embedHeight: '853' })).toBe(false);
  });

  it('treats an exactly square video as not vertical', () => {
    expect(isVertical({ embedWidth: '480', embedHeight: '480' })).toBe(false);
  });
});
