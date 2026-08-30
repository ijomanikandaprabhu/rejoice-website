import { describe, expect, it } from 'vitest';

import { parseIsoDuration } from '@/services/youtube/youtubeClient';

/**
 * `parseIsoDuration` had no test at all, which is how a live-broadcast duration
 * of `P0D` was able to parse to 0 and get written over a real stored value.
 *
 * The contract: return seconds when YouTube actually reported a length, and
 * `null` for everything else — missing, malformed, or zero. `null` is what the
 * sync treats as "unknown, leave the stored value alone".
 */
describe('parseIsoDuration', () => {
  it('parses hours, minutes and seconds', () => {
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
  });

  it('parses hours on their own', () => {
    expect(parseIsoDuration('PT2H')).toBe(7200);
  });

  it('parses a bare minute', () => {
    expect(parseIsoDuration('PT1M')).toBe(60);
  });

  it('parses days', () => {
    expect(parseIsoDuration('P1DT1H')).toBe(90000);
  });

  it('parses weeks, which the pattern used to omit entirely', () => {
    expect(parseIsoDuration('P1W')).toBe(604800);
  });

  it('rounds fractional seconds instead of failing on them', () => {
    expect(parseIsoDuration('PT1.5S')).toBe(2);
    expect(parseIsoDuration('PT10.4S')).toBe(10);
  });

  /*
   * The reason this file exists. A live or upcoming broadcast reports `P0D`;
   * treating that as a real zero let it overwrite a genuine duration, and the
   * public card then showed no runtime at all.
   */
  it('treats a zero-length duration as unknown, not as zero', () => {
    expect(parseIsoDuration('P0D')).toBeNull();
    expect(parseIsoDuration('PT0S')).toBeNull();
  });

  it('returns null for missing or empty input', () => {
    expect(parseIsoDuration(undefined)).toBeNull();
    expect(parseIsoDuration('')).toBeNull();
  });

  it('returns null for malformed input rather than a wrong number', () => {
    expect(parseIsoDuration('garbage')).toBeNull();
    expect(parseIsoDuration('4M13S')).toBeNull();
    expect(parseIsoDuration('PTM')).toBeNull();
  });
});
