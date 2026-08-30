import { describe, expect, it } from 'vitest';

import { splitLinks } from '@/components/common/LinkedText';

const links = (text: string) =>
  splitLinks(text)
    .filter((s) => s.type === 'link')
    .map((s) => s.value);

/** The invariant that matters most: the splitter never loses or duplicates text. */
const rejoin = (text: string) =>
  splitLinks(text)
    .map((s) => s.value)
    .join('');

describe('splitLinks', () => {
  it('finds a plain URL', () => {
    expect(links('Subscribe here http://bit.ly/RejoiceGospelGCSubscribe today')).toEqual([
      'http://bit.ly/RejoiceGospelGCSubscribe',
    ]);
  });

  it('keeps a legitimate trailing slash', () => {
    // 59 URLs in this catalogue end with one; trimming it would change the address.
    expect(links('https://www.facebook.com/rejoicegospelcommunications/')).toEqual([
      'https://www.facebook.com/rejoicegospelcommunications/',
    ]);
  });

  /*
   * The case a naive `https?://\S+` gets wrong. Four real descriptions join two
   * links with a colon and no space; matched greedily they become one address
   * that goes nowhere.
   */
  it('splits two URLs joined by a colon', () => {
    const text = 'https://www.instagram.com/rejoicegospelmusic:https://www.instagram.com/rejoice';
    expect(links(text)).toEqual([
      'https://www.instagram.com/rejoicegospelmusic',
      'https://www.instagram.com/rejoice',
    ]);
  });

  it('leaves sentence punctuation out of the link', () => {
    expect(links('Watch at https://youtu.be/zt64P35-F-4.')).toEqual(['https://youtu.be/zt64P35-F-4']);
    expect(links('Watch at https://youtu.be/zt64P35-F-4, then subscribe')).toEqual([
      'https://youtu.be/zt64P35-F-4',
    ]);
  });

  it('finds every link across multiple lines', () => {
    const text = [
      'Follow us on Facebook :https://www.facebook.com/rejoicegospelcommunications/',
      'Follow us on Twitter : https://twitter.com/rejoicechannel',
    ].join('\n');
    expect(links(text)).toHaveLength(2);
  });

  it('returns text untouched when there are no URLs', () => {
    const text = 'Song : Sthothiram Deva\nAlbum : Fresh Beats';
    expect(links(text)).toEqual([]);
    expect(rejoin(text)).toBe(text);
  });

  it('handles an empty string', () => {
    expect(splitLinks('')).toEqual([]);
  });

  /*
   * Only http(s) can match, so a description cannot produce a link that runs
   * script when clicked. The scheme restriction lives in the pattern itself
   * rather than in a filter that could be forgotten.
   */
  it('never links a javascript: or data: URL', () => {
    expect(links('javascript:alert(1) and data:text/html;base64,PHN2Zz4=')).toEqual([]);
  });

  it('reproduces the input exactly when segments are re-joined', () => {
    const samples = [
      'Plain text with no links at all.',
      'One http://example.com/a link.',
      'Joined https://a.example/x:https://b.example/y pair.',
      'Trailing https://example.com/page. And more text.',
      '---------------\nStay happily connected!!!\n↳ https://twitter.com/rejoicechannel',
    ];
    for (const sample of samples) {
      expect(rejoin(sample)).toBe(sample);
    }
  });
});
