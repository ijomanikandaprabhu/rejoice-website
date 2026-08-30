import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

import { Pill } from '@/components/admin/Panels';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TopVideoRow } from '@/features/dashboard/queries';

/**
 * Most-watched videos.
 *
 * A table rather than a bar chart on purpose: the titles are long and often
 * Tamil, and a horizontal bar chart would either clip them or spend most of its
 * width on labels. The view count is the only quantity here and it reads fine
 * as a number.
 *
 * The visibility badge is the point of the panel — a video with a million views
 * sitting hidden is the single most useful thing this dashboard can surface.
 */

export function TopVideos({ videos }: { videos: TopVideoRow[] }) {
  if (videos.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-panel-muted">
        View counts appear after the next synchronization.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-panel-muted">Video</TableHead>
            {/*
              Fixed widths on the two short columns so the title column takes
              everything left over. Without them the table's auto layout split
              the width evenly and wrapped these long titles to five lines each.
            */}
            <TableHead className="w-[110px] text-right text-panel-muted">Views</TableHead>
            <TableHead className="w-[104px] text-right text-panel-muted">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow key={video.id} className="border-white/[0.06] hover:bg-white/[0.04]">
              {/* `max-w-0` makes the cell yield to the fixed columns, which is
                  what lets `line-clamp` see a real width to clamp against. */}
              <TableCell className="max-w-0">
                <Link href={`/admin/youtube-content/${video.id}`} className="block">
                  <span
                    className="line-clamp-1 block text-sm font-medium text-panel-fg"
                    title={video.title}
                  >
                    {video.title}
                  </span>
                  <span className="mt-0.5 line-clamp-1 block text-xs text-panel-muted">
                    {video.channelName}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right text-sm font-semibold tabular-nums text-panel-fg">
                {video.views.toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Pill tone={video.isVisible ? 'neutral' : 'negative'}>
                  {video.isVisible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                  {video.isVisible ? 'Showing' : 'Hidden'}
                </Pill>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
