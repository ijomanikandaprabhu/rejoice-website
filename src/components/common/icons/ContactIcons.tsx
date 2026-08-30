/**
 * Solid contact glyphs: pin, phone, envelope.
 *
 * Drawn here rather than imported because `lucide-react` — the site's icon set —
 * is stroke-based, and these do not survive being filled. `Mail` is a rectangle
 * plus a polyline flap, so filling it swallows the flap; `MapPin`'s centre
 * circle fills in and the pin becomes a featureless blob. Only `Phone` would
 * have worked.
 *
 * Same shape as `YouTubeIcon`: a 24-unit box, `fill="currentColor"` so the glyph
 * takes its colour from the text around it, and decorative by default — every
 * card using one already carries a visible label.
 *
 * The counters (the pin's hole, the envelope's flap) are drawn as second
 * subpaths wound the same way and knocked out with `fillRule="evenodd"`, which
 * is what keeps them readable at 16px.
 */

type IconProps = { className?: string };

const BASE = 'size-4';

export function PinSolid({ className = BASE }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Teardrop, then the centre hole as a knockout. */}
      <path d="M12 2a7 7 0 0 0-7 7c0 4.6 5.4 11.1 6.5 12.4a.7.7 0 0 0 1 0C13.6 20.1 19 13.6 19 9a7 7 0 0 0-7-7Zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2Z" />
    </svg>
  );
}

export function PhoneSolid({ className = BASE }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* One closed handset silhouette — no counters needed. */}
      <path d="M6.6 2.5a1.8 1.8 0 0 0-2.3.5L3 4.8a3.4 3.4 0 0 0-.5 2.9c.7 2.8 2.3 5.6 4.6 7.9 2.3 2.3 5.1 3.9 7.9 4.6a3.4 3.4 0 0 0 2.9-.5l1.8-1.3a1.8 1.8 0 0 0 .5-2.3l-1.6-2.8a1.8 1.8 0 0 0-2.2-.8l-2.3.9a.9.9 0 0 1-1-.2l-2.6-2.6a.9.9 0 0 1-.2-1l.9-2.3a1.8 1.8 0 0 0-.8-2.2L6.6 2.5Z" />
    </svg>
  );
}

export function MailSolid({ className = BASE }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* Envelope body, then the flap knocked out of it. */}
      <path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h16a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 20 20H4a1.5 1.5 0 0 1-1.5-1.5v-13Zm2.2.9 6.8 5.1a.8.8 0 0 0 1 0l6.8-5.1H4.7Z" />
    </svg>
  );
}
