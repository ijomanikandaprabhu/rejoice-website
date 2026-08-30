/**
 * The YouTube play mark.
 *
 * Drawn here rather than imported because there is nowhere to import it from:
 * `lucide-react` removed every brand icon for trademark reasons, and the only
 * YouTube asset in `public/` is the YouTube *Music* logo, which is a different
 * mark entirely.
 *
 * `fill="currentColor"` is the important part. These buttons come in two
 * flavours — white text on the orange `btn-primary`, and the site foreground on
 * the translucent `btn-secondary` — so the mark has to take the button's own
 * colour. Painted YouTube red it would all but vanish against the orange.
 *
 * Decorative by default: every button using it already says "on YouTube" in its
 * label, so announcing the logo too would only repeat it.
 */
export function YouTubeIcon({ className = 'size-[1.15em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.08 0 12 0 12s0 3.92.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.92 24 12 24 12s0-3.92-.5-5.81ZM9.55 15.57V8.43L15.82 12l-6.27 3.57Z" />
    </svg>
  );
}

export default YouTubeIcon;
