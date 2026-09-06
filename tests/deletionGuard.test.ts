import { describe, expect, it } from 'vitest';

/**
 * The guard on the deletion pass.
 *
 * The nightly sync now walks the whole uploads playlist and removes anything
 * the playlist no longer offers, because Rejoice asked for videos deleted on
 * YouTube to leave the website. That is a `deleteMany` driven by an external
 * API's response, which makes this rule the last thing between a truncated
 * playlist and an emptied catalogue — so it is tested rather than reasoned
 * about.
 */

import { refusesDeletion } from '@/services/youtube/videoSyncService';

describe('refusesDeletion', () => {
  it('allows the ordinary case: a handful of videos taken down', () => {
    expect(refusesDeletion(1755, 1)).toBe(false);
    expect(refusesDeletion(1755, 50)).toBe(false);
    // Exactly at the threshold is still allowed — the rule is "more than".
    expect(refusesDeletion(100, 20)).toBe(false);
  });

  it('refuses when a suspicious share of the channel has vanished', () => {
    expect(refusesDeletion(100, 21)).toBe(true);
    expect(refusesDeletion(1755, 900)).toBe(true);
    // The case this exists for: YouTube serves one page and the walk still
    // reports itself complete.
    expect(refusesDeletion(1755, 1705)).toBe(true);
  });

  it('does nothing when there is nothing to do', () => {
    expect(refusesDeletion(1755, 0)).toBe(false);
    expect(refusesDeletion(0, 0)).toBe(false);
  });

  it('does not refuse a small channel losing one video', () => {
    // 1 of 93 is 1%, well under the threshold — a small channel must not be
    // held to a stricter standard than a large one by accident.
    expect(refusesDeletion(93, 1)).toBe(false);
  });

  it('refuses a small channel losing most of itself', () => {
    expect(refusesDeletion(5, 4)).toBe(true);
  });
});
