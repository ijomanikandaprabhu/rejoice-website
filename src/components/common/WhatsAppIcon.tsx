/**
 * The WhatsApp mark: a handset inside a speech bubble.
 *
 * Drawn here rather than imported, for the same reason as `YouTubeIcon` beside
 * it — `lucide-react` removed every brand icon for trademark reasons, and there
 * is no WhatsApp asset in `public/`. The one the administrator uploads through
 * Settings belongs to the footer's social row and is stored in the database, so
 * it cannot be reached from a public form.
 *
 * `fill="currentColor"`, so the mark takes the colour of the button around it.
 * This one sits on `btn-secondary` — the translucent button with site-foreground
 * text — and painted WhatsApp green it would read as a sticker pasted onto the
 * design rather than part of it.
 *
 * The bubble's tail points bottom-left, which is the mark as WhatsApp draws it;
 * mirroring it is the usual way this glyph gets copied wrong.
 *
 * Decorative by default: the button already says "WhatsApp", and announcing the
 * logo as well would only say it twice.
 */
export function WhatsAppIcon({ className = 'size-[1.15em]' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.16 1.71 2.61 4.15 3.66.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
    </svg>
  );
}

export default WhatsAppIcon;
