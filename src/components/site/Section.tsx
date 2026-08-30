import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The circular back control, shared by the channel page and the video page.
 *
 * It began as an inline block on the channel page; the video page had a plain
 * text link doing the same job, so the two looked nothing alike. Extracted here
 * rather than copied so they cannot drift apart again.
 *
 * `label` is optional: the channel page renders it bare, sitting in a header row
 * where the destination is obvious, while the video page names the channel it
 * returns to. Either way the control has an accessible name.
 *
 * A real link, not `history.back()`: both pages are linkable and are often
 * opened cold — from a shared link or a search result — where there is no
 * history to go back to.
 */
export function BackButton({
  href,
  label,
  ariaLabel,
  className,
}: {
  href: string;
  label?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label ? undefined : ariaLabel}
      className={cn('group inline-flex items-center gap-3', className)}
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-pill border border-white/10 text-site-muted transition-colors group-hover:border-white/30 group-hover:text-site-fg"
      >
        <ArrowLeft className="size-4" />
      </span>

      {label ? (
        <span className="text-[0.9375rem] font-medium text-site-muted transition-colors group-hover:text-site-fg">
          {label}
        </span>
      ) : null}
    </Link>
  );
}

/** Section heading: uppercase label, H2, and an optional lead paragraph. */
export function SectionHead({
  label,
  heading,
  lead,
  action,
  align = 'left',
}: {
  label: string;
  heading: string;
  lead?: string;
  action?: ReactNode;
  align?: 'left' | 'between';
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-6',
        align === 'between' && 'lg:flex-row lg:items-end lg:justify-between lg:gap-16',
      )}
    >
      <div className={cn(align === 'between' && 'lg:max-w-xl')}>
        <p className="t-label">{label}</p>
        <h2 className="t-h2 mt-3">{heading}</h2>
        {lead ? <p className="mt-4 max-w-xl text-body leading-[1.7] text-site-muted">{lead}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Text link with an arrow that steps on hover. */
export function ArrowLink({
  className,
  children,
  direction = 'forward',
  ...props
}: ComponentProps<typeof Link> & { direction?: 'forward' | 'back' }) {
  const back = direction === 'back';

  return (
    <Link
      className={cn(
        'group inline-flex items-center gap-2 text-[0.9375rem] font-medium text-site-accent',
        back && 'flex-row-reverse',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'transition-transform duration-200',
          back ? 'group-hover:-translate-x-1' : 'group-hover:translate-x-1',
        )}
      >
        {back ? '←' : '→'}
      </span>
    </Link>
  );
}

type ButtonTone = 'primary' | 'secondary' | 'ghost';

const tones: Record<ButtonTone, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
};

export function SiteButton({
  tone = 'primary',
  className,
  ...props
}: ComponentProps<typeof Link> & { tone?: ButtonTone }) {
  return <Link className={cn(tones[tone], className)} {...props} />;
}

/**
 * The link out of a partial listing of one channel's videos.
 *
 * Shared by the channel board and the video detail page, which deliberately draw
 * the same 3-across grid — the button is part of that sameness, and two
 * hand-written copies would drift on wording or padding.
 *
 * Lives here rather than in `ChannelBoard`, which is a client component:
 * importing it from there would pull a client boundary into the
 * server-rendered video page for the sake of a static link.
 *
 * `slug` accepts a handle or an id; the channel route resolves both, which is
 * what lets callers pass `handle ?? id` for a channel that arrived without one.
 */
export function SeeMoreFromChannel({ slug, name }: { slug: string; name: string }) {
  return (
    <div className="mt-10 flex justify-center">
      <Link href={`/creations/${slug}`} className="btn-secondary px-7 text-sm">
        See more from {name}
      </Link>
    </div>
  );
}

/** Empty state that still reads as designed, not broken. */
export function EmptyPanel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-card border border-dashed border-white/10 bg-site-surface/60 px-6 py-16 text-center">
      <p className="t-h3 text-site-fg">{title}</p>
      {description ? (
        <p className="mx-auto mt-2 max-w-sm text-body text-site-muted">{description}</p>
      ) : null}
    </div>
  );
}
