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
      <SelectContent className="admin-theme">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
