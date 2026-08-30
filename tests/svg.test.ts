import { describe, expect, it } from 'vitest';

import { MAX_SVG_BYTES, sanitizeSvg, svgToDataUri } from '@/lib/utils/svg';

const clean = (input: string) => {
  const result = sanitizeSvg(input);
  if (!result.ok) throw new Error(`expected success, got: ${result.error}`);
  return result.svg;
};

/**
 * An uploaded SVG is active content, so these tests are the security boundary's
 * first line. The second — rendering through `<img>`, where script never runs —
 * is verified in the browser.
 */
describe('sanitizeSvg', () => {
  it('keeps a normal icon untouched in substance', () => {
    const svg = '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z" fill="#1877F2"/></svg>';
    const out = clean(svg);
    expect(out).toContain('<path');
    expect(out).toContain('#1877F2');
    expect(out).toContain('viewBox');
  });

  it('strips a script element and its contents', () => {
    const out = clean('<svg><script>alert(1)</script><circle r="4"/></svg>');
    expect(out).not.toMatch(/script/i);
    expect(out).not.toContain('alert');
    expect(out).toContain('<circle');
  });

  it('strips a self-closing script tag', () => {
    const out = clean('<svg><script src="data:text/javascript,alert(1)"/><circle r="4"/></svg>');
    expect(out).not.toMatch(/script/i);
  });

  it('strips inline event handlers', () => {
    const out = clean(`<svg onload="alert(1)"><circle r="4" onclick='steal()'/></svg>`);
    expect(out).not.toMatch(/onload/i);
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toContain('alert');
    expect(out).toContain('<circle');
  });

  it('strips foreignObject, which can carry arbitrary HTML', () => {
    const out = clean('<svg><foreignObject><body><img src=x onerror=alert(1)></body></foreignObject></svg>');
    expect(out).not.toMatch(/foreignObject/i);
    expect(out).not.toContain('onerror');
  });

  it('removes external and javascript references but keeps internal ones', () => {
    const out = clean(
      '<svg><use href="https://evil.example/x.svg#a"/><use xlink:href="javascript:alert(1)"/><use href="#logo"/></svg>',
    );
    expect(out).not.toContain('evil.example');
    expect(out).not.toContain('javascript:');
    // An SVG referring to its own defs must still work.
    expect(out).toContain('href="#logo"');
  });

  it('neutralises remote url() in a style attribute', () => {
    const out = clean(`<svg><rect style="fill:url('http://evil.example/a.png')"/></svg>`);
    expect(out).not.toContain('evil.example');
  });

  it('rejects a file that is not an SVG', () => {
    expect(sanitizeSvg('\x89PNG\r\n\x1a\n')).toMatchObject({ ok: false });
    expect(sanitizeSvg('<html><body>hello</body></html>')).toMatchObject({ ok: false });
  });

  it('rejects an empty file', () => {
    expect(sanitizeSvg('   ')).toMatchObject({ ok: false });
  });

  it('rejects a file over the size cap', () => {
    const huge = `<svg>${'<path d="M0 0"/>'.repeat(4000)}</svg>`;
    expect(Buffer.byteLength(huge)).toBeGreaterThan(MAX_SVG_BYTES);
    expect(sanitizeSvg(huge)).toMatchObject({ ok: false });
  });

  it('accepts an SVG that starts with an xml declaration', () => {
    const out = clean('<?xml version="1.0"?><svg viewBox="0 0 24 24"><path d="M0 0"/></svg>');
    expect(out).toContain('<path');
  });
});

describe('svgToDataUri', () => {
  it('produces a src an img element can use', () => {
    const uri = svgToDataUri('<svg><path d="M0 0"/></svg>');
    expect(uri.startsWith('data:image/svg+xml,')).toBe(true);
    // Characters that would break out of the attribute must be encoded.
    expect(uri).not.toContain('<');
    expect(uri).not.toContain('"');
  });
});
