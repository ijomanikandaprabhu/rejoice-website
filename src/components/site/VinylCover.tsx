import Image from 'next/image';

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
    <div className="relative aspect-[1.42/1] w-full">
      {/*
       * `left`, not `right`: anchoring to the right edge would change how much
       * of the disc hides behind the sleeve as the box changes shape. From the
       * left, the overlap is fixed.
       *
       * THESE TWO NUMBERS ARE A PAIR. The disc is sized from the box's HEIGHT
       * and positioned from its WIDTH, so with a 1.42 ratio its right edge
       * lands at 0.34 + 0.92/1.42 = 0.988 of the width. At 36% it came to
       * 1.008 — a hair over, which was enough to make the whole page scroll
       * sideways on a phone. Change one and check the other.
       *
       * `overflow-hidden` is the second half of that fix, and less obvious. The
       * disc LOOKS like a circle but is a square element with rounded corners,
       * and a rotating square sweeps a bounding box up to 1.41x its side — so
       * the browser kept counting those invisible corners as page width even
       * once the circle itself fitted. Clipping to the circle costs nothing to
       * look at and stops the sweep from reaching the layout.
       */}
      <div className="absolute left-[34%] top-[4%] aspect-square h-[92%] overflow-hidden rounded-full">
        <div className="song-vinyl relative size-full rounded-full">
          {/*
           * The label carries the artwork, and that is what makes the rotation
           * legible — concentric grooves alone are rotationally symmetric and
           * would merely shimmer.
           */}
          <span className="absolute left-1/2 top-1/2 aspect-square h-[32%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full">
            <Image
              src={src}
              alt=""
              width={400}
              height={400}
              sizes="140px"
              className="size-full object-cover"
            />
          </span>

          {/* The spindle hole — small, and what makes the label read as a label. */}
          <span className="absolute left-1/2 top-1/2 size-[3.4%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-site-bg" />
        </div>

        {/* Light on the disc. Static, because light does not travel with the groove. */}
        <span
          aria-hidden="true"
          className="song-vinyl-sheen pointer-events-none absolute inset-0 rounded-full"
        />
      </div>

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
