import React from 'react';

import { cn } from '@/lib/utils';

/**
 * A round, glassy icon button with a sheen that sweeps across on hover.
 *
 * Adapted from the supplied component in three ways:
 *
 *   1. `cn()` instead of bare `clsx`. Both join class names, but `cn` also
 *      resolves Tailwind conflicts, so a `className` passed in actually
 *      overrides the variant instead of both landing on the element and letting
 *      source order decide.
 *   2. A named export alongside the default, matching every other component in
 *      this folder.
 *   3. `blue` and `pink` variants added, so Facebook and Instagram get their own
 *      colour — the original shipped default/green/indigo/red.
 *
 * It renders a `<button>`. For a social link, pass `as="a"` with an `href`, so
 * the thing that navigates is a real link: middle-click, open-in-new-tab and
 * screen-reader link navigation all keep working.
 */

export type ShinyButtonVariant =
  | 'default'
  | 'green'
  | 'indigo'
  | 'red'
  | 'blue'
  | 'pink';

const variantClasses: Record<ShinyButtonVariant, string> = {
  default: `
    border-white/10 hover:border-white/30
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-white/10 hover:to-black/40
    hover:shadow-white/20`,
  green: `
    border-green-500/20 hover:border-green-500/50
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-green-500/10 hover:to-black/40
    hover:shadow-green-500/30`,
  indigo: `
    border-indigo-500/20 hover:border-indigo-500/50
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-indigo-500/10 hover:to-black/40
    hover:shadow-indigo-500/30`,
  red: `
    border-red-500/20 hover:border-red-500/50
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-red-500/10 hover:to-black/40
    hover:shadow-red-500/30`,
  blue: `
    border-blue-500/20 hover:border-blue-500/50
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-blue-500/10 hover:to-black/40
    hover:shadow-blue-500/30`,
  pink: `
    border-pink-500/20 hover:border-pink-500/50
    bg-gradient-to-tr from-black/60 to-black/40
    hover:bg-gradient-to-tr hover:from-pink-500/10 hover:to-black/40
    hover:shadow-pink-500/30`,
};

const glowGradientClasses: Record<ShinyButtonVariant, string> = {
  default: 'via-white/10',
  green: 'via-green-400/20',
  indigo: 'via-indigo-400/20',
  red: 'via-red-400/20',
  blue: 'via-blue-400/20',
  pink: 'via-pink-400/20',
};

type ShinyButtonProps = {
  icon: React.ReactNode;
  variant?: ShinyButtonVariant;
  className?: string;
  ariaLabel: string;
} & (
  | ({ as?: 'button' } & Omit<React.ComponentPropsWithoutRef<'button'>, 'className' | 'aria-label'>)
  | ({ as: 'a' } & Omit<React.ComponentPropsWithoutRef<'a'>, 'className' | 'aria-label'>)
);

/*
 * Forwards its ref, which is not optional here.
 *
 * Radix's `asChild` clones this element and attaches a ref to measure and
 * position against it. Without forwarding, the ref never lands: a Popover
 * anchored to this button loses its anchor and renders at the viewport origin
 * instead of under the button, and a Tooltip has nothing to point at.
 */
export const ShinyButton = React.forwardRef<HTMLElement, ShinyButtonProps>(function ShinyButton(
  { icon, variant = 'default', className, ariaLabel, ...props },
  ref,
) {
  const { as = 'button', ...rest } = props as { as?: 'button' | 'a' };
  const Tag = as;

  return (
    <Tag
      ref={ref as React.Ref<never>}
      {...(rest as Record<string, unknown>)}
      // Always set for a button: without it a button inside a form submits,
      // which is the default nobody expects.
      {...(as === 'button' ? { type: 'button' as const } : {})}
      aria-label={ariaLabel}
      className={cn(
        'group relative inline-grid size-14 place-items-center overflow-hidden rounded-full border shadow-lg backdrop-blur-lg',
        'cursor-pointer transition-all duration-300 ease-out',
        'hover:rotate-2 hover:scale-110 hover:shadow-2xl active:rotate-0 active:scale-95',
        // Keyboard users get the same affordance as a pointer.
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-site-accent focus-visible:ring-offset-2 focus-visible:ring-offset-site-bg',
        variantClasses[variant],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full',
          glowGradientClasses[variant],
        )}
      />
      <span className="relative z-10 grid place-items-center">{icon}</span>
    </Tag>
  );
});

export default ShinyButton;
