import { useId } from 'react';

import { cn } from '@/lib/utils';

/**
 * A tiled dot texture, drawn as an SVG `<pattern>` so it costs one element
 * whatever area it covers.
 *
 * Two changes from the supplied component:
 *
 *   1. It typed every prop as `any`, plus an `[key: string]: any` index
 *      signature. This project runs strict TypeScript, and those `any`s were
 *      hiding the fact that the geometry props are all numbers. The spread
 *      lands on an `<svg>`, so the rest is `React.SVGProps<SVGSVGElement>`.
 *
 *   2. Its default fill was `slate-500`, which is nowhere in this site's
 *      palette. On black the dots want to be a low-alpha white — enough to read
 *      as texture behind copy, not enough to grey the panel out.
 *
 * `useId` for the pattern id is the supplied component's own good idea and
 * stays: two instances on one page would otherwise collide on the `<pattern>`
 * id and the second would silently inherit the first's geometry.
 */
export function DotPattern({
  width = 24,
  height = 24,
  x = 0,
  y = 0,
  cx = 1,
  cy = 0.5,
  cr = 0.5,
  className,
  ...props
}: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  /** Circle centre and radius, in the pattern's own coordinates. */
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
} & React.SVGProps<SVGSVGElement>) {
  const id = useId();

  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 size-full fill-white/[0.10]', className)}
      {...props}
    >
      <defs>
        <pattern
          id={id}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          patternContentUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}

export default DotPattern;
