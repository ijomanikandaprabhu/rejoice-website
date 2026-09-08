'use client';

import { Search, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';

/**
 * Search-as-you-type for the content table.
 *
 * Typing rewrites the URL after a short pause and the server re-renders the
 * rows — there is no submit button, because there is nothing to submit.
 *
 * Three details that matter:
 *
 *   - **Debounced.** A request per keystroke would hammer a 1,748-row table.
 *     `DEBOUNCE_MS` is the pause after typing stops.
 *   - **`replace`, not `push`.** Otherwise every keystroke becomes a history
 *     entry and the back button walks the query letter by letter.
 *   - **`page` is dropped.** A new query has its own page count, and page 40 of
 *     the old one is meaningless — and often past the end of the new results.
 */

const DEBOUNCE_MS = 350;

export function SearchField({
  defaultValue,
  /*
   * Overridable because the two tables search different things, and a
   * placeholder that names the wrong ones teaches the operator the tool is
   * narrower than it is. The videos table really does match titles only; the
   * songs table also matches the artist and the music credit.
   */
  placeholder = 'Search titles…',
}: {
  defaultValue: string;
  placeholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(defaultValue);

  /*
   * The current URL, read through a ref.
   *
   * If the effect below depended on `searchParams` it would re-fire on the very
   * navigation it just triggered, chasing its own tail.
   */
  const paramsRef = useRef(searchParams);
  /*
   * Kept current from an effect, not assigned during render. A ref written
   * while rendering is a value React cannot see changing, and the ref is only
   * ever READ from `apply` — which runs from a keystroke or the debounce
   * timer, both long after this has settled.
   */
  useEffect(() => {
    paramsRef.current = searchParams;
  }, [searchParams]);

  /** What the URL already says, so we never navigate to where we already are. */
  const appliedRef = useRef(defaultValue);

  /*
   * The URL can change from elsewhere — Reset, or switching channel. Follow it.
   *
   * Adjusted DURING render rather than from an effect. React re-runs this
   * component immediately, before the browser paints, so the field never shows
   * the stale value for a frame; an effect would set state after the paint and
   * cost a visible second render. This is React's own documented shape for
   * "reset state when a prop changes".
   */
  const [lastDefault, setLastDefault] = useState(defaultValue);
  if (defaultValue !== lastDefault) {
    setLastDefault(defaultValue);
    setValue(defaultValue);
  }

  /* The ref half, which cannot happen during render. See `paramsRef` above. */
  useEffect(() => {
    appliedRef.current = defaultValue;
  }, [defaultValue]);

  const apply = (next: string) => {
    if (next === appliedRef.current) return;
    appliedRef.current = next;

    const p = new URLSearchParams(paramsRef.current.toString());
    if (next) p.set('q', next);
    else p.delete('q');
    p.delete('page');

    const query = p.toString();
    // `scroll: false` keeps the table where it is while results swap underneath.
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  useEffect(() => {
    const timer = setTimeout(() => apply(value), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />

      <Input
        name="q"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          // Enter should not submit the surrounding filter form — the value is
          // already on its way. Apply it now rather than waiting out the pause.
          if (event.key === 'Enter') {
            event.preventDefault();
            apply(value);
          }
          if (event.key === 'Escape') setValue('');
        }}
        aria-label="Search video titles"
        className="h-9 w-56 pl-8 pr-8"
      />

      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue('');
            // Clear at once. Waiting out the debounce makes the X feel broken.
            apply('');
          }}
          className="absolute right-0 top-0 grid h-9 w-8 place-items-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
