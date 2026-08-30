/**
 * Accepting an uploaded SVG safely.
 *
 * SVG is not a passive image format. It can carry `<script>`, `on*` event
 * handlers, `<foreignObject>` with arbitrary HTML, and external references
 * through `<use href>` — so an uploaded icon rendered inline on the public site
 * is stored cross-site scripting: script running for every visitor.
 *
 * There are TWO defences, and it matters which one is load-bearing:
 *
 *   1. Icons are rendered through `<img src="data:image/svg+xml,…">`. A browser
 *      never executes script inside an `<img>`, whatever the file contains.
 *      This is the guarantee, and it holds even if the sanitiser below misses
 *      something.
 *   2. This sanitiser strips the dangerous constructs on the way in, so the
 *      stored value is clean and stays clean if it is ever rendered another way.
 *
 * Writing a complete SVG sanitiser by hand is a losing game — that is precisely
 * why the `<img>` boundary exists rather than trusting this file alone.
 */

/** Icons are small. A real brand mark is a few KB; anything larger is not one. */
export const MAX_SVG_BYTES = 32 * 1024;

export type SvgResult = { ok: true; svg: string } | { ok: false; error: string };

const DANGEROUS_ELEMENTS = ['script', 'foreignObject', 'iframe', 'embed', 'object', 'animate'];

/**
 * Clean an uploaded SVG, or explain why it cannot be used.
 *
 * Rejects rather than silently repairs when the file is not an SVG at all: an
 * administrator who picked the wrong file should be told, not left wondering why
 * their icon is blank.
 */
export function sanitizeSvg(input: string): SvgResult {
  const source = input.trim();

  if (!source) return { ok: false, error: 'The file is empty.' };

  if (Buffer.byteLength(source, 'utf8') > MAX_SVG_BYTES) {
    return { ok: false, error: `Icons must be under ${MAX_SVG_BYTES / 1024}KB.` };
  }

  // Must actually be an SVG. A renamed PNG or an HTML page fails here rather
  // than being stored as a broken icon.
  if (!/^<(\?xml|!doctype|svg)/i.test(source) || !/<svg[\s>]/i.test(source)) {
    return { ok: false, error: 'That file is not an SVG.' };
  }

  let svg = source;

  // Whole elements that can execute or embed arbitrary content.
  for (const tag of DANGEROUS_ELEMENTS) {
    svg = svg.replace(new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi'), '');
  }

  // Inline handlers: onload, onclick, onmouseover and friends.
  svg = svg.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  /*
   * Any reference that is not a plain fragment or a data URI.
   *
   * `href="#gradient"` is how an SVG points at its own defs and must survive.
   * `href="javascript:…"` and `href="https://elsewhere/x.svg"` must not — the
   * first executes, the second phones home and leaks visitors' IP addresses.
   */
  svg = svg.replace(
    /\s(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi,
    (match, double: string | undefined, single: string | undefined) => {
      const value = (double ?? single ?? '').trim();
      return value.startsWith('#') || value.startsWith('data:image/') ? match : '';
    },
  );

  // `style="… url(http://…)"` can fetch remote content the same way.
  svg = svg.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, 'none');

  return { ok: true, svg: svg.trim() };
}

/**
 * The value an `<img src>` takes.
 *
 * URI-encoded rather than base64: it stays readable in the database and in dev
 * tools, and avoids inflating a small file by a third.
 */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
