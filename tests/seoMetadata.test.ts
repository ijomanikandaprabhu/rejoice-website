import { describe, expect, it } from 'vitest';

import { searchTitle } from '@/lib/utils/videoDisplay';
import { listingMetadata } from '@/lib/seo';

/**
 * Two rules that only exist because the live site was getting them wrong.
 *
 * Neither is visible on the page, which is exactly why they are tested. A
 * canonical pointing at the wrong URL and a title truncated mid-credit both
 * look completely fine in a browser and cost you in search.
 */

describe('searchTitle', () => {
  it('keeps the song name from a pipe-separated YouTube title', () => {
    expect(
      searchTitle(
        'Sthotharipen  | Roshan shelton (Sri Lanka) | Amos | Latest Worship Song | Official Music Video | 4K',
      ),
    ).toBe('Sthotharipen');
  });

  it('leaves a title with no pipe exactly as it is', () => {
    // Nothing marks a safe cut in a plain title, so it is not cut at all.
    const plain = 'A very long worship song title that simply has no separators in it at all';
    expect(searchTitle(plain)).toBe(plain);
  });

  it('falls back to the whole title when the first segment is not a name', () => {
    // A leading pipe yields an empty first segment, and "4K" a meaningless
    // one. Both fall back to the title whole rather than to a fragment: a long
    // correct title beats a short useless one.
    expect(searchTitle('| Real Song Name | 4K')).toBe('| Real Song Name | 4K');
    expect(searchTitle('4K | Real Song Name')).toBe('4K | Real Song Name');
  });

  it('collapses the double spaces YouTube titles are full of', () => {
    expect(searchTitle('Sthotharipen   | Amos')).toBe('Sthotharipen');
  });
});

describe('listingMetadata', () => {
  const base = {
    title: 'All songs',
    description: 'Every release.',
    basePath: '/songs/all',
  };

  it('gives page one the bare path, with no ?page=1', () => {
    // Asserted as a suffix, not a full URL: the host comes from
    // `appConfig.url`, which is the deployment's own address and is localhost
    // under test. The path is what this function decides.
    const meta = listingMetadata({ ...base, page: 1 });
    expect(String(meta.alternates?.canonical)).toMatch(/\/songs\/all$/);
    expect(meta.title).toBe('All songs | Rejoice');
  });

  it('makes a later page canonical to itself, not to page one', () => {
    // This is the whole point: page 2 used to declare itself a copy of page 1,
    // so anything appearing only on page 2 had no claim to being indexed.
    const meta = listingMetadata({ ...base, page: 2 });
    expect(String(meta.alternates?.canonical)).toMatch(/\/songs\/all\?page=2$/);
    expect(meta.title).toBe('All songs, page 2 | Rejoice');
  });

  it('keeps search results out of the index but still follows their links', () => {
    const meta = listingMetadata({ ...base, query: 'worship' });
    expect(meta.robots).toMatchObject({ index: false, follow: true });
  });

  it('indexes an ordinary listing page', () => {
    expect(listingMetadata({ ...base }).robots).toMatchObject({ index: true, follow: true });
  });

  it('carries no em dash in a paginated title', () => {
    // The public copy carries none, and a <title> is public copy.
    expect(listingMetadata({ ...base, page: 3 }).title).not.toContain('—');
  });
});
