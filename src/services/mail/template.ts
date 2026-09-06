import { appConfig } from '@/config/app.config';

/**
 * The look of every email Rejoice sends.
 *
 * One template rather than styling each message, so the next kind of mail
 * inherits the brand instead of arriving looking like a different company.
 *
 * ## The escaping rule, which is not optional
 *
 * `mailer.ts` sent plain text only, and its comment said why: the body is
 * composed almost entirely of attacker-supplied strings, and plain text removes
 * the HTML-escaping question rather than depending on getting it right. Adding
 * HTML puts that question back, so it is answered here in one place:
 *
 *   - this module takes DATA, never markup. There is no parameter a caller can
 *     put a tag in and have it rendered;
 *   - every interpolated value goes through `escapeHtml`, including ones that
 *     look safe today — a subject line is attacker-supplied on the contact
 *     form;
 *   - the plain-text part is still built and still sent. It is what a text-only
 *     client shows, and a message with no text part scores worse with spam
 *     filters.
 *
 * ## Written like it is 1999, on purpose
 *
 * Tables, inline styles, no flexbox and no `<style>` block. Mail clients are
 * roughly fifteen years behind browsers — Outlook renders with Word's engine —
 * and a layout built the modern way collapses there. The one concession to the
 * present is `@media` for narrow screens, which clients that cannot read it
 * simply ignore.
 */

/** The five characters that can change the meaning of HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Ember, matching the public site's accent. */
const ACCENT = '#FF6D29';
const INK = '#0B0B0C';
const PAPER = '#FFFFFF';
const MUTED = '#6B6B70';
const LINE = '#E6E6E8';

export type MailRow = { label: string; value: string };

export type MailContent = {
  /** Shown large at the top of the card. */
  heading: string;
  /** One line under it, for context. Optional. */
  intro?: string;
  /** Label/value pairs, rendered as a table. */
  rows?: MailRow[];
  /** Free text — a message body. Line breaks are preserved. */
  message?: string;
  /** The one action, as a button. */
  action?: { label: string; href: string };
};

/**
 * The wordmark, absolutely addressed.
 *
 * MOST MAIL CLIENTS BLOCK IMAGES BY DEFAULT, so this is never the only thing
 * carrying the brand: it sits on the dark header block below, and its `alt` is
 * the company name. A blocked image therefore leaves a branded bar reading
 * "Rejoice" rather than a broken-image icon on white.
 */
const logoUrl = `${appConfig.url}/brand/logo-wordmark-light.png`;

export function renderMail(content: MailContent): { html: string; text: string } {
  return { html: renderHtml(content), text: renderText(content) };
}

function renderHtml(content: MailContent): string {
  const rows = (content.rows ?? [])
    .map(
      (row) => `
              <tr>
                <td style="padding:0 0 10px 0;font:400 13px/1.5 Arial,Helvetica,sans-serif;color:${MUTED};width:104px;vertical-align:top;">${escapeHtml(row.label)}</td>
                <td style="padding:0 0 10px 0;font:400 14px/1.5 Arial,Helvetica,sans-serif;color:${INK};vertical-align:top;">${escapeHtml(row.value)}</td>
              </tr>`,
    )
    .join('');

  const message = content.message
    ? `
            <div style="margin:22px 0 0 0;padding:18px 20px;background:#F6F6F7;border-left:3px solid ${ACCENT};border-radius:4px;font:400 15px/1.65 Arial,Helvetica,sans-serif;color:${INK};white-space:pre-wrap;">${escapeHtml(content.message)}</div>`
    : '';

  const action = content.action
    ? `
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0 0;">
              <tr>
                <td style="border-radius:999px;background:${ACCENT};">
                  <a href="${escapeHtml(content.action.href)}" style="display:inline-block;padding:12px 26px;font:700 14px/1 Arial,Helvetica,sans-serif;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(content.action.label)}</a>
                </td>
              </tr>
            </table>`
    : '';

  const intro = content.intro
    ? `
            <p style="margin:8px 0 0 0;font:400 15px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">${escapeHtml(content.intro)}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#F2F2F3;">
  <!-- Preheader: the grey line of text a client shows beside the subject. Kept
       off-screen so it never appears twice. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(content.intro ?? content.heading)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F2F2F3;">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:560px;max-width:100%;background:${PAPER};border-radius:14px;overflow:hidden;border:1px solid ${LINE};">

          <!-- Header. The dark block is what carries the brand when the logo is
               blocked, which is the default in most clients. -->
          <tr>
            <td align="center" style="background:${INK};padding:26px 24px;">
              <img src="${logoUrl}" width="132" alt="${escapeHtml(appConfig.name)}" style="display:block;border:0;width:132px;height:auto;">
            </td>
          </tr>

          <!-- A single ember rule under the header. -->
          <tr><td style="height:3px;background:${ACCENT};font-size:0;line-height:0;">&nbsp;</td></tr>

          <tr>
            <td style="padding:30px 32px 34px 32px;">
              <h1 style="margin:0;font:700 21px/1.3 Arial,Helvetica,sans-serif;color:${INK};">${escapeHtml(content.heading)}</h1>${intro}

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 0 0;">${rows}
              </table>${message}${action}
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px 24px 32px;border-top:1px solid ${LINE};font:400 12px/1.6 Arial,Helvetica,sans-serif;color:${MUTED};">
              Sent automatically by the ${escapeHtml(appConfig.name)} website.<br>
              <a href="${escapeHtml(appConfig.url)}" style="color:${MUTED};">${escapeHtml(appConfig.url.replace(/^https?:\/\//, ''))}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * The same content as text.
 *
 * Not a fallback nobody sees: it is what a text-only client renders, what a
 * screen reader may be given, and its absence is a point against the message
 * with spam filters.
 */
function renderText(content: MailContent): string {
  const lines: string[] = [content.heading];

  if (content.intro) lines.push('', content.intro);

  if (content.rows?.length) {
    lines.push('');
    // Padded so the values line up in a monospaced view, as the original
    // enquiry mail did.
    const width = Math.max(...content.rows.map((row) => row.label.length)) + 1;
    for (const row of content.rows) {
      lines.push(`${`${row.label}:`.padEnd(width + 1)} ${row.value}`);
    }
  }

  if (content.message) lines.push('', content.message);

  if (content.action) lines.push('', '—', `${content.action.label}: ${content.action.href}`);

  return lines.join('\n');
}
