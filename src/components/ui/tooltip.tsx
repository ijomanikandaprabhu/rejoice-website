'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import { cn } from '@/lib/utils';

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

/*
 * ADAPTED from the shadcn default, which is `bg-primary text-primary-foreground`.
 *
 * `--primary` is the lime brand colour, so every tooltip on the site rendered as
 * a solid lime block — a hint shaped like a warning. This is the neutral popover
 * surface instead, matching every other floating panel. Shared with the public
 * site deliberately: its tooltips were lime for the same reason.
 *
 * Scoping it to `.admin-theme` in CSS would not have worked — tooltips render
 * through a portal, outside that subtree. That portal is also why the border
 * colour is named: `.admin-theme *` sets `border-border` for everything inside
 * the admin, and a tooltip is not inside it, so a bare `border` fell through to
 * Tailwind's default grey — measured rgb(229,231,235), a near-white hairline on
 * a near-black panel.
 */
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 origin-[--radix-tooltip-content-transform-origin] overflow-hidden rounded-md border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
