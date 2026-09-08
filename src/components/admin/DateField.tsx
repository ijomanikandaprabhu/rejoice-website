'use client';

import { CalendarIcon, X } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * A date, chosen from a calendar, submitted as plain form data.
 *
 * The visible control is shadcn's `Calendar` in a popover; what actually posts
 * is a HIDDEN INPUT carrying `YYYY-MM-DD`. That is deliberate and is the same
 * trick `ImageUploadField` uses: the server action and its zod rule already
 * speak that exact shape, so nothing behind the form has to know the input
 * stopped being an `<input type="date">`.
 *
 * ## The calendar day is the value, not an instant in time
 *
 * A release date is a day on a sleeve, not a moment. It is stored as UTC
 * midnight, and everything here works in whole days so that it stays the day it
 * was picked:
 *
 *   - coming IN, the day is read off the stored date in UTC and rebuilt as
 *     local midnight, because `react-day-picker` thinks in local time;
 *   - going OUT, the value is written from the LOCAL year/month/day rather than
 *     `toISOString()`, which would roll back a day for any administrator west of
 *     UTC — 14 March picked in London is `2026-03-14`, and so is 14 March picked
 *     in New York.
 *
 * Get either half wrong and the bug is the classic one: the date saves as the
 * day before, but only for some people.
 */

/** The stored UTC day, as a local `Date` the calendar can highlight. */
function toLocalDay(date: Date | null | undefined): Date | undefined {
  if (!date) return undefined;
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** A local `Date` as the `YYYY-MM-DD` the action parses. Never `toISOString()`. */
function toDayValue(date: Date | undefined): string {
  if (!date) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Formatted without a `timeZone`, unlike `formatDate` in `lib/utils`.
 *
 * That helper deliberately renders in the site's timezone, which is right for a
 * stored instant shown to a visitor. Here the value is already a local calendar
 * day, so naming a timezone could only shift it back off the day just chosen.
 */
function label(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function DateField({
  id,
  name,
  defaultValue,
  placeholder = 'Pick a date',
}: {
  id?: string;
  name: string;
  defaultValue?: Date | null;
  placeholder?: string;
}) {
  const [date, setDate] = useState<Date | undefined>(() => toLocalDay(defaultValue));
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center gap-2">
      {/* The only thing that submits. Everything above it is the way in. */}
      <input type="hidden" name={name} value={toDayValue(date)} />

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-start gap-2 font-normal',
              // Muted until something is chosen, so an empty date reads as a
              // placeholder rather than as a value.
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="size-4 shrink-0 opacity-70" aria-hidden="true" />
            {date ? label(date) : placeholder}
          </Button>
        </PopoverTrigger>

        {/* `admin-theme` because Radix portals this to `<body>`, outside the
            admin subtree — without it the calendar renders in the public site's
            font and border treatment. `FormSelect` re-applies it for the same
            reason. */}
        <PopoverContent className="admin-theme w-auto p-0" align="start">
          <Calendar
            /*
             * Transparent, so the calendar does not paint a second, darker box
             * inside the popover's own panel — `bg-background` (#0C0C0D) sitting
             * inside `bg-popover` (#1B1B1D) read as a frame nobody asked for.
             *
             * The generated component tries to handle this itself with
             * `[[data-slot=popover-content]_&]:bg-transparent`, but this
             * project's `popover.tsx` predates shadcn's `data-slot` convention
             * and sets no such attribute, so that rule never matches.
             */
            className="bg-transparent"
            mode="single"
            selected={date}
            /*
             * Open on the month of the date already chosen, not on today.
             * Without this, reopening a song released in 2027 showed September
             * 2026 with the selection nowhere in sight, and the only way to see
             * it was to navigate back to it.
             */
            defaultMonth={date}
            onSelect={(next) => {
              setDate(next);
              // Close on choosing: the popover has done its job, and leaving it
              // open hides the field it just filled in.
              setOpen(false);
            }}
            captionLayout="dropdown"
            /*
             * The year dropdown's range, set rather than defaulted.
             *
             * Left alone it offered 1926 to the current year — a century of
             * years no gospel catalogue will ever use, and, far worse, NO FUTURE
             * ONES. A label schedules releases; a record dated next month has to
             * be enterable, and out of the box it simply was not.
             */
            startMonth={new Date(1990, 0)}
            endMonth={new Date(new Date().getFullYear() + 2, 11)}
            /*
             * NO `autoFocus`, and it is a straight trade against the month
             * slide, not an oversight.
             *
             * `useAnimation` in react-day-picker bails outright when a day is
             * focused — `if (animatingRef.current || isSameMonth || focused)
             * return` — and `autoFocus` focuses one on mount and keeps one
             * focused from then on, so the transition could never play once.
             *
             * Little is lost: Radix's focus scope already moves focus into the
             * popover when it opens, so the control is still reachable and
             * escapable from the keyboard; a day just is not pre-selected.
             */
          />
        </PopoverContent>
      </Popover>

      {/*
       * Clearing has to stay possible. The column is nullable and the action
       * treats an empty string as "no date" — without this the only way back
       * from a wrong date would be picking a different wrong one.
       */}
      {date ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setDate(undefined)}
          aria-label="Clear the date"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
