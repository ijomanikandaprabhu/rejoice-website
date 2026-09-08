import { describe, expect, it } from 'vitest';

import { publishedShare } from '@/features/dashboard/queries';

/**
 * The dashboard's "N% of the catalogue" figure.
 *
 * Every case here is a boundary, because the middle of the range was never the
 * problem — 640 of 1,000 is 64% under any rounding. What matters is that 100
 * and 0 mean what they say, since those are the two readings the owner would
 * act on.
 */
describe('publishedShare', () => {
  it('says 100 only when every video is public', () => {
    expect(publishedShare(1662, 1662)).toBe(100);
  });

  it('does not round a nearly-complete catalogue up to 100', () => {
    // The live figure that prompted this: six videos hidden, reported as 100%.
    expect(publishedShare(1656, 1662)).toBe(99);
  });

  it('does not round a nearly-empty catalogue down to 0', () => {
    // The same error in reverse: "0%" would read as nothing being live.
    expect(publishedShare(1, 1000)).toBe(1);
    expect(publishedShare(4, 1000)).toBe(1);
  });

  it('says 0 only when nothing is public', () => {
    expect(publishedShare(0, 1662)).toBe(0);
  });

  it('reports 0 rather than dividing by zero on an empty catalogue', () => {
    expect(publishedShare(0, 0)).toBe(0);
  });

  it('floors the ordinary middle of the range', () => {
    expect(publishedShare(1, 2)).toBe(50);
    expect(publishedShare(2, 3)).toBe(66);
  });

  it('survives a visible count above the total rather than printing over 100', () => {
    // Not expected, but the two counts come from separate queries.
    expect(publishedShare(5, 4)).toBe(100);
  });
});
