import { describe, expect, it, vi } from 'vitest';

/**
 * The rule: a link leaving the website opens in a new tab, on the public site
 * and in the admin alike.
 *
 * Tested rather than trusted because the interesting cases are the ones that
 * are NOT external — `mailto:`, `tel:`, a relative path, and our own domain
 * written out in full. Getting any of those wrong is worse than the bug this
 * fixes: a `mailto:` in a new tab leaves an empty window the reader has to
 * close, every single time they click an email address.
 */

vi.mock('@/config/app.config', () => ({
  appConfig: { name: 'Rejoice', url: 'https://www.rejoicegospelcommunications.com' },
}));

const { isExternalHref, externalLinkProps } = await import('@/lib/utils');

describe('isExternalHref', () => {
  it('is true for another domain', () => {
    expect(isExternalHref('https://www.youtube.com/watch?v=abc')).toBe(true);
    expect(isExternalHref('https://open.spotify.com/artist/1')).toBe(true);
    expect(isExternalHref('http://instagram.com/rejoice')).toBe(true);
    // Protocol-relative is still another host.
    expect(isExternalHref('//example.com/x')).toBe(true);
  });

  it('is false for our own domain, however it is written', () => {
    expect(isExternalHref('https://www.rejoicegospelcommunications.com/songs')).toBe(false);
    expect(isExternalHref('https://www.rejoicegospelcommunications.com')).toBe(false);
  });

  it('is false for anything relative', () => {
    expect(isExternalHref('/songs')).toBe(false);
    expect(isExternalHref('/admin/enquiries')).toBe(false);
    expect(isExternalHref('#top')).toBe(false);
    expect(isExternalHref('?page=2')).toBe(false);
  });

  it('is FALSE for mailto and tel, which are handed to another app', () => {
    // A new tab for these opens an empty window the reader must then close.
    expect(isExternalHref('mailto:rejoice@example.com')).toBe(false);
    expect(isExternalHref('tel:+919176600765')).toBe(false);
    expect(isExternalHref('MAILTO:rejoice@example.com')).toBe(false);
  });

  it('is false for nothing at all', () => {
    expect(isExternalHref(undefined)).toBe(false);
    expect(isExternalHref(null)).toBe(false);
    expect(isExternalHref('')).toBe(false);
  });

  it('treats an unparseable address as external', () => {
    // Erring towards a needless new tab rather than towards navigating away
    // from work in progress.
    expect(isExternalHref('https://')).toBe(true);
  });
});

describe('externalLinkProps', () => {
  it('carries rel alongside target, never one without the other', () => {
    const props = externalLinkProps('https://www.youtube.com/@rejoice');

    expect(props).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
  });

  it('returns nothing for our own pages, so it is safe to spread anywhere', () => {
    expect(externalLinkProps('/songs')).toEqual({});
    expect(externalLinkProps('mailto:a@b.com')).toEqual({});
    expect(externalLinkProps(undefined)).toEqual({});
  });
});
