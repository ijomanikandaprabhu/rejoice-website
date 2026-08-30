'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import type { GrowthPoint } from '@/features/dashboard/queries';

/**
 * Channel views over time.
 *
 * An area rather than a bar because the data is continuous daily readings, and
 * an area reads as accumulated volume. The series is CUMULATIVE lifetime views,
 * so the line only ever climbs — the shape of the climb is the signal.
 *
 * Built on the shadcn `ChartContainer` so tooltip, legend, and theming come
 * from the same place as every other chart in the admin.
 */

const config = {
  // Literal hex, matching CatalogueChart — the admin charts do not go through
  // the shadcn CSS-variable palette, they use the `panel` scale directly.
  views: { label: 'Total views', color: '#D6FF3F' },
} satisfies ChartConfig;

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function compact(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function GrowthChart({ data }: { data: GrowthPoint[] }) {
  /*
   * Two distinct empty states, because they mean different things to the
   * person reading them. Nothing at all means the daily snapshot has never
   * run; a single point means it has run once and there is simply no second
   * reading to draw a line between yet. Drawing either as a flat line at zero
   * would state a fact we do not have.
   */
  if (data.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center px-6 text-center text-sm text-panel-muted">
        Growth history starts building after the first scheduled sync.
      </div>
    );
  }

  if (data.length === 1) {
    return (
      <div className="grid h-[220px] place-items-center px-6 text-center text-sm text-panel-muted">
        One day recorded so far — the trend appears once there are two.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="growth-views" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-views)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-views)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
          tick={{ fill: '#9A9A9A', fontSize: 11 }}
          tickFormatter={formatDay}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={48}
          tick={{ fill: '#9A9A9A', fontSize: 11 }}
          tickFormatter={compact}
          /*
           * Cumulative totals start far from zero, and anchoring the axis at
           * zero would flatten a month of real growth into a straight line.
           */
          domain={['dataMin', 'dataMax']}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) => formatDay(String(value))}
              formatter={(value) => Number(value).toLocaleString()}
            />
          }
        />
        <Area
          dataKey="views"
          type="monotone"
          stroke="var(--color-views)"
          strokeWidth={2}
          fill="url(#growth-views)"
        />
      </AreaChart>
    </ChartContainer>
  );
}
