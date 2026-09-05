import type { MonthRevenue } from '@/services/youtube/analyticsService';
import { cn, currentYearMonth, formatMoney } from '@/lib/utils';

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
 * THE ACCENT MARKS THE CURRENT MONTH, not the best one. It marked the peak at
 * first, which answered a question nobody was asking — the tallest bar is
 * already the tallest bar, and highlighting it drew the eye to March while the
 * month actually being earned sat unmarked at the bottom. The row worth finding
 * on a dashboard is the one still running.
 *
 * That row is short by definition: it is a few days of a month against twelve
 * whole ones, which is why the panel's caption says the figures settle after
 * the month ends. Marked, it reads as "in progress"; unmarked it read as a
 * collapse.
 */

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

  /* Still needed — the bars are scaled against the biggest month even though
     it is no longer the one highlighted. */
  const peak = data.reduce((max, d) => (d.revenue > max ? d.revenue : max), 0);
  const total = data.reduce((sum, d) => sum + d.revenue, 0);

  /*
   * The row to mark. Normally the last one, but matched by name rather than by
   * position: if the report is a few days stale the last row is LAST MONTH, and
   * highlighting it as "current" would be a plain lie. When nothing matches,
   * nothing is highlighted, which is the honest state.
   */
  const thisMonth = currentYearMonth();

  return (
    <div>
      <ul className="grid gap-2.5">
        {data.map((row) => {
          const share = peak > 0 ? (row.revenue / peak) * 100 : 0;
          const current = row.month === thisMonth;

          return (
            <li key={row.month} className="flex items-center gap-3">
              <span
                className={cn(
                  'w-14 shrink-0 text-xs tabular-nums',
                  current ? 'text-panel-fg' : 'text-panel-muted',
                )}
              >
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
                    current ? 'bg-panel-accent' : 'bg-[#3A3A3C]',
                  )}
                  style={{ width: `${row.revenue > 0 ? Math.max(share, 2) : 0}%` }}
                />
              </span>

              <span
                className={cn(
                  'w-20 shrink-0 text-right text-xs tabular-nums',
                  current ? 'font-semibold text-panel-accent' : 'text-panel-fg',
                )}
              >
                {formatMoney(row.revenue)}
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
        <span className="text-sm font-semibold tabular-nums text-panel-fg">{formatMoney(total)}</span>
      </div>
    </div>
  );
}
