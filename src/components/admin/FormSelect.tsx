'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/**
 * A shadcn Select that behaves like a plain form control.
 *
 * Radix renders a hidden native select when `name` is set, so this submits
 * inside both the GET filter forms and the server-action forms without any
 * client state of its own.
 *
 * It exists as a wrapper because the admin pages are Server Components and
 * cannot use Radix directly, and because six near-identical trigger/content
 * blocks would otherwise be copied across three files.
 */

export type SelectOption = { value: string; label: string };

export function FormSelect({
  name,
  options,
  defaultValue,
  placeholder = 'Select…',
  id,
  ariaLabel,
  className,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger id={id} aria-label={ariaLabel} className={cn('w-full', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="admin-theme">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="cursor-pointer rounded-input py-2 pl-3 pr-9 text-sm text-panel-fg outline-none transition-colors focus:bg-white/[0.1] focus:text-panel-fg focus-visible:outline-none data-[state=checked]:text-panel-accent"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
