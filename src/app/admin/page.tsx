import { Clock, Eye, EyeOff, Inbox, Radio, Users, Video, Wallet } from 'lucide-react';
import Link from 'next/link';

import { CatalogueChart } from '@/components/admin/CatalogueChart';
import { ChannelBreakdown } from '@/components/admin/ChannelBreakdown';
import { GrowthChart } from '@/components/admin/GrowthChart';
import { NeedsAttention } from '@/components/admin/NeedsAttention';
import { ListRow, Panel, PanelHeader, Pill, StatPanel } from '@/components/admin/Panels';
import { QuickFilters } from '@/components/admin/QuickFilters';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { TopVideos } from '@/components/admin/TopVideos';
import { TrafficSources } from '@/components/admin/TrafficSources';
import { isYouTubeConfigured, youtubeConfig } from '@/config/youtube.config';
import {
  getAudienceTotals,
  getCatalogueByYear,
  getCatalogueTotals,
  getChannelBreakdown,
  getGrowthSeries,
  getNeedsAttention,
  getTopVideos,
} from '@/features/dashboard/queries';
import { prisma } from '@/lib/db/prisma';
import { formatDateTime } from '@/lib/utils';
import { getAnalytics } from '@/services/youtube/analyticsService';
import { getLastSyncRecord } from '@/services/youtube/videoSyncService';

export const dynamic = 'force-dynamic';

/** Big numbers are unreadable in full; the exact figure lives in the caption. */
function compact(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export default async function AdminDashboard() {
  const [
    totals,
    audience,
    byYear,
    growth,
    channels,
    topVideos,
    attention,
    lastSync,
    analytics,
    recent,
  ] = await Promise.all([
      getCatalogueTotals(),
      getAudienceTotals(),
      getCatalogueByYear(),
      getGrowthSeries(),
      getChannelBreakdown(),
      getTopVideos(),
      getNeedsAttention(),
      getLastSyncRecord(),
      getAnalytics(),
      prisma.youTubeVideo.findMany({
        orderBy: { importedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          youtubeTitle: true,
          displayTitle: true,
          isVisible: true,
          channel: { select: { name: true } },
        },
      }),
    ]);

  const busiest = byYear.reduce<(typeof byYear)[number] | null>(
    (max, d) => (!max || d.total > max.total ? d : max),
    null,
  );

  const report = analytics.status === 'ready' ? analytics.report : null;
  // Captured alongside `report` so the JSX does not have to re-narrow the
  // union every time it needs one of the two.
  const analyticsStale = analytics.status === 'ready' && analytics.stale;

  /*
   * Last 28 days from the daily analytics rows.
   *
   * Summed here rather than asked of the API as a separate report: the daily
   * series is already fetched, and one fewer call keeps the dashboard inside
   * the Analytics API's quota.
   */
  const recent28 = report?.daily.slice(-28) ?? [];
  const watchHours = recent28.reduce((n, d) => n + d.minutesWatched, 0) / 60;

  /*
   * The month in progress. Revenue lags two to three days and the current
   * month is always partial, which the caption says outright — a half-month
   * figure presented plainly would read as a collapse in earnings.
   */
  const thisMonth = report?.revenueByMonth?.at(-1) ?? null;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-[-0.01em]">Dashboard</h1>
          <p className="mt-1 text-sm text-panel-muted">An overview of the Rejoice website.</p>
        </div>
        <Pill tone={isYouTubeConfigured() ? 'accent' : 'negative'}>
          <Radio className="size-3" />
          {isYouTubeConfigured() ? 'Sync on' : 'API key missing'}
        </Pill>
      </div>

      {/*
        Stat row — audience first, catalogue plumbing second.
        The old row spent all four cards on our own database (channels,
        imported, visible, enquiries); three of those encoded two facts and one
        was the constant "2". These lead with what the audience is doing, and
        keep the accent fill on exactly one card.
      */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatPanel
          label="Total views"
          value={audience.views === null ? '—' : compact(audience.views)}
          icon={Eye}
          trend={
            audience.viewsGained !== null
              ? {
                  direction: audience.viewsGained >= 0 ? 'up' : 'down',
                  text: `${audience.viewsGained >= 0 ? '+' : ''}${compact(audience.viewsGained)}`,
                }
              : undefined
          }
          caption={
            audience.views === null
              ? 'Awaiting the next sync'
              : audience.windowDays !== null
                ? `in the last ${audience.windowDays} days`
                : `${audience.views.toLocaleString()} lifetime`
          }
          accent
        />
        <StatPanel
          label="Subscribers"
          value={audience.subscribers === null ? '—' : compact(audience.subscribers)}
          icon={Users}
          trend={
            audience.subscribersGained !== null
              ? {
                  direction: audience.subscribersGained >= 0 ? 'up' : 'down',
                  text: `${audience.subscribersGained >= 0 ? '+' : ''}${audience.subscribersGained.toLocaleString()}`,
                }
              : undefined
          }
          caption={
            audience.windowDays !== null
              ? `in the last ${audience.windowDays} days`
              : 'Growth needs a day of history'
          }
          href="/admin/youtube-channels"
        />
        <StatPanel
          label="On the website"
          value={totals.visibleVideos}
          icon={Video}
          trend={{ direction: 'neutral', text: `${totals.publishedShare}% of the catalogue` }}
          caption={`of ${totals.totalVideos.toLocaleString()} imported`}
          href="/admin/youtube-content?filter=visible"
        />
        <StatPanel
          label="New enquiries"
          value={totals.newEnquiries}
          icon={Inbox}
          caption="Awaiting reply"
          href="/admin/enquiries?status=NEW"
        />
      </div>

      {/*
        Analytics cards are a SECOND row rather than being mixed into the first.
        They depend on an OAuth connection the first row does not need, so when
        analytics is unavailable a whole row disappears cleanly instead of
        leaving dashes scattered through the headline figures.
      */}
      {report ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatPanel
            label="Watch time"
            value={`${Math.round(watchHours).toLocaleString()} h`}
            icon={Clock}
            caption="in the last 28 days"
          />
          <StatPanel
            label="Estimated revenue"
            value={
              report.revenueByMonth === null
                ? '—'
                : thisMonth
                  ? thisMonth.revenue.toFixed(2)
                  : '0.00'
            }
            icon={Wallet}
            caption={
              report.revenueByMonth === null
                ? 'Earnings permission not granted'
                : 'This month so far — an estimate'
            }
          />
          <StatPanel
            label="Views"
            value={compact(recent28.reduce((n, d) => n + d.views, 0))}
            icon={Eye}
            caption="in the last 28 days"
          />
          <StatPanel
            label="Net subscribers"
            value={(() => {
              const net = (report.subscribers ?? [])
                .slice(-28)
                .reduce((n, d) => n + d.gained - d.lost, 0);
              return `${net >= 0 ? '+' : ''}${net.toLocaleString()}`;
            })()}
            icon={Users}
            caption="gained minus lost, 28 days"
          />
        </div>
      ) : null}

      <QuickFilters />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Views over time"
            caption="Total views across every connected channel, recorded once a day."
          />
          <GrowthChart data={growth} />
        </Panel>

        <Panel>
          <PanelHeader title="Needs attention" caption="Everything waiting on a decision." />
          <NeedsAttention items={attention} />
        </Panel>
      </div>

      {report ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel className="lg:col-span-2">
            <PanelHeader
              title="Estimated revenue"
              caption={
                report.revenueByMonth === null
                  ? 'Reconnect the Google account and allow the earnings permission to see this.'
                  : `Monthly estimates from YouTube. Figures settle a few days after each month ends.${
                      analyticsStale ? ' Showing the last successful reading.' : ''
                    }`
              }
            />
            {report.revenueByMonth === null ? (
              <div className="grid h-[200px] place-items-center px-6 text-center text-sm text-panel-muted">
                Revenue needs the earnings permission, and a channel in the YouTube Partner
                Programme.
              </div>
            ) : (
              <RevenueChart data={report.revenueByMonth} />
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Where views come from" caption="Last 90 days." />
            <TrafficSources sources={report.traffic} />
          </Panel>
        </div>
      ) : analytics.status === 'unavailable' && analytics.reason !== 'not-configured' ? (
        <Panel>
          <PanelHeader
            title="Revenue and watch time"
            caption="These come from the YouTube Analytics API, which needs its own connection."
          />
          <p className="pb-2 text-sm text-panel-muted">
            {analytics.message}{' '}
            <Link href="/admin/settings#youtube-analytics" className="text-panel-accent underline">
              Open settings
            </Link>
          </p>
        </Panel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Most watched"
            caption="A popular video sitting hidden is usually an oversight."
            action={
              <Link
                href="/admin/youtube-content"
                className="text-sm text-panel-muted transition-colors hover:text-panel-fg"
              >
                View all
              </Link>
            }
          />
          <TopVideos videos={topVideos} />
        </Panel>

        <Panel>
          <PanelHeader title="Channels" caption="How each one contributes." />
          <ChannelBreakdown channels={channels} />

          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4 text-sm">
            <div>
              <dt className="text-panel-muted">Long-form</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {totals.longForm.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-panel-muted">Shorts</dt>
              <dd className="mt-1 font-semibold tabular-nums">{totals.shorts.toLocaleString()}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <PanelHeader
            title="Catalogue by year"
            caption={
              busiest
                ? `Busiest year was ${busiest.year} with ${busiest.total.toLocaleString()} uploads.`
                : 'Every imported video by its YouTube publish date.'
            }
          />
          <CatalogueChart data={byYear} />
        </Panel>

        <Panel>
          <PanelHeader title="Synchronization" caption="How videos reach this website." />

          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <dt className="text-panel-muted">Schedule</dt>
              <dd className="text-right font-medium">{youtubeConfig.scheduleLabel}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <dt className="text-panel-muted">Last run</dt>
              <dd className="text-right font-medium tabular-nums">
                {formatDateTime(lastSync?.at)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-3">
              <dt className="text-panel-muted">Result</dt>
              <dd>
                {!lastSync ? (
                  <span className="text-panel-muted">No runs yet</span>
                ) : lastSync.ok ? (
                  <Pill tone="accent">{lastSync.imported} imported</Pill>
                ) : (
                  <Pill tone="negative">{lastSync.failures.length} failed</Pill>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-panel-muted">Channels</dt>
              <dd className="text-right font-medium tabular-nums">
                {totals.channels === totals.activeChannels
                  ? `${totals.channels} connected`
                  : `${totals.activeChannels} active, ${totals.channels - totals.activeChannels} paused`}
              </dd>
            </div>
          </dl>

          {lastSync?.failures.length ? (
            <ul className="mt-4 space-y-1 border-t border-white/[0.06] pt-3 text-xs text-panel-negative">
              {lastSync.failures.map((f) => (
                <li key={f.channel}>
                  <strong>{f.channel}:</strong> {f.error}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          title="Recently imported"
          caption="New uploads arrive hidden and wait for you to publish them."
          action={
            <Link
              href="/admin/youtube-content"
              className="text-sm text-panel-muted transition-colors hover:text-panel-fg"
            >
              View all
            </Link>
          }
        />

        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-panel-muted">Nothing imported yet.</p>
        ) : (
          <ul className="-mx-1 sm:grid sm:grid-cols-2 sm:gap-x-4">
            {recent.map((video, i) => (
              <li key={video.id}>
                <ListRow
                  href={`/admin/youtube-content/${video.id}`}
                  icon={<Video className="size-4" />}
                  name={video.displayTitle ?? video.youtubeTitle}
                  subtitle={video.channel.name}
                  /* Newest import is the one row carrying the accent. */
                  highlighted={i === 0}
                  status={
                    i === 0 ? (
                      <span className="rounded-pill bg-panel-bg/15 px-2.5 py-1 text-xs font-medium">
                        {video.isVisible ? 'Showing' : 'Hidden'}
                      </span>
                    ) : (
                      <Pill tone="neutral">
                        {video.isVisible ? (
                          <Eye className="size-3" />
                        ) : (
                          <EyeOff className="size-3" />
                        )}
                        {video.isVisible ? 'Showing' : 'Hidden'}
                      </Pill>
                    )
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
