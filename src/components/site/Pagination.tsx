import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';

type Props = {
  page: number;
  pageCount: number;
  /** Builds the link for a page number. */
  hrefFor: (page: number) => string;
  className?: string;
};

/** How many pages either side of the current one always show. */
const SIBLINGS = 1;

/**
 * Which controls to draw: first and last page always, the current page and its
 * neighbours, and a gap marker for everything skipped.
 *
 * A run of every page number is fine at three pages and unusable at forty — this
 * keeps the control at a constant ~7 items whatever the count. Below that many
 * pages nothing is skipped and no gap marker appears.
 */
function buildPages(page: number, pageCount: number): (number | 'gap')[] {
  const pages = new Set<number>([1, pageCount]);
  for (let n = page - SIBLINGS; n <= page + SIBLINGS; n += 1) {
    if (n >= 1 && n <= pageCount) pages.add(n);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];

  sorted.forEach((n, i) => {
    // A gap only where numbers were actually skipped — never between
    // consecutive ones, which would give "1 … 2".
    if (i > 0 && n - sorted[i - 1] > 1) out.push('gap');
    out.push(n);
  });

  return out;
}

/** ‹ Previous · 1 2 3 … 12 · Next › */
export function Pagination({ page, pageCount, hrefFor, className }: Props) {
  if (pageCount <= 1) return null;

  const items = buildPages(page, pageCount);
  const step =
    'inline-flex min-h-[2.5rem] items-center gap-1 rounded-pill px-3 text-sm transition-colors';

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex flex-wrap items-center justify-center gap-1', className)}
    >
      {/* At the ends these are plain text, not links: a link to a page that does
          not exist is worse than a control that is visibly unavailable. */}
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={cn(step, 'text-site-muted hover:text-site-fg')}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(step, 'text-site-muted/40')}>
          <ChevronLeft className="size-4" />
          Previous
        </span>
      )}

      {items.map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1 text-sm text-site-muted/60">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-current={item === page ? 'page' : undefined}
            className={cn(
              'grid size-10 place-items-center rounded-pill text-sm font-medium tabular-nums transition-colors',
              item === page
                ? 'border border-white/20 text-site-accent'
                : 'text-site-muted hover:text-site-fg',
            )}
          >
            {/* So a screen reader says "Page 3", not a bare "3". */}
            <span className="sr-only">Page </span>
            {item}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} className={cn(step, 'text-site-muted hover:text-site-fg')}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : (
        <span aria-hidden="true" className={cn(step, 'text-site-muted/40')}>
          Next
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
