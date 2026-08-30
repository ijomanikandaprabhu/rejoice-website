import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The Videos / Shorts split at the top of the content table.
 *
 * Its own control on the table rather than another entry in the Filter dropdown,
 * so the split is one click and readable at a glance. It composes with the
 * dropdown — "hidden Shorts" is `?type=shorts&filter=hidden` — and where the two
 * disagree the toggle wins; see `buildVideoListWhere`.
 */

export type VideoType = 'all' | 'videos' | 'shorts';

export function TypeTabs({
  current,
  counts,
  buildHref,
}: {
  current: VideoType;
  counts: Record<VideoType, number>;
  buildHref: (type: VideoType) => string;
}) {
  const tabs: Array<{ value: VideoType; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'videos', label: 'Videos' },
    { value: 'shorts', label: 'Shorts' },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="group"
      aria-label="Filter by video type"
    >
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <Link
            key={tab.value}
            href={buildHref(tab.value)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
              active
                ? 'bg-primary font-medium text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {tab.label}
            <span className={cn('tabular-nums', active ? 'opacity-80' : 'opacity-60')}>
              {counts[tab.value].toLocaleString()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
