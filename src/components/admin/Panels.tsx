import type { LucideIcon } from 'lucide-react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Admin panel primitives.
 *
 * The lime accent is deliberately rationed: primary buttons, one highlighted
 * row, and the single peak bar in a chart. Everything else is neutral, so the
 * accent always means "look here".
 */

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        // `min-w-0`: panels are grid items, and a grid item's automatic minimum
        // size is its content, so a long video title inside one would widen the
        // whole track past the viewport and scroll the page sideways.
        'min-w-0 rounded-panel border border-white/[0.06] bg-panel p-5 shadow-panel',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-[0.9375rem] font-semibold text-panel-fg">{title}</h2>
        {caption ? <p className="mt-1 text-sm text-panel-muted">{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** Stat panel: label row with icon, big number, trend, caption. */
export function StatPanel({
  label,
  value,
  icon: Icon,
  trend,
  caption,
  href,
  accent = false,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /**
   * `neutral` renders the figure with no arrow. Some panels show a SHARE rather
   * than a movement, and drawing those with an arrow claimed a direction the
   * number does not carry.
   */
  trend?: { direction: 'up' | 'down' | 'neutral'; text: string };
  caption?: string;
  href?: string;
  accent?: boolean;
}) {
  const Trend = trend?.direction === 'down' ? TrendingDown : TrendingUp;
  const showArrow = trend !== undefined && trend.direction !== 'neutral';

  const body = (
    <div
      className={cn(
        'h-full rounded-panel border p-5 transition-colors',
        accent
          ? 'border-transparent bg-panel-accent text-panel-bg'
          : 'border-white/[0.06] bg-panel shadow-panel hover:border-white/10',
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', accent ? 'text-panel-bg/70' : 'text-panel-muted')} />
        <span
          className={cn(
            'text-xs font-medium uppercase tracking-[0.06em]',
            accent ? 'text-panel-bg/70' : 'text-panel-muted',
          )}
        >
          {label}
        </span>
      </div>

      <p className="mt-3 text-[2rem] font-bold leading-none tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
        {trend ? (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium',
              accent
                ? 'bg-panel-bg/15 text-panel-bg'
                : trend.direction === 'up'
                  ? 'bg-panel-accent/15 text-panel-accent'
                  : trend.direction === 'down'
                    ? 'bg-panel-negative/15 text-panel-negative'
                    : 'bg-white/[0.06] text-panel-muted',
            )}
          >
            {showArrow ? <Trend className="size-3" /> : null}
            {trend.text}
          </span>
        ) : null}
        {caption ? (
          <span className={cn('text-xs', accent ? 'text-panel-bg/70' : 'text-panel-muted')}>
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/**
 * List row: icon + name/subtitle on the left, value/status on the right.
 * At most one row per list should set `highlighted`.
 */
export function ListRow({
  icon,
  name,
  subtitle,
  value,
  status,
  href,
  highlighted = false,
}: {
  icon?: ReactNode;
  name: string;
  subtitle?: string;
  value?: string;
  status?: ReactNode;
  href?: string;
  highlighted?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-sm2 px-3 py-3 transition-colors',
        highlighted
          ? 'bg-panel-accent text-panel-bg'
          : 'hover:bg-white/[0.04]',
      )}
    >
      {icon ? (
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-[10px]',
            highlighted ? 'bg-panel-bg/15 text-panel-bg' : 'bg-panel-alt text-panel-muted',
          )}
        >
          {icon}
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="line-clamp-1 block text-sm font-medium">{name}</span>
        {subtitle ? (
          <span
            className={cn(
              'mt-0.5 line-clamp-1 block text-xs',
              highlighted ? 'text-panel-bg/70' : 'text-panel-muted',
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        {value ? <span className="text-sm font-semibold tabular-nums">{value}</span> : null}
        {status}
      </span>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

type Tone = 'neutral' | 'accent' | 'negative';

const tones: Record<Tone, string> = {
  neutral: 'bg-panel-alt text-panel-muted',
  accent: 'bg-panel-accent/15 text-panel-accent',
  negative: 'bg-panel-negative/15 text-panel-negative',
};

export function Pill({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
