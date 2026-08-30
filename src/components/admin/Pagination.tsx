import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * The admin pager: First · Previous · windowed page numbers · Next · Last.
 *
 * Shared because YouTube Content and Enquiries had grown two different pagers —
 * one windowed with Previous/Next, one listing every page with neither. A
 * catalogue of 1,748 videos is 70 pages, which is unusable as a flat list, so
 * the windowed behaviour is the one worth keeping.
 *
 * A Server Component, which is what lets `buildHref` be passed as a function.
 */

/** How many numbered pages surround the current one. */
const WINDOW = 5;

function Ends({ label, href, disabled }: { label: string; href: string; disabled: boolean }) {
  /*
   * A real disabled control at the ends.
   *
   * `disabled` handed to an <a> through asChild is not a valid attribute and the
   * `disabled:` variants never match — so "Previous" on page 1 looked and
   * behaved enabled. A span is the honest rendering: visibly inert and not
   * focusable.
   */
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        className="inline-flex h-8 items-center rounded-md border px-3 text-sm text-muted-foreground opacity-50"
      >
        {label}
      </span>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

export function Pagination({
  page,
  pageCount,
  buildHref,
}: {
  page: number;
  pageCount: number;
  buildHref: (n: number) => string;
}) {
  if (pageCount <= 1) return null;

  // Keep the window full near either end rather than letting it shrink.
  const start = Math.max(1, Math.min(page - Math.floor(WINDOW / 2), pageCount - WINDOW + 1));
  const end = Math.min(pageCount, start + WINDOW - 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  const onFirst = page <= 1;
  const onLast = page >= pageCount;

  return (
    <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Pagination">
      <Ends label="First" href={buildHref(1)} disabled={onFirst} />
      <Ends label="Previous" href={buildHref(page - 1)} disabled={onFirst} />

      {start > 1 ? <span className="text-muted-foreground">…</span> : null}

      {pages.map((n) => (
        <Button
          key={n}
          asChild
          variant={n === page ? 'default' : 'outline'}
          size="sm"
          className="tabular-nums"
        >
          <Link href={buildHref(n)} aria-current={n === page ? 'page' : undefined}>
            {n}
          </Link>
        </Button>
      ))}

      {end < pageCount ? <span className="text-muted-foreground">…</span> : null}

      <Ends label="Next" href={buildHref(page + 1)} disabled={onLast} />
      <Ends label="Last" href={buildHref(pageCount)} disabled={onLast} />
    </nav>
  );
}
