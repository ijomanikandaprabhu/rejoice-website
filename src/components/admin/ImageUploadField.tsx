'use client';

import { ImageIcon, Loader2 } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';

import { FieldError } from '@/components/admin/ActionForm';
import { Input } from '@/components/ui/input';
import { downscale } from '@/lib/images/downscale';

/**
 * Pick an image, shrink it here, and submit the small version.
 *
 * The resize is not a nicety. A 3000x3000 cover is several megabytes and
 * neither Vercel (about 4.5MB per request) nor Next (1MB per server action)
 * will carry it. What leaves this component is a WebP of roughly 150KB.
 *
 * The chosen file is deliberately NOT what gets submitted: the visible input
 * carries no name, and the downscaled result is written into hidden inputs
 * alongside its dimensions. Submitting the original would defeat the whole
 * point and fail on a size limit the administrator cannot see.
 *
 * `sizes` may ask for more than one copy — a song cover is stored large for its
 * own page and small for the grid — and each gets its own trio of hidden
 * fields.
 */
export function ImageUploadField({
  name,
  sizes,
  label = 'Choose an image',
  hint,
  currentUrl,
  square = false,
}: {
  /** Base field name. With one size the fields are `<name>`, `<name>.width`… */
  name: string;
  /** Field name → longest side in pixels. */
  sizes: Record<string, number>;
  label?: string;
  hint?: string;
  /** An existing image, shown until a new one is picked. */
  currentUrl?: string;
  square?: boolean;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /*
   * The hidden file inputs are driven through a DataTransfer, which is the only
   * way to put a generated Blob into a form field that posts as a real file.
   */
  const holders = useRef<Record<string, HTMLInputElement | null>>({});
  const dimensions = useRef<Record<string, HTMLInputElement | null>>({});

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
        if (field === Object.keys(sizes)[0]) setPreview(URL.createObjectURL(result.blob));
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

      <div className="flex items-start gap-4">
        <div
          className={`grid shrink-0 place-items-center overflow-hidden rounded-md border bg-muted ${
            square ? 'size-24' : 'h-16 w-28'
          }`}
        >
          {busy ? (
            <Loader2 aria-hidden className="size-5 animate-spin text-muted-foreground" />
          ) : preview ? (
            // A plain <img>: this is a blob: URL for a file that has not been
            // uploaded yet, which next/image cannot take.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-contain" />
          ) : (
            <ImageIcon aria-hidden className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="grid flex-1 gap-2">
          <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={onPick} />
          {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
          {info ? <p className="text-xs text-muted-foreground">{info}</p> : null}
          {error ? (
            <p role="alert" className="text-xs font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <FieldError name={name} />
        </div>
      </div>

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
