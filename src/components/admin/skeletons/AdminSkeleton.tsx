import { cn } from '@/lib/utils';

/**
 * One placeholder bar. Every admin skeleton is built from these.
 *
 * Not `ui/skeleton.tsx`, which is `bg-primary/10`: inside `admin-theme`
 * `--primary` is the lime accent, so that shadcn default renders a green wash
 * that reads as a selected or active state rather than as absence. `white/[0.06]`
 * is the same value as the panel borders, so the placeholders sit in the surface
 * rather than on it.
 *
 * `animate-pulse` is a CSS animation, so the global `prefers-reduced-motion`
 * rule at the end of globals.css switches it off without anything being asked
 * of the caller — and the bar rests visible, not transparent.
 */
export function AdminSkeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-white/[0.06]', className)} />;
}
