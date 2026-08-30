import Link from 'next/link';

import { Badge } from '@/components/ui/badge';

/**
 * Saved filters into the catalogue.
 *
 * These four destinations used to live inside a panel styled as an AI chat box.
 * They are plain links and always were, so they are presented as plain links:
 * the sidebar routes to the PAGES, this routes to the QUERIES within them,
 * which is the part the sidebar cannot express.
 */

const FILTERS = [
  { label: 'Needs reviewing', href: '/admin/youtube-content?filter=hidden' },
  { label: 'Recently imported', href: '/admin/youtube-content?filter=recent' },
  { label: 'New enquiries', href: '/admin/enquiries?status=NEW' },
  { label: 'Public', href: '/admin/youtube-content?filter=visible' },
] as const;

export function QuickFilters() {
  return (
    <nav aria-label="Saved filters" className="flex flex-wrap items-center gap-2">
      {FILTERS.map((f) => (
        <Link key={f.href} href={f.href} className="rounded-pill">
          <Badge
            variant="outline"
            className="rounded-pill border-white/10 bg-panel-alt px-3.5 py-1.5 text-xs font-normal text-panel-muted transition-colors hover:border-panel-accent/40 hover:text-panel-fg"
          >
            {f.label}
          </Badge>
        </Link>
      ))}
    </nav>
  );
}
