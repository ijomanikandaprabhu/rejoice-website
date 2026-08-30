'use client';

import { Toaster } from '@/components/ui/sonner';

/**
 * Toast host for the admin.
 *
 * Wraps shadcn's `Toaster` rather than editing it, so the generated component
 * stays pristine and admin-specific configuration lives with the admin. Two
 * settings here are load-bearing, not taste:
 *
 *   1. `theme="dark"`. The shadcn wrapper reads `useTheme()` from next-themes
 *      and falls back to "system" — but this app mounts no ThemeProvider, so
 *      that fallback always wins and sonner would follow the visitor's
 *      *operating system*. An administrator on a light-mode OS would get white
 *      toasts over the near-black panel. The admin is unconditionally dark, so
 *      there is nothing to follow.
 *
 *   2. `font-admin`. Toasts render in a portal on `document.body`, outside the
 *      `.admin-theme` subtree that supplies Manrope — so without this they
 *      silently fall back to the public site's Inter Tight. The colour tokens
 *      are fine because those are declared on `:root`, not on `.admin-theme`.
 *
 * Errors are given a longer life than successes: a failure the operator has to
 * read and act on should not disappear at the same speed as "Saved".
 */
export function AdminToaster() {
  return (
    <Toaster
      theme="dark"
      position="top-right"
      closeButton
      richColors
      toastOptions={{
        classNames: {
          toast:
            'group toast font-admin group-[.toaster]:border-white/[0.08] group-[.toaster]:shadow-panel',
          description: 'group-[.toast]:text-panel-muted',
          actionButton: 'group-[.toast]:bg-panel-accent group-[.toast]:text-panel-bg',
          cancelButton: 'group-[.toast]:bg-panel-alt group-[.toast]:text-panel-muted',
        },
      }}
    />
  );
}
