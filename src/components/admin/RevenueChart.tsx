import type { MonthRevenue } from '@/services/youtube/analyticsService';
import { cn } from '@/lib/utils';

/**
 * Estimated revenue by month, as rows rather than upright bars.
 *
 * It WAS a column chart, and the figures were only readable on hover. That is
 * the wrong trade for money: twelve grey columns answered "which month was
 * biggest" and nothing else, and on a touch screen there is no hover at all, so
 * the amounts were effectively unreachable. Rows put the number beside the bar
 * and every figure is legible at rest.
 *
 * Rows also fix a problem columns have with small amounts. A month earning a
 * twentieth of the peak is a two-pixel stub, indistinguishable from a month
 * that earned nothing — here the bar may be a stub but the number next to it
 * still says $0.42.
 *
 * No chart library. This is twelve divs and a percentage width; `recharts` was
 * being loaded into the browser to draw rectangles, and it still is for the
 * charts that genuinely need axes and interpolation. Dropping it here also
 * makes this a SERVER component — no `use client`, no JavaScript shipped.
 *
 * The accent marks the best month automatically, the same rationing
 * `CatalogueChart` and `TrafficSources` use, so lime keeps meaning "look here".
 *
 * The current month is always partial; the panel's caption says so, because a
 * short final row otherwise reads as a collapse.
 */

/**
 * CURRENCY IS AN ASSUMPTION, and a deliberate one.
 *
 * The YouTube Analytics API reports `estimatedRevenue` in the channel's own
 * payment currency and does NOT name it in the response — which is why
 * `AnalyticsReport.currency` is null. Rejoice asked for dollars, so dollars is
 * what this shows. If the AdSense account is ever paid in another currency,
 * this symbol is the one thing that has to change.
 */
const CURRENCY = '$';

const money = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function format(amount: number) {
  return `${CURRENCY}${money.format(amount)}`;
}

function monthLabel(ym: string) {
  // The API returns "2026-08".
  const [year, month] = ym.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

export function RevenueChart({ data }: { data: MonthRevenue[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-[200px] place-items-center px-6 text-center text-sm text-panel-muted">
        No revenue reported for this period.
      </div>
    );
  }

  const peak = data.reduce((max, d) => (d.revenue > max ? d.revenue : max), 0);
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div>
      <ul className="grid gap-2.5">
        {data.map((row) => {
          const share = peak > 0 ? (row.revenue / peak) * 100 : 0;
          const best = row.revenue === peak && peak > 0;

          return (
            <li key={row.month} className="flex items-center gap-3">
              <span className="w-14 shrink-0 text-xs tabular-nums text-panel-muted">
                {monthLabel(row.month)}
              </span>

              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-white/[0.06]">
                {/*
                 * A floor of 2%, so a month that earned something always draws
                 * something. Without it the smallest months rounded to a
                 * hairline and read as zero — which is the exact confusion the
                 * number to the right exists to settle.
                 */}
                <span
                  className={cn(
                    'block h-full rounded-pill',
                    best ? 'bg-panel-accent' : 'bg-[#3A3A3C]',
                  )}
                  style={{ width: `${row.revenue > 0 ? Math.max(share, 2) : 0}%` }}
                />
              </span>

              <span
                className={cn(
                  'w-20 shrink-0 text-right text-xs tabular-nums',
                  best ? 'font-semibold text-panel-accent' : 'text-panel-fg',
                )}
              >
                {format(row.revenue)}
              </span>
            </li>
          );
        })}
      </ul>

      {/* The figure nobody could work out from the old chart at all. */}
      <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs text-panel-muted">
          Total over {data.length} month{data.length === 1 ? '' : 's'}
        </span>
        <span className="text-sm font-semibold tabular-nums text-panel-fg">{format(total)}</span>
      </div>
    </div>
  );
}
