import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A vinyl record: grooves, a label carrying the artwork, and a spindle hole.
 *
 * Extracted from `VinylCover` once the song grid needed the same object at a
 * smaller size. Only the record is here — where it sits and how far it slides
 * out of a sleeve belongs to whoever is placing it.
 *
 * Two things about this are load-bearing and easy to undo by accident:
 *
 *   - THE LABEL MUST CARRY THE ARTWORK. A disc of concentric rings is
 *     rotationally symmetric, so without one asymmetric feature the spin reads
 *     as a shimmer and the whole thing looks broken.
 *   - THE WRAPPER MUST CLIP. The disc looks like a circle but is a square
 *     element with rounded corners, and a rotating square sweeps a bounding box
 *     up to 1.41x its side — browsers count those invisible corners as page
 *     width. `overflow-hidden rounded-full` costs nothing to look at and keeps
 *     the sweep out of the layout.
 *
 * The artwork is drawn at a URL the placing component is already showing, so
 * the second use costs no download.
 */
export function RecordDisc({
  src,
  className,
  spinClassName,
  sizes = '140px',
}: {
  src: string;
  /** Position and size — this element is the clipped circle. */
  className?: string;
  /** Extra classes on the turning part, e.g. to pause the animation. */
  spinClassName?: string;
  /** How wide the label is drawn, for the browser's image picking. */
  sizes?: string;
}) {
  return (
    <span className={cn('relative block overflow-hidden rounded-full', className)}>
      <span className={cn('song-vinyl relative block size-full rounded-full', spinClassName)}>
        <span className="absolute left-1/2 top-1/2 aspect-square h-[32%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full">
          <Image
            src={src}
            alt=""
            width={400}
            height={400}
            sizes={sizes}
            className="size-full object-cover"
          />
        </span>

        {/* The spindle hole — small, and what makes the label read as a label. */}
        <span className="absolute left-1/2 top-1/2 size-[3.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-site-bg" />
      </span>

      {/* Light on the disc. Static, because light does not travel with the groove. */}
      <span
        aria-hidden="true"
        className="song-vinyl-sheen pointer-events-none absolute inset-0 rounded-full"
      />
    </span>
  );
}
