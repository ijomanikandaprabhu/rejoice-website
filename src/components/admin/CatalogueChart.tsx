'use client';

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';

/**
 * Uploads per year — neutral bars with a single accent peak.
 *
 * The accent marks the busiest year automatically rather than being assigned by
 * hand, so the highlight always means the same thing. Everything else stays
 * grey, which is what keeps the lime readable as emphasis.
 */

export type YearPoint = { year: string; total: number; visible: number };

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: YearPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;

  return (
    <div className="rounded-input border border-white/10 bg-panel-alt px-3 py-2 shadow-panel">
      <p className="text-xs font-semibold text-panel-fg">{p.year}</p>
      <p className="mt-1 text-xs text-panel-muted">
        <span className="tabular-nums text-panel-fg">{p.total.toLocaleString()}</span> uploaded
      </p>
      <p className="text-xs text-panel-muted">
        <span className="tabular-nums text-panel-accent">{p.visible.toLocaleString()}</span> public
      </p>
    </div>
  );
}

export function CatalogueChart({ data }: { data: YearPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="grid h-[220px] place-items-center text-sm text-panel-muted">
        Connect a channel to see the catalogue here.
      </div>
    );
  }

  const peak = data.reduce((max, d) => (d.total > max ? d.total : max), 0);

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }} barCategoryGap="28%">
          <XAxis
            dataKey="year"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#9A9A9A', fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
          <Bar dataKey="total" radius={[6, 6, 6, 6]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.year} fill={d.total === peak ? '#D6FF3F' : '#2E2E2F'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
