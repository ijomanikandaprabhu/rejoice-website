import Link from 'next/link';

import { Pill } from '@/components/admin/Panels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChannelBreakdownRow } from '@/features/dashboard/queries';

/**
 * Per-channel totals.
 *
 * Rejoice runs more than one channel and every other figure on this dashboard
 * merges them, which hides the case that actually matters: one channel growing
 * while the other stalls.
 */

/**
 * A dash, never a zero, when a statistic was never learned — a hidden
 * subscriber count is not a count of nobody.
 *
 * Compact notation because these columns are narrow and a channel's lifetime
 * view count runs to eight digits; the full figure is in the title attribute
 * for anyone who wants it.
 */
function num(value: number | null) {
  if (value === null) return '—';
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  );
}

export function ChannelBreakdown({ channels }: { channels: ChannelBreakdownRow[] }) {
  if (channels.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-panel-muted">
        No channels connected yet.
      </p>
    );
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-panel-muted">Channel</TableHead>
            {/*
              Fixed widths on the numeric columns. Without them the table's auto
              layout gave the three short headings as much width as they asked
              for and squeezed the channel name to one word per line.
            */}
            <TableHead className="w-[84px] text-right text-panel-muted">Subs</TableHead>
            <TableHead className="w-[84px] text-right text-panel-muted">Views</TableHead>
            <TableHead className="w-[92px] text-right text-panel-muted">Public</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {channels.map((channel) => (
            <TableRow key={channel.id} className="border-white/[0.06] hover:bg-white/[0.04]">
              <TableCell>
                <Link href="/admin/youtube-channels" className="flex items-center gap-2.5">
                  <Avatar className="size-8 shrink-0">
                    {channel.thumbnail ? (
                      <AvatarImage src={channel.thumbnail} alt="" />
                    ) : null}
                    <AvatarFallback className="bg-panel-alt text-xs text-panel-muted">
                      {channel.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="line-clamp-1 block text-sm font-medium text-panel-fg">
                      {channel.name}
                    </span>
                    {!channel.isActive ? (
                      <span className="mt-0.5 block text-xs text-panel-negative">
                        Paused — its videos are hidden from the site
                      </span>
                    ) : null}
                  </span>
                </Link>
              </TableCell>
              <TableCell
                className="text-right text-sm tabular-nums text-panel-fg"
                title={channel.subscribers?.toLocaleString()}
              >
                {num(channel.subscribers)}
              </TableCell>
              <TableCell
                className="text-right text-sm tabular-nums text-panel-fg"
                title={channel.views?.toLocaleString()}
              >
                {num(channel.views)}
              </TableCell>
              <TableCell className="text-right">
                <Pill tone={channel.isActive ? 'accent' : 'neutral'}>
                  {channel.visible.toLocaleString()} / {channel.videos.toLocaleString()}
                </Pill>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
