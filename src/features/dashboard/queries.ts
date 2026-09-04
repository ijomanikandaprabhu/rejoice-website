import 'server-only';

import { publiclyVisible } from '@/features/youtube/queries';
import { prisma } from '@/lib/db/prisma';

/**
 * Read queries backing the admin dashboard.
 *
 * These live apart from `features/youtube/queries.ts` because that module
 * serves the PUBLIC site — its shapes are video cards for visitors. Everything
 * here is aggregate and administrator-only.
 *
 * Where a figure describes "what the public can see", it reuses the exported
 * `publiclyVisible` filter rather than testing `isVisible` directly. Pausing a
 * channel hides its videos from every public query, and a dashboard that
 * counted them anyway would print a number no visitor could reproduce.
 */

/**
 * Every query here takes an OPTIONAL channel id.
 *
 * Absent means "every channel", which is exactly what these did before the
 * dashboard gained a channel selector — so the combined view needs no special
 * casing, and the previous behaviour is the default rather than a mode.
 *
 * `New enquiries` is the deliberate exception: enquiries arrive from the
 * contact form and belong to no channel, so `getCatalogueTotals` reports the
 * same number whatever is selected. The dashboard labels that card accordingly
 * rather than letting it look filtered.
 */
export type ChannelScope = string | undefined;

/** `{ channelId }` when scoped, `{}` when not — spread into a Prisma `where`. */
function scope(channelId: ChannelScope) {
  return channelId ? { channelId } : {};
}

export type CatalogueTotals = {
  channels: number;
  activeChannels: number;
  totalVideos: number;
  visibleVideos: number;
  hiddenVideos: number;
  publishedShare: number;
  shorts: number;
  longForm: number;
  newEnquiries: number;
};

export async function getCatalogueTotals(channelId?: ChannelScope): Promise<CatalogueTotals> {
  const only = scope(channelId);

  const [channels, activeChannels, totalVideos, visibleVideos, shorts, newEnquiries] =
    await Promise.all([
      prisma.youTubeChannel.count(),
      prisma.youTubeChannel.count({ where: { isActive: true } }),
      prisma.youTubeVideo.count({ where: only }),
      prisma.youTubeVideo.count({ where: { AND: [publiclyVisible, only] } }),
      prisma.youTubeVideo.count({ where: { isShort: true, ...only } }),
      // NOT scoped: enquiries have no channel. See the note on ChannelScope.
      prisma.enquiry.count({ where: { status: 'NEW' } }),
    ]);

  return {
    channels,
    activeChannels,
    totalVideos,
    visibleVideos,
    hiddenVideos: totalVideos - visibleVideos,
    publishedShare: totalVideos > 0 ? Math.round((visibleVideos / totalVideos) * 100) : 0,
    shorts,
    longForm: totalVideos - shorts,
    newEnquiries,
  };
}

export type AudienceTotals = {
  /** Lifetime views across all connected channels, or null if never learned. */
  views: number | null;
  subscribers: number | null;
  /** Views gained since the oldest snapshot inside the window, if we have one. */
  viewsGained: number | null;
  subscribersGained: number | null;
  /** Days of history the deltas are actually based on — may be fewer than asked. */
  windowDays: number | null;
};

/**
 * Channel totals now, plus growth over the last `days`.
 *
 * The deltas come from `ChannelStatDaily`, which only starts filling once the
 * daily sync has run. Until there are two snapshots there is no delta to
 * report, so the gained figures are null rather than zero — the dashboard must
 * say "not enough history yet" instead of "no growth", which would be a claim
 * the data does not support.
 */
export async function getAudienceTotals(
  days = 28,
  channelId?: ChannelScope,
): Promise<AudienceTotals> {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true, ...(channelId ? { id: channelId } : {}) },
    select: { subscriberCount: true, channelViewCount: true },
  });

  const known = channels.filter((c) => c.channelViewCount !== null);
  const views = known.length > 0 ? known.reduce((n, c) => n + Number(c.channelViewCount), 0) : null;

  const knownSubs = channels.filter((c) => c.subscriberCount !== null);
  const subscribers =
    knownSubs.length > 0 ? knownSubs.reduce((n, c) => n + (c.subscriberCount ?? 0), 0) : null;

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  // The earliest snapshot inside the window, per channel, summed. Grouping in
  // the database keeps this to one round trip regardless of history length.
  /*
   * The channel filter is applied in BOTH halves of this query, not just the
   * outer one. Filtering only the outer half would still let every other
   * channel contribute its own earliest date as a join key, silently comparing
   * against the wrong rows.
   */
  const baseline = await prisma.$queryRaw<Array<{ views: bigint; subs: bigint; oldest: Date }>>`
    SELECT sum(s.views)       AS views,
           sum(s.subscribers) AS subs,
           min(s.date)        AS oldest
    FROM "ChannelStatDaily" s
    JOIN (
      SELECT "channelId", min(date) AS date
      FROM "ChannelStatDaily"
      WHERE date >= ${since}
        AND (${channelId ?? null}::text IS NULL OR "channelId" = ${channelId ?? null})
      GROUP BY "channelId"
    ) first ON first."channelId" = s."channelId" AND first.date = s.date
    WHERE (${channelId ?? null}::text IS NULL OR s."channelId" = ${channelId ?? null})
  `;

  const row = baseline[0];
  if (!row?.oldest || views === null || subscribers === null) {
    return { views, subscribers, viewsGained: null, subscribersGained: null, windowDays: null };
  }

  const windowDays = Math.max(
    0,
    Math.round((Date.now() - new Date(row.oldest).getTime()) / 86_400_000),
  );

  // A single snapshot taken today is a baseline of itself: the delta would be
  // a meaningless zero, so it is reported as "no history" instead.
  if (windowDays < 1) {
    return { views, subscribers, viewsGained: null, subscribersGained: null, windowDays: null };
  }

  return {
    views,
    subscribers,
    viewsGained: views - Number(row.views),
    subscribersGained: subscribers - Number(row.subs),
    windowDays,
  };
}

export type ChannelBreakdownRow = {
  id: string;
  name: string;
  thumbnail: string | null;
  isActive: boolean;
  videos: number;
  visible: number;
  views: number | null;
  subscribers: number | null;
};

/** Per-channel totals. Rejoice runs more than one channel; the old dashboard merged them. */
export async function getChannelBreakdown(): Promise<ChannelBreakdownRow[]> {
  const channels = await prisma.youTubeChannel.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      thumbnail: true,
      isActive: true,
      subscriberCount: true,
      channelViewCount: true,
      _count: { select: { videos: true } },
    },
  });

  const visibleByChannel = await prisma.youTubeVideo.groupBy({
    by: ['channelId'],
    where: publiclyVisible,
    _count: { _all: true },
  });
  const visible = new Map(visibleByChannel.map((v) => [v.channelId, v._count._all]));

  return channels.map((c) => ({
    id: c.id,
    name: c.name,
    thumbnail: c.thumbnail,
    isActive: c.isActive,
    videos: c._count.videos,
    visible: visible.get(c.id) ?? 0,
    views: c.channelViewCount === null ? null : Number(c.channelViewCount),
    subscribers: c.subscriberCount,
  }));
}

export type TopVideoRow = {
  id: string;
  title: string;
  channelName: string;
  views: number;
  isVisible: boolean;
};

/** Most-watched videos. `viewCount: null` rows are excluded, not sorted as zero. */
export async function getTopVideos(take = 8, channelId?: ChannelScope): Promise<TopVideoRow[]> {
  const rows = await prisma.youTubeVideo.findMany({
    where: { viewCount: { not: null }, ...scope(channelId) },
    orderBy: { viewCount: 'desc' },
    take,
    select: {
      id: true,
      youtubeTitle: true,
      displayTitle: true,
      viewCount: true,
      isVisible: true,
      channel: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.displayTitle ?? r.youtubeTitle,
    channelName: r.channel.name,
    views: r.viewCount ?? 0,
    isVisible: r.isVisible,
  }));
}

export type AttentionItem = {
  label: string;
  count: number;
  href: string;
};

/**
 * The dashboard as a work queue.
 *
 * Each row is a real, actionable backlog with a link that lands on exactly
 * those records — not a statistic. Rows with a count of zero are dropped by the
 * caller so the panel shrinks to nothing when there is nothing to do.
 */
export async function getNeedsAttention(channelId?: ChannelScope): Promise<AttentionItem[]> {
  const only = scope(channelId);

  const [popularHidden, missingSeo, failedChannels] = await Promise.all([
    // Hidden despite being among the most-watched: the most likely oversight
    // in a catalogue where new uploads arrive hidden by default.
    prisma.youTubeVideo.count({
      where: { isVisible: false, viewCount: { gte: 10_000 }, ...only },
    }),
    prisma.youTubeVideo.count({
      where: {
        AND: [publiclyVisible, only, { OR: [{ seoTitle: null }, { seoDescription: null }] }],
      },
    }),
    // Scoped too, so a healthy channel shows no row rather than pointing at
    // another channel's failure.
    prisma.youTubeChannel.count({
      where: { lastSyncError: { not: null }, ...(channelId ? { id: channelId } : {}) },
    }),
  ]);

  return [
    {
      label: 'Popular but hidden',
      count: popularHidden,
      href: '/admin/youtube-content?filter=hidden',
    },
    {
      label: 'Public, missing SEO text',
      count: missingSeo,
      href: '/admin/youtube-content?filter=visible',
    },
    { label: 'Channels with a sync error', count: failedChannels, href: '/admin/youtube-channels' },
  ];
}

export type GrowthPoint = { date: string; views: number; subscribers: number };

/**
 * Daily totals across all channels, for the growth chart.
 *
 * Returns an empty array until the daily sync has written snapshots — the chart
 * renders an explanatory empty state rather than a flat line at zero.
 */
export async function getGrowthSeries(
  days = 90,
  channelId?: ChannelScope,
): Promise<GrowthPoint[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  const rows = await prisma.$queryRaw<Array<{ date: Date; views: bigint; subs: bigint }>>`
    SELECT date,
           sum(views)       AS views,
           sum(subscribers) AS subs
    FROM "ChannelStatDaily"
    WHERE date >= ${since}
      AND (${channelId ?? null}::text IS NULL OR "channelId" = ${channelId ?? null})
    GROUP BY date
    ORDER BY date
  `;

  return rows.map((r) => ({
    date: new Date(r.date).toISOString().slice(0, 10),
    views: Number(r.views),
    subscribers: Number(r.subs),
  }));
}

export type YearPoint = { year: string; total: number; visible: number };

/** Uploads per year. Grouped in the database rather than pulled into memory. */
export async function getCatalogueByYear(channelId?: ChannelScope): Promise<YearPoint[]> {
  const rows = await prisma.$queryRaw<Array<{ year: string; total: bigint; visible: bigint }>>`
    SELECT to_char("youtubePublishedAt", 'YYYY') AS year,
           count(*)                            AS total,
           count(*) FILTER (WHERE "isVisible") AS visible
    FROM "YouTubeVideo"
    WHERE (${channelId ?? null}::text IS NULL OR "channelId" = ${channelId ?? null})
    GROUP BY 1
    ORDER BY 1
  `;

  return rows.map((r) => ({ year: r.year, total: Number(r.total), visible: Number(r.visible) }));
}
