'use client';

import { Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * The public site's search box: type, and the URL catches up.
 *
 * Extracted from `ChannelPageBody`, which had the only copy. A second page now
 * needs the same behaviour, and a debounced URL-syncing input is exactly the
 * kind of thing that drifts once it exists twice — the channel page's own
 * comments already noted it was the third implementation of these rules on the
 * site.
 *
 * Search runs on the SERVER and lives in the URL as `?q=`. That is what makes a
 * result page shareable and the Back button meaningful.
 *
 * Three rules the original established, all kept:
 *
 *   - the input is local state so typing is instant, with the URL as the source
 *     of truth catching up after a pause;
 *   - `router.replace`, not `push`, so Back does not walk the query letter by
 *     letter;
 *   - `page` is dropped on a new query, because page 12 of the previous search
 *     means nothing for this one.
 */

/** Pause after typing stops before the URL is rewritten. */
const SEARCH_DEBOUNCE_MS = 350;

export function SiteSearchField({
  query,
  basePath,
  placeholder,
  label,
  id = 'site-search',
  controls,
  className,
}: {
  /** The search currently applied, straight from `?q=`. */
  query: string;
  /** Where results live, e.g. `/songs/all` or `/creations/rejoicekids`. */
  basePath: string;
  placeholder: string;
  /** Visually hidden, but read out. */
  label: string;
  id?: string;
  /** Id of the region that updates, for screen readers. */
  controls?: string;
  className?: string;
}) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [value, setValue] = React.useState(query);

  /*
   * What the URL already says, so we never navigate to where we already are.
   */
  const applied = React.useRef(query);

  // The URL can change from elsewhere — Clear, or a paginated link. Follow it.
  React.useEffect(() => {
    applied.current = query;
    setValue(query);
  }, [query]);

  const push = React.useCallback(
    (next: string) => {
      if (next === applied.current) return;
      applied.current = next;

      const params = new URLSearchParams();
      if (next) params.set('q', next);

      const qs = params.toString();
      router.replace(`${basePath}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, basePath],
  );

  React.useEffect(() => {
    const timer = setTimeout(() => push(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, push]);

  const clear = () => {
    setValue('');
    push('');
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>

      <Search
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-site-muted"
      />

      <input
        id={id}
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-controls={controls}
        className={cn(
          'h-11 w-full rounded-pill border border-white/10 bg-site-surface pl-11 pr-11 text-sm text-site-fg',
          /*
           * Focus is a soft accent edge with a diffuse warm glow. A
           * full-strength border AND a 1px accent ring used to stack here — two
           * solid orange lines with no gap, reading as one thick stroke. The
           * global `body :focus-visible` outline is untouched, so keyboard
           * focus still gets the site's standard indicator.
           */
          'placeholder:text-site-muted focus:border-site-accent/60 focus:shadow-[0_0_0_4px_rgba(255,109,41,0.12)] focus:outline-none',
          // The browser's own search clear button would sit beside ours.
          '[&::-webkit-search-cancel-button]:hidden',
        )}
      />

      {value.length > 0 ? (
        <button
          type="button"
          onClick={clear}
          className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-pill text-site-muted transition-colors hover:text-site-fg"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Clear search</span>
        </button>
      ) : null}
    </div>
  );
}
