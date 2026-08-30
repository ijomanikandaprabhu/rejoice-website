import { ArrowRight, Check } from 'lucide-react';
import Link from 'next/link';

import type { AttentionItem } from '@/features/dashboard/queries';

/**
 * The work queue.
 *
 * Every row is a backlog with a link that lands on exactly those records, so
 * the panel is a list of things to DO rather than another set of statistics.
 * Rows with a count of zero are dropped rather than shown as "0", and when
 * every row is empty the panel says so plainly — an empty queue is good news
 * and should read like it.
 */

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  const outstanding = items.filter((item) => item.count > 0);

  if (outstanding.length === 0) {
    return (
      <div className="flex items-center gap-3 py-6 text-sm text-panel-muted">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-panel-accent/15 text-panel-accent">
          <Check className="size-4" />
        </span>
        Nothing needs attention.
      </div>
    );
  }

  return (
    <ul className="-mx-1">
      {outstanding.map((item) => (
        <li key={item.href + item.label}>
          <Link
            href={item.href}
            className="flex items-center gap-3 rounded-sm2 px-3 py-3 transition-colors hover:bg-white/[0.04]"
          >
            <span className="min-w-0 flex-1 text-sm text-panel-fg">{item.label}</span>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-panel-fg">
              {item.count.toLocaleString()}
            </span>
            <ArrowRight className="size-4 shrink-0 text-panel-muted" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
