'use client';

import { useEffect, useState } from 'react';

import { svgToDataUri } from '@/lib/utils/svg';

/**
 * The round icon beside a social link, showing the CHOSEN file rather than only
 * the saved one.
 *
 * Before this, the circle rendered `link.svg` from the database and nothing
 * else, so picking a file changed nothing on screen until after a successful
 * save. Combined with a save that used to discard nameless rows in silence,
 * there was no way to tell a working upload from one that had been thrown away.
 *
 * It watches the file input by id instead of owning it. The input has to stay
 * where it is — a full-width row further down the grid, three cells away from
 * this circle — and a component cannot render into two grid cells at once. The
 * id is already generated for the field's own `htmlFor`, so nothing new is
 * invented here.
 *
 * The picked file is shown through `<img src="data:…">`, never inlined into the
 * DOM. That is the same rule `svgToDataUri` exists for (see
 * `src/lib/utils/svg.ts`): an `<svg>` element pasted into the page can carry
 * script, an SVG loaded as an image cannot. This preview runs BEFORE the file
 * reaches `sanitizeSvg` on the server, so it is exactly the case that rule is
 * written for.
 */
export function SocialIconPreview({
  inputId,
  savedSvg,
  label,
}: {
  inputId: string;
  /** The icon already stored for this link, if any. */
  savedSvg: string;
  /** Falls back to the first two letters, as the saved-only version did. */
  label: string;
}) {
  const [pickedUri, setPickedUri] = useState<string | null>(null);

  useEffect(() => {
    const input = document.getElementById(inputId);
    if (!(input instanceof HTMLInputElement)) return;

    let cancelled = false;

    const onChange = () => {
      const file = input.files?.[0];
      if (!file) {
        // Cleared the picker: fall back to whatever is saved.
        setPickedUri(null);
        return;
      }

      void file.text().then((text) => {
        if (cancelled) return;
        /*
         * No validation here beyond reading it. The server sanitises, and this
         * is a picture of what was chosen — including when the wrong file was
         * chosen, which is the mistake worth SEEING.
         */
        setPickedUri(svgToDataUri(text));
      });
    };

    input.addEventListener('change', onChange);
    return () => {
      cancelled = true;
      input.removeEventListener('change', onChange);
    };
  }, [inputId]);

  const shown = pickedUri ?? (savedSvg ? svgToDataUri(savedSvg) : null);

  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-full border bg-muted">
      {shown ? (
        /* A data URI already held in memory — `next/image` would only put a
           loader in front of a string, and cannot optimise it anyway. */
        // eslint-disable-next-line @next/next/no-img-element
        <img src={shown} alt="" className="size-5" />
      ) : (
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          {label.slice(0, 2) || '+'}
        </span>
      )}
    </span>
  );
}
