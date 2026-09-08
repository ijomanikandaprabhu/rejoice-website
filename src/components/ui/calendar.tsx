"use client"

import * as React from "react"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import {
  DayButton,
  DayPicker,
  getDefaultClassNames,
  type DropdownProps,
} from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

/**
 * ADAPTED after generation — do not re-run `npx shadcn add calendar` over it
 * without re-applying these, because the upstream file is written for a project
 * this one is not.
 *
 *   1. TAILWIND v3, NOT v4. The generated component used `has-focus:`,
 *      `shadow-xs` and the `rtl:**:[...]` arbitrary variant, none of which
 *      compile here — so the caption's border, ring and focus state silently did
 *      not exist.
 *
 *   2. THE MONTH AND YEAR DROPDOWNS ARE OURS. Upstream renders a real `<select>`
 *      as `absolute inset-0 opacity-0` over a fake label, so clicking it opens
 *      the OPERATING SYSTEM's list — unstyleable by CSS, in the wrong colours,
 *      and tall enough to spill out over the form underneath. The `Dropdown`
 *      override below replaces it with the same Radix select the rest of the
 *      admin uses. Overriding `Dropdown` alone is enough: `MonthsDropdown` and
 *      `YearsDropdown` both delegate to it.
 */

/**
 * The caption's month / year control.
 *
 * `react-day-picker` hands over a NATIVE SELECT's props — numeric `value`, and
 * an `onChange` typed as a select's change handler — while Radix hands back a
 * bare string. The bridge is the cast below: rdp only ever reads
 * `event.target.value`, so a whole synthetic event would be ceremony around the
 * one field it looks at.
 */
function CalendarDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={(next) =>
        onChange?.({
          target: { value: next },
        } as React.ChangeEvent<HTMLSelectElement>)
      }
      disabled={disabled}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-8 w-auto gap-1 border-input px-2 text-sm font-medium focus:ring-1"
      >
        <SelectValue />
      </SelectTrigger>

      {/* `admin-theme` because Radix portals this to `<body>`, outside the admin
          subtree — the same reason `FormSelect` re-applies it. Capped in height
          so nearly forty years scroll instead of covering the page. */}
      <SelectContent className="admin-theme max-h-[15rem]">
        {options?.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
            className="cursor-pointer rounded-input py-2 pl-3 pr-9 text-sm text-panel-fg outline-none transition-colors focus:bg-white/[0.1] focus:text-panel-fg focus-visible:outline-none data-[state=checked]:text-panel-accent"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"]
}) {
  const defaultClassNames = getDefaultClassNames()

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn(
        // `--cell-size` sizes the days AND the whole caption row, which is
        // written in `h-[--cell-size]` throughout: raise it and the calendar
        // gets roomier as one piece. 2rem read cramped inside the popover.
        "bg-background group/calendar p-3 [--cell-size:2.25rem] [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
        // The two `rtl:**:[...]` rules that were here are gone: `**:` is a
        // Tailwind v4 variant and compiles to nothing in v3, and this site is
        // single-language LTR by design (architecture doc §32).
        className
      )}
      captionLayout={captionLayout}
      // Slide between months rather than snapping. The class names below are
      // what make it visible — rdp ships its own keyframes in a stylesheet this
      // project never imports.
      animate
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString("default", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: buttonVariant }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption
        ),
        dropdowns: cn(
          "flex h-[--cell-size] w-full items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns
        ),
        /*
         * A plain wrapper now. The border, ring and focus state moved to the
         * `SelectTrigger` in `CalendarDropdown`, which already has them — and
         * the classes that used to be here (`has-focus:`, `shadow-xs`) were
         * Tailwind v4 and compiled to nothing in this project anyway.
         */
        dropdown_root: cn("relative", defaultClassNames.dropdown_root),
        // No `absolute inset-0 opacity-0`: there is no native select left to
        // hide behind a label.
        dropdown: cn(defaultClassNames.dropdown),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "[&>svg]:text-muted-foreground flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5",
          defaultClassNames.caption_label
        ),
        month_grid: cn("w-full border-collapse", defaultClassNames.month_grid),
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        week_number_header: cn(
          "w-[--cell-size] select-none",
          defaultClassNames.week_number_header
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number
        ),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day
        ),
        range_start: cn(
          "bg-accent rounded-l-md",
          defaultClassNames.range_start
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-accent rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "bg-accent text-accent-foreground rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground",
          defaultClassNames.outside
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),

        /*
         * The month transition. "before" is the month to the left and "after"
         * the one to the right, so stepping FORWARD exits the old grid leftwards
         * and brings the new one in from the right.
         *
         * SINGLE CLASS NAMES, and not the `animate-in fade-in slide-in-from-*`
         * stack used everywhere else in this project. `react-day-picker` adds
         * and removes these through `classList`, which throws
         * `InvalidCharacterError` on any string containing a space — a utility
         * stack here takes the whole calendar down, as the first attempt did.
         * The keyframes are in globals.css beside the class definitions.
         */
        /*
         * The EXIT pair reads inverted, and that is rdp's naming, not a typo.
         * "before"/"after" describes where the ENTERING month sits, so stepping
         * forward pairs `weeks_after_enter` with `weeks_before_exit` — the new
         * month arrives from the right while the old one leaves to the left.
         * Mapping these the obvious way sends both months rightwards at once.
         */
        weeks_before_enter: "cal-enter-from-left",
        weeks_before_exit: "cal-exit-to-left",
        weeks_after_enter: "cal-enter-from-right",
        weeks_after_exit: "cal-exit-to-right",
        caption_before_enter: "cal-fade-in",
        caption_before_exit: "cal-fade-out",
        caption_after_enter: "cal-fade-in",
        caption_after_exit: "cal-fade-out",

        ...classNames,
      }}
      components={{
        Root: ({ className, rootRef, ...props }) => {
          return (
            <div
              data-slot="calendar"
              ref={rootRef}
              className={cn(className)}
              {...props}
            />
          )
        },
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon className={cn("size-4", className)} {...props} />
            )
          }

          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", className)}
                {...props}
              />
            )
          }

          return (
            <ChevronDownIcon className={cn("size-4", className)} {...props} />
          )
        },
        // Replaces the native `<select>` for BOTH month and year: rdp's
        // `MonthsDropdown` and `YearsDropdown` each delegate to `Dropdown`.
        Dropdown: CalendarDropdown,
        DayButton: CalendarDayButton,
        WeekNumber: ({ children, ...props }) => {
          return (
            <td {...props}>
              <div className="flex size-[--cell-size] items-center justify-center text-center">
                {children}
              </div>
            </td>
          )
        },
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const defaultClassNames = getDefaultClassNames()

  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "data-[selected-single=true]:bg-primary data-[selected-single=true]:text-primary-foreground data-[range-middle=true]:bg-accent data-[range-middle=true]:text-accent-foreground data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50 flex aspect-square h-auto w-full min-w-[--cell-size] flex-col gap-1 font-normal leading-none data-[range-end=true]:rounded-md data-[range-middle=true]:rounded-none data-[range-start=true]:rounded-md group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px] [&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day,
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
