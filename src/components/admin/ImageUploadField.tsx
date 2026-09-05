'use client';

import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import { FieldError } from '@/components/admin/ActionForm';
import { Button } from '@/components/ui/button';
import { downscale } from '@/lib/images/downscale';

/**
 * Pick an image, shrink it here, and submit the small version.
 *
 * The resize is not a nicety. A 3000x3000 cover is several megabytes and
 * neither Vercel (about 4.5MB per request) nor Next (1MB per server action)
 * will carry it. What leaves this component is a WebP of roughly 70KB.
 *
 * The chosen file is deliberately NOT what gets submitted: the file input
 * carries no name, and the downscaled result is written into hidden inputs
 * alongside its dimensions. Submitting the original would defeat the whole
 * point and fail on a size limit the administrator cannot see.
 *
 * THE PICTURE ITSELF IS THE CONTROL. There is no "Choose file" button — the
 * frame is a button, so the thing you click is the thing you are replacing.
 *
 * `sizes` may ask for more than one copy, and each gets its own trio of hidden
 * fields. Today every caller asks for one.
 */
export function ImageUploadField({
  name,
  sizes,
  label = 'Image',
  hint,
  currentUrl,
  square = false,
  plate = false,
}: {
  /** Base field name. Each size posts `<size>`, `<size>.width`, `<size>.height`. */
  name: string;
  /** Field name → longest side in pixels. */
  sizes: Record<string, number>;
  label?: string;
  hint?: string;
  /** An existing image, shown until a new one is picked. */
  currentUrl?: string;
  square?: boolean;
  /**
   * Preview the image on white rather than on the admin's dark surface.
   *
   * For brand logos, which are often near-black wordmarks — without this the
   * preview is an empty box at exactly the moment someone is checking they
   * picked the right file. Cover art does not want it: a photograph needs no
   * plate, and a white box behind one would just be a border.
   *
   * Explicit rather than inferred from `square`. Logos happen to be wide and
   * covers square, but that is a coincidence, not the reason.
   */
  plate?: boolean;
}) {
  /** The newly picked image, if any. Null means "whatever was already there". */
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const picker = useRef<HTMLInputElement>(null);

  /*
   * The hidden file inputs are driven through a DataTransfer, which is the only
   * way to put a generated Blob into a form field that posts as a real file.
   */
  const holders = useRef<Record<string, HTMLInputElement | null>>({});
  const dimensions = useRef<Record<string, HTMLInputElement | null>>({});

  const shown = picked ?? currentUrl ?? null;

  function clear() {
    for (const field of Object.keys(sizes)) {
      const holder = holders.current[field];
      if (holder) holder.value = '';
      const width = dimensions.current[`${field}.width`];
      const height = dimensions.current[`${field}.height`];
      if (width) width.value = '';
      if (height) height.value = '';
    }
    setPicked(null);
    setInfo(null);
    setError(null);
  }

  async function onPick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setError(null);
    setInfo(null);

    try {
      let largest = 0;

      for (const [field, max] of Object.entries(sizes)) {
        const result = await downscale(file, max);

        const transfer = new DataTransfer();
        transfer.items.add(new File([result.blob], `${field}.webp`, { type: 'image/webp' }));

        const holder = holders.current[field];
        if (holder) holder.files = transfer.files;

        const width = dimensions.current[`${field}.width`];
        const height = dimensions.current[`${field}.height`];
        if (width) width.value = String(result.width);
        if (height) height.value = String(result.height);

        largest = Math.max(largest, result.blob.size);
        if (field === Object.keys(sizes)[0]) setPicked(URL.createObjectURL(result.blob));
      }

      setInfo(`Ready to upload — about ${Math.max(1, Math.round(largest / 1024))}KB.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That image could not be prepared.');
    } finally {
      setBusy(false);
      // Let the same file be chosen again after an error, which otherwise does
      // nothing because the value has not changed.
      event.target.value = '';
    }
  }

  return (
    <div className="grid content-start gap-2">
      <span className="text-sm font-medium leading-none">{label}</span>

      <button
        /*
         * `type="button"`: inside a form a bare <button> defaults to submit, so
         * opening the file picker would post the form instead.
         */
        type="button"
        onClick={() => picker.current?.click()}
        aria-label={shown ? `Replace ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}
        className={`group relative grid w-full place-items-center overflow-hidden rounded-lg border border-dashed border-input transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
          square ? 'aspect-square max-w-[240px]' : 'h-28 max-w-[240px]'
        } ${shown && plate ? 'bg-white p-2' : 'bg-muted/40 hover:bg-muted'}`}
      >
        {busy ? (
          <Loader2 aria-hidden className="size-6 animate-spin text-muted-foreground" />
        ) : shown ? (
          // A plain <img>: a blob: URL for a file that has not been uploaded yet
          // is not something next/image can take.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shown}
            alt=""
            className={`size-full ${square ? 'object-cover' : 'object-contain'}`}
          />
        ) : (
          <span className="grid place-items-center gap-1.5 p-4 text-center">
            <ImagePlus aria-hidden className="size-6 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Click to upload</span>
          </span>
        )}
      </button>

      {shown && !busy ? (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => picker.current?.click()}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            Replace
          </Button>

          {/*
            * Only offered once something has been picked. On an existing song
            * this undoes the new choice and leaves the stored artwork alone — a
            * song cannot exist without a cover, so there is nothing here that
            * would remove one.
            */}
          {picked ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}

      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {info ? <p className="text-xs text-muted-foreground">{info}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <FieldError name={name} />

      <input
        ref={picker}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onPick}
        hidden
      />

      {Object.keys(sizes).map((field) => (
        <div key={field} hidden>
          <input
            type="file"
            name={field}
            ref={(el) => {
              holders.current[field] = el;
            }}
          />
          <input
            type="hidden"
            name={`${field}.width`}
            ref={(el) => {
              dimensions.current[`${field}.width`] = el;
            }}
          />
          <input
            type="hidden"
            name={`${field}.height`}
            ref={(el) => {
              dimensions.current[`${field}.height`] = el;
            }}
          />
        </div>
      ))}
    </div>
  );
}
