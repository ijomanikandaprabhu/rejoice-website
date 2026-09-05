import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * A platform's logo, on a light plate.
 *
 * THE PLATE IS NOT DECORATION. These are full-colour brand marks and several —
 * Apple Music, Amazon Music, Resso, Wynk, YouTube Music — are near-black
 * wordmarks. The admin's surface is `--muted: 240 2% 11%`, so on it they are
 * invisible: the row shows a name beside an empty grey box.
 *
 * The public site reached the same conclusion first, in
 * `src/components/site/PlatformGrid.tsx`. This exists so the admin cannot drift
 * back to a dark background without meeting the reason.
 *
 * `object-contain` with padding, never `cover`: a wordmark cropped to fill a box
 * is worse than one that is merely small.
 */
export function PlatformLogo({
  logoId,
  className,
}: {
  logoId: string;
  /** Size and shape come from the caller; the plate and the fit do not. */
  className?: string;
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center overflow-hidden rounded bg-white p-1.5',
        className,
      )}
    >
      <Image
        src={`/api/media/${logoId}`}
        alt=""
        width={64}
        height={40}
        className="size-full object-contain"
      />
    </span>
  );
}
