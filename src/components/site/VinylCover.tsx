import Image from 'next/image';

import { RecordDisc } from '@/components/site/RecordDisc';

/**
 * The cover as a record: a square sleeve with the disc drawn half out of it.
 *
 * This is a record label, and a sleeve with the vinyl sliding out is what a
 * release physically looks like — the one image on the page that could not
 * belong to any other kind of site. It dramatises the artwork that was already
 * the largest thing here rather than adding an ornament beside it.
 *
 * The disc turns slowly, in CSS, on `transform` only. `globals.css` disables
 * every animation under `prefers-reduced-motion: reduce`, which makes it
 * LOAD-BEARING that this looks right standing still — that is how those
 * visitors, and every screenshot, will see it.
 *
 * The artwork appears twice at one URL, so the second use costs no download.
 */
export function VinylCover({ src, alt }: { src: string; alt: string }) {
  return (
    /*
     * Wider than tall: the sleeve is the square and the remainder is the room
     * the disc needs. In ratio rather than pixels, so the whole assembly scales
     * as one object on a phone.
     */
    <div className="relative aspect-[1.52/1] w-full">
      {/*
       * `left`, not `right`: anchoring to the right edge would change how much
       * of the disc hides behind the sleeve as the box changes shape. From the
       * left, the overlap is fixed.
       *
       * THESE THREE NUMBERS ARE A SET — the box ratio, this offset, and the
       * disc's height. The disc is sized from the box's HEIGHT and positioned
       * from its WIDTH, so at a 1.52 ratio its right edge lands at
       * 0.38 + 0.92/1.52 = 0.985 of the width. An earlier pairing came to
       * 1.008 — a hair over, and enough to make the whole page scroll sideways
       * on a phone. Change one and recompute the others.
       *
       * The ratio went 1.42 -> 1.52 to get the record's LABEL out from behind
       * the sleeve: at 1.42 only 29% of it showed, and the label carrying the
       * artwork is what makes the rotation legible. 1.52 exposes 63% and costs
       * the sleeve about 6% of its width — the smallest move that fixes the
       * cue rather than the largest that would fully clear the label and
       * shrink the artwork by 17%.
       *
       * Clipping the disc to its circle is the second half of that fix, and
       * `RecordDisc` now carries it — a rotating square sweeps a bounding box
       * up to 1.41x its side, and the browser kept counting those invisible
       * corners as page width even once the circle itself fitted.
       */}
      <RecordDisc src={src} className="absolute left-[38%] top-[4%] aspect-square h-[92%]" />

      <Image
        src={src}
        alt={alt}
        width={1200}
        height={1200}
        priority
        sizes="(min-width: 1024px) 24rem, 70vw"
        className="absolute left-0 top-0 z-10 aspect-square h-full w-auto rounded-[18px] border border-white/10 object-cover shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]"
      />
    </div>
  );
}
