'use client';

import { Bar, BarChart, Cell, XAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { MonthRevenue } from '@/services/youtube/analyticsService';

/**
 * Estimated revenue by month.
 *
 * Bars rather than a line: the buckets are discrete months, and this reads as
 * twelve comparable amounts rather than a continuous quantity. It deliberately
 * mirrors CatalogueChart — neutral bars with the peak in accent — so the two
 * charts on this dashboard share one visual grammar.
 *
 * The current month is always partial and always an estimate; the panel
 * caption says so, because a short final bar otherwise reads as a collapse.
 */

const config = {
  revenue: { label: 'Estimated revenue', color: '#D6FF3F' },
} satisfies ChartConfig;

function monthLabel(ym: string) {
  // The API returns "2026-08".
  const [year, month] = ym.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString('en-GB', { month: 'short' });
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

  return (
    <ChartContainer config={config} className="aspect-auto h-[200px] w-full">
      <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="28%">
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#9A9A9A', fontSize: 11 }}
          tickFormatter={monthLabel}
          interval="preserveStartEnd"
        />
        <ChartTooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          content={
            <ChartTooltipContent
              labelFormatter={(value) => String(value)}
              formatter={(value) => Number(value).toFixed(2)}
            />
          }
        />
        <Bar dataKey="revenue" radius={[6, 6, 6, 6]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.month} fill={d.revenue === peak ? '#D6FF3F' : '#2E2E2F'} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
