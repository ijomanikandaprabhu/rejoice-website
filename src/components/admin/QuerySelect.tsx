'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * A dropdown that sets ONE query param and navigates client-side.
 *
 * Replaces the GET forms these controls used to live in, for two reasons:
 *
 *   1. A native form submit is a full document load — it tore down the page and
 *      the channel logos visibly flashed as they re-downloaded. `router.replace`
 *      swaps only what changed.
 *   2. Those forms rebuilt the URL FROM SCRATCH, so every other filter had to be
 *      re-declared as a hidden input, and anything forgotten was silently
 *      dropped. That caused two real bugs — rows-per-page losing `channel=all`,
 *      and losing `type`. This MERGES into the existing params, so there is
 *      nothing to forget.
 */

export type QuerySelectOption = { value: string; label: string };

export function QuerySelect({
  param,
  value,
  options,
  ariaLabel,
  id,
  className,
  /** Value meaning "unset" — removed from the URL rather than written to it. */
  clearValue,
}: {
  param: string;
  value: string;
  options: QuerySelectOption[];
  ariaLabel: string;
  id?: string;
  className?: string;
  clearValue?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());

        if (clearValue !== undefined && next === clearValue) params.delete(param);
        else params.set(param, next);

        // A changed filter has its own page count; page 12 of the old one is
        // usually past the end of the new results.
        params.delete('page');

        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    >
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue />
      </SelectTrigger>
      {/*
        The open and close are eased on the site's own curve rather than the
        browser's default `ease`, and given a little longer to travel.

        At 150ms on plain `ease` the panel arrived at full speed and stopped
        dead, which is what "not smooth" describes — the motion has no
        deceleration, so a zoom and a slide happening together read as a snap.
        `EASE_HOUSE` (`src/lib/motion.ts`) is the curve the rest of the site
        settles on: fast away, slow to land.

        The close stays quicker than the open. A panel you have finished with
        should get out of the way; one that is arriving is worth watching.

        The reduced-motion block near the end of globals.css still overrides all
        of this with `animation: none`, so nobody who asked for stillness gets a
        longer animation out of it.
      */}
      <SelectContent className="admin-theme ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=open]:duration-[220ms] rounded-sm2 border-white/[0.08] bg-panel-alt p-1.5 text-panel-fg shadow-panel data-[state=closed]:duration-150">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            /* No `focus:bg-*` here: the highlight is owned by one rule in
               globals.css so the two cannot drift apart. This one lost to it
               on specificity anyway, which is the confusing way to find out. */
            className="cursor-pointer rounded-input py-2 pl-3 pr-9 text-sm text-panel-fg outline-none transition-colors focus:text-panel-fg focus-visible:outline-none data-[state=checked]:text-panel-accent"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
