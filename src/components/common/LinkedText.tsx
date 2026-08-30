import { Fragment } from 'react';

/**
 * Turn the URLs inside a block of text into links.
 *
 * The text is a video description — either the administrator's override or, when
 * there is none, YouTube's own. Both arrive as plain text full of subscribe and
 * social links that a visitor otherwise has to select and copy by hand.
 *
 * This deliberately builds REACT ELEMENTS and never uses
 * `dangerouslySetInnerHTML`. Neither source should be able to put markup on the
 * page: rendering elements means a description cannot inject a tag or a script
 * whatever is typed into the editor or returned by the API. Safe by
 * construction, rather than by trying to sanitise afterwards.
 */

/**
 * Matches an http(s) URL, stopping at whitespace OR at the start of the next
 * scheme.
 *
 * That lookahead is the whole point. Real descriptions in this catalogue join
 * two links with a colon and no space:
 *
 *     https://www.instagram.com/rejoicegospelmusic:https://www.instagram.com/…
 *
 * A plain `https?://\S+` swallows both into one broken address. Stopping before
 * the next `http` splits them into two working links.
 *
 * Only `http` and `https` can ever match, so a `javascript:` or `data:` URL can
 * never become a link — the scheme restriction is in the pattern itself.
 */
const URL_PATTERN = /https?:\/\/[^\s]*?(?=https?:\/\/|\s|$)/g;

/**
 * Punctuation that ends a sentence rather than a URL.
 *
 * The colon matters most: splitting a joined pair leaves one behind on the first
 * link, where it was the separator, not part of the address. A trailing slash is
 * NOT trimmed — 59 of the URLs in this catalogue legitimately end with one.
 */
const TRAILING_PUNCTUATION = /[:.,;!?)\]]+$/;

export type TextSegment = { type: 'text' | 'link'; value: string };

/**
 * Split text into plain and link segments.
 *
 * Exported separately from the component so the parsing can be tested on its
 * own. Re-joining every segment's `value` always reproduces the input exactly —
 * the parser never drops or duplicates a character.
 */
export function splitLinks(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;

    // Trailing punctuation belongs to the sentence, so it goes back into the
    // plain-text run rather than into the href.
    const url = raw.replace(TRAILING_PUNCTUATION, '');

    // A match that is nothing but a scheme is not a usable link; leave it as
    // text rather than emitting an anchor that goes nowhere.
    if (url.length <= 'https://'.length) continue;

    if (start > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, start) });
    }

    segments.push({ type: 'link', value: url });
    lastIndex = start + url.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

export function LinkedText({ text }: { text: string }) {
  const segments = splitLinks(text);

  return (
    <>
      {segments.map((segment, i) =>
        segment.type === 'link' ? (
          <a
            key={i}
            href={segment.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-site-accent underline underline-offset-2 transition-colors hover:text-site-fg"
          >
            {segment.value}
          </a>
        ) : (
          // A Fragment, not a span: an extra element here would break the
          // `white-space: pre-line` that preserves the description's line
          // structure.
          <Fragment key={i}>{segment.value}</Fragment>
        ),
      )}
    </>
  );
}
