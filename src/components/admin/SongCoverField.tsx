'use client';

import { useEffect, useRef, useState } from 'react';

import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { COVER_SIZE } from '@/lib/images/downscale';
import { drawPlaceholderCover } from '@/lib/images/placeholderCover';

type Drawn = { blob: Blob; width: number; height: number; url: string };

/**
 * The song's cover field, with a temporary design when there is no artwork.
 *
 * `SongForm` is a server component, so this is the client piece that watches
 * the title and artist and keeps a Rejoice-branded placeholder drawn from them
 * (`drawPlaceholderCover`). `ImageUploadField` shows it, labels it, and submits
 * it through the same fields as a real picture — see its `fallback` prop.
 *
 * ## When it draws
 *
 * - **Adding a song:** always. The song can be saved the moment it has a title.
 * - **Editing:** only while the stored cover is itself temporary, so a rename
 *   redraws it. A song with real artwork gets no fallback at all and behaves
 *   exactly as before.
 *
 * ## Why it listens to the form rather than being handed the values
 *
 * The title and artist are plain uncontrolled inputs rendered by the server
 * component around this one. Making them controlled would move the whole form
 * to the client to feed one preview. Listening to `input` on the enclosing form
 * reads the same values with none of that.
 */
export function SongCoverField({
  currentUrl,
  temporary,
  initialTitle,
  initialArtist,
}: {
  currentUrl?: string;
  /** Whether to draw a temporary design at all. */
  temporary: boolean;
  initialTitle: string;
  initialArtist: string;
}) {
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!temporary) return;
    const form = anchor.current?.closest('form');
    if (!form) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastUrl: string | null = null;

    const read = (field: string, fallback: string) => {
      const input = form.elements.namedItem(field);
      return input instanceof HTMLInputElement ? input.value : fallback;
    };

    const redraw = async () => {
      const title = read('title', initialTitle).trim();
      const artist = read('artist', initialArtist).trim();

      // No title, no design: the box shows its ordinary empty state, and the
      // server's own rule reports the missing title.
      if (!title) {
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = null;
        if (!cancelled) setDrawn(null);
        return;
      }

      try {
        const image = await drawPlaceholderCover({ title, artist });
        if (cancelled) return;
        const url = URL.createObjectURL(image.blob);
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = url;
        setDrawn({ ...image, url });
      } catch {
        // A browser that cannot draw simply gets no design, and the form
        // falls back to asking for an image, as it always did.
        if (!cancelled) setDrawn(null);
      }
    };

    // Typing a title fires on every key; drawing is cheap but not free, and a
    // preview that flickers per keystroke reads as broken.
    const schedule = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.name !== 'title' && target.name !== 'artist') return;
      clearTimeout(timer);
      timer = setTimeout(() => void redraw(), 300);
    };

    // The form keeps typed values across a refused save now, so the design is
    // drawn from what is in the fields — including on first render, for an
    // edit page whose title is already filled in.
    timer = setTimeout(() => void redraw(), 0);
    form.addEventListener('input', schedule);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      form.removeEventListener('input', schedule);
      if (lastUrl) URL.revokeObjectURL(lastUrl);
    };
  }, [temporary, initialTitle, initialArtist]);

  return (
    /*
     * Held to the frame's own 240px. `SongForm` lays this out in an `auto`
     * column, which sizes to its longest unbroken line — and the hint below is
     * one long line, so without a width it stretched the column and pushed
     * the Title field halfway across the screen. Held here, it wraps instead.
     */
    <div ref={anchor} className="w-full sm:w-60">
      <ImageUploadField
        name="cover"
        label="Cover art"
        square
        currentUrl={currentUrl}
        hint="Square artwork, any size. No artwork yet? A temporary cover is made from the title."
        sizes={{ cover: COVER_SIZE }}
        fallback={temporary ? drawn : null}
      />
    </div>
  );
}
