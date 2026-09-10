import { describe, expect, it } from 'vitest';

import { searchTitle } from '@/lib/utils/videoDisplay';
import { aboutJsonLd, collectionJsonLd, listingMetadata } from '@/lib/seo';

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

/**
 * The listing markup, whose whole risk is disagreeing with the page.
 *
 * Six pages carried no structured data at all until this went in. The failure
 * mode for markup like this is not a crash — it is quietly claiming the page
 * holds four hundred songs when thirty are drawn, which is the sort of thing
 * that gets a site's structured data discounted wholesale.
 */
describe('collectionJsonLd', () => {
  const items = Array.from({ length: 80 }, (_, i) => ({ name: `Song ${i}`, path: `/songs/s${i}` }));
  const base = { name: 'Songs', description: 'Every release.', path: '/songs' };

  it('states the size of the collection, not the size of the page', () => {
    const ld = collectionJsonLd({ ...base, items: items.slice(0, 30), total: 412 });
    expect(ld.mainEntity?.itemListElement).toHaveLength(30);
    expect(ld.mainEntity?.numberOfItems).toBe(412);
  });

  it('falls back to what is listed when no total is known', () => {
    // A number nothing measured is worse than a smaller true one.
    const ld = collectionJsonLd({ ...base, items: items.slice(0, 12) });
    expect(ld.mainEntity?.numberOfItems).toBe(12);
  });

  it('caps the list at the largest page size', () => {
    expect(collectionJsonLd({ ...base, items }).mainEntity?.itemListElement).toHaveLength(60);
  });

  it('omits the list entirely rather than emitting an empty one', () => {
    expect(collectionJsonLd({ ...base }).mainEntity).toBeUndefined();
  });

  it('gives every item an absolute URL', () => {
    const ld = collectionJsonLd({ ...base, items: items.slice(0, 3) });
    for (const entry of ld.mainEntity!.itemListElement) {
      expect(entry.url).toMatch(/^https?:\/\//);
    }
  });

  it('names what the collection is of, and links it to its source', () => {
    // A channel page and the YouTube channel it mirrors are otherwise just two
    // places with a similar name.
    const ld = collectionJsonLd({
      ...base,
      items: items.slice(0, 2),
      about: {
        name: 'Rejoice Gospel Communications',
        url: 'https://www.youtube.com/@rejoicegospelcommunications',
        description: 'Tamil gospel music.',
        image: 'https://example.test/avatar.jpg',
      },
    });
    expect(ld.about?.name).toBe('Rejoice Gospel Communications');
    expect(ld.about?.sameAs).toEqual(['https://www.youtube.com/@rejoicegospelcommunications']);
  });

  it('drops the fields a channel has no value for rather than sending them empty', () => {
    // `image: ''` asserts a picture exists and is at no address.
    const ld = collectionJsonLd({
      ...base,
      about: { name: 'Rejoice', url: null, description: null, image: null },
    });
    expect(ld.about).toEqual({ '@type': 'Organization', name: 'Rejoice' });
  });

  it('says nothing about a subject it was not given', () => {
    expect(collectionJsonLd({ ...base, items }).about).toBeUndefined();
  });

  it('numbers positions from one', () => {
    const ld = collectionJsonLd({ ...base, items: items.slice(0, 3) });
    expect(ld.mainEntity!.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
  });
});

describe('aboutJsonLd', () => {
  it('points at the organisation rather than declaring a second one', () => {
    // Two Organization entities on two URLs is how one company becomes two.
    const ld = aboutJsonLd();
    expect(ld['@type']).toBe('AboutPage');
    expect(ld.mainEntity['@type']).toBe('Organization');
    expect(ld.url).toMatch(/\/about-us$/);
  });
});
