import 'server-only';

import { getYouTubeOAuthCredentials, youtubeConfig } from '@/config/youtube.config';
import { prisma } from '@/lib/db/prisma';
import { createLogger } from '@/lib/logger';
import { open, seal } from '@/lib/utils/secretBox';

/**
 * YouTube Analytics API v2 — revenue, watch time, subscriber movement, traffic
 * sources.
 *
 * This is a SECOND YouTube API, not an extension of the first. `youtubeClient`
 * reads public data with an API key; nothing it can do will ever return
 * revenue. Everything here needs OAuth as the account that owns the channels,
 * which is why this module keeps its own credential handling.
 *
 * Server-only and never imported by a component (section 26/37): it holds a
 * client secret and a decrypted refresh token.
 *
 * Failure is expected and normal here, and is reported rather than thrown:
 *   - nobody has connected an account yet
 *   - the channels are not in the YouTube Partner Program, so revenue 403s
 *   - the owner granted analytics but declined the monetary scope
 * None of those are faults, and none may take the dashboard down.
 */

const log = createLogger('youtubeAnalytics');

/**
 * One cached report PER CHANNEL.
 *
 * A single key meant one channel's refresh evicted every other channel's
 * report, so connecting a second channel would have quietly halved the value
 * of the first.
 */
const cacheKey = (channelId: string) => `youtube.analytics.cache.${channelId}`;

export type AnalyticsUnavailableReason =
  | 'not-configured'
  | 'not-connected'
  | 'not-monetised'
  | 'error';

export type DayPoint = { date: string; views: number; minutesWatched: number };
export type MonthRevenue = { month: string; revenue: number };
export type TrafficSource = { source: string; views: number };
export type SubscriberDay = { date: string; gained: number; lost: number };

export type AnalyticsReport = {
  fetchedAt: string;
  currency: string | null;
  /**
   * Which of OUR channels this report describes, as a `YouTubeChannel.id`.
   *
   * One OAuth token speaks for exactly one channel (`ids=channel==MINE`), so a
   * dashboard scoped to a different channel must not show these figures as if
   * they were its own. Null when it could not be determined.
   *
   * Derived rather than read: identifying the channel directly needs the
   * `youtube.readonly` scope, which this app deliberately does not request —
   * it only ever needs analytics. So the top videos are asked for instead and
   * matched against the catalogue, which is unambiguous and costs one extra
   * query per cache refresh rather than one per page render.
   */
  channelDbId: string | null;
  /** Null when the monetary scope was declined or the channel is not monetised. */
  revenueByMonth: MonthRevenue[] | null;
  daily: DayPoint[];
  traffic: TrafficSource[];
  subscribers: SubscriberDay[];
};

export type AnalyticsState =
  | { status: 'ready'; report: AnalyticsReport; connectedAs: string; stale: boolean }
  | { status: 'unavailable'; reason: AnalyticsUnavailableReason; message: string };

/* -------------------------------------------------------------------------- */
/* Connection                                                                  */
/* -------------------------------------------------------------------------- */

export type Connection = {
  /** Null only for a connection whose channel has not been resolved yet. */
  channelId: string | null;
  email: string;
  hasMonetaryScope: boolean;
  connectedAt: Date;
};

function toConnection(row: {
  channelId: string | null;
  googleAccountEmail: string;
  scopes: string;
  createdAt: Date;
}): Connection {
  return {
    channelId: row.channelId,
    email: row.googleAccountEmail,
    hasMonetaryScope: row.scopes.includes(youtubeConfig.oauth.monetaryScope),
    connectedAt: row.createdAt,
  };
}

/** Every connection, for the Settings screen. */
export async function getConnections(): Promise<Connection[]> {
  const rows = await prisma.youTubeOAuthToken.findMany({ orderBy: { createdAt: 'asc' } });
  return rows.map(toConnection);
}

/**
 * The connection for one channel.
 *
 * Falls back to a row whose channel is not yet resolved, which is how the
 * connection made before tokens were per-channel keeps working: it is claimed
 * by the first channel that turns out to own it, in `getAnalytics`.
 */
export async function getConnection(channelId: string): Promise<Connection | null> {
  const exact = await prisma.youTubeOAuthToken.findUnique({ where: { channelId } });
  if (exact) return toConnection(exact);

  const unresolved = await prisma.youTubeOAuthToken.findFirst({
    where: { channelId: null },
    orderBy: { createdAt: 'desc' },
  });
  return unresolved ? toConnection(unresolved) : null;
}

/** Removes ONE channel's connection, leaving every other channel connected. */
export async function disconnect(channelId: string): Promise<void> {
  await prisma.youTubeOAuthToken.deleteMany({ where: { channelId } });
  await prisma.siteSetting.deleteMany({ where: { key: cacheKey(channelId) } });
  log.info(`YouTube analytics disconnected for channel ${channelId}`);
}

/**
 * A usable access token, refreshing it when the stored one has expired.
 *
 * The 60-second margin exists because a token that expires while the request is
 * in flight fails exactly like a bad credential, and that failure is
 * indistinguishable from "the user revoked access" at the call site.
 */
async function getAccessToken(tokenId: string): Promise<string | null> {
  const credentials = getYouTubeOAuthCredentials();
  if (!credentials) return null;

  const row = await prisma.youTubeOAuthToken.findUnique({ where: { id: tokenId } });
  if (!row) return null;

  if (row.accessToken && row.expiresAt && row.expiresAt.getTime() - 60_000 > Date.now()) {
    return open(row.accessToken);
  }

  const response = await fetch(youtubeConfig.oauth.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: open(row.refreshToken),
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    // A revoked or expired refresh token cannot be recovered from — the owner
    // has to reconnect. Say so plainly rather than retrying forever.
    log.error('Refresh token rejected', await response.text());
    throw new Error('The Google connection is no longer valid. Reconnect the account.');
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };

  await prisma.youTubeOAuthToken.update({
    where: { id: row.id },
    data: {
      accessToken: seal(data.access_token),
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

type ReportRows = { columnHeaders?: Array<{ name: string }>; rows?: unknown[][] };

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * One `reports.query` call.
 *
 * `ids=channel==MINE` means "whichever channel this token owns", which is why
 * no channel ID is passed — the token defines the scope.
 */
async function query(
  token: string,
  params: Record<string, string>,
): Promise<ReportRows | { forbidden: true }> {
  const url = new URL(`${youtubeConfig.analyticsBaseUrl}/reports`);
  url.search = new URLSearchParams({ ids: 'channel==MINE', ...params }).toString();

  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } });

  if (response.status === 403) return { forbidden: true };
  if (!response.ok) {
    throw new Error(`YouTube Analytics returned ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as ReportRows;
}

async function fetchReport(token: string): Promise<AnalyticsReport> {
  const today = new Date();
  const start90 = new Date(today);
  start90.setUTCDate(start90.getUTCDate() - 90);

  const window90 = { startDate: ymd(start90), endDate: ymd(today) };

  /*
   * The `month` dimension will not accept an arbitrary date range.
   *
   * Asking for revenue from "365 days ago" sent start-date 2025-09-04 and
   * YouTube rejected the whole request:
   *
   *   400 — Date range (2025-09-04) in field parameters.start-date
   *         does not align to chosen date dimension.
   *
   * BOTH dates must be the FIRST of a month. Not the last, and not an
   * arbitrary day — the end date names the final month to include, it does not
   * bound it. Established by probing the live API rather than by reading the
   * error message, which says only "does not align to chosen date dimension"
   * and cost three wrong guesses:
   *
   *   2025-09-01 .. 2026-08-01   200, 12 rows
   *   2025-09-01 .. 2026-09-01   200, 13 rows
   *   2025-09-01 .. 2026-08-31   400  (end is a month END)
   *   2025-08-31 .. 2026-08-31   400  (start is a month END)
   *
   * So: the 1st of the current month back to the 1st eleven months earlier,
   * which is twelve months inclusive. The current month is included and is
   * partial by nature — estimated revenue also lags a few days, which is why
   * the panel labels it an estimate.
   */
  const revenueEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const revenueStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 11, 1));

  /*
   * `allSettled`, not `all`.
   *
   * These four reports are independent, but under Promise.all a single
   * rejection discarded the other three — the malformed revenue range above
   * meant the dashboard showed NOTHING rather than everything-but-revenue, and
   * no report was cached at all. One failing panel must not cost the rest.
   */
  const settled = await Promise.allSettled([
    query(token, { ...window90, metrics: 'views,estimatedMinutesWatched', dimensions: 'day' }),
    query(token, {
      startDate: ymd(revenueStart),
      endDate: ymd(revenueEnd),
      metrics: 'estimatedRevenue',
      dimensions: 'month',
    }),
    query(token, { ...window90, metrics: 'views', dimensions: 'insightTrafficSourceType' }),
    query(token, { ...window90, metrics: 'subscribersGained,subscribersLost', dimensions: 'day' }),
    // Only to identify the channel — see `channelDbId`.
    query(token, {
      ...window90,
      metrics: 'views',
      dimensions: 'video',
      sort: '-views',
      maxResults: '10',
    }),
  ]);

  const [dailyRes, revenueRes, trafficRes, subsRes, topRes] = settled;

  for (const [i, r] of settled.entries()) {
    if (r.status === 'rejected') {
      log.error(
        `Analytics report ${['daily', 'revenue', 'traffic', 'subscribers', 'topVideos'][i]} failed`,
        r.reason,
      );
    }
  }

  /** A rejected report is treated as "no rows", never as a reason to lose the others. */
  const value = (r: (typeof settled)[number]): ReportRows | { forbidden: true } =>
    r.status === 'fulfilled' ? r.value : { forbidden: true };

  const dailyRaw = value(dailyRes);
  const revenueRaw = value(revenueRes);
  const trafficRaw = value(trafficRes);
  const subsRaw = value(subsRes);

  const rows = (r: ReportRows | { forbidden: true }) =>
    'forbidden' in r ? [] : (r.rows ?? []);

  /*
   * The channel these figures belong to.
   *
   * A video id is enough: every video the token can report on belongs to its
   * own channel, so the first one we recognise settles it. `findFirst` rather
   * than a tally — they cannot disagree.
   */
  const topVideoIds = rows(value(topRes)).map((r) => String(r[0]));
  const match =
    topVideoIds.length > 0
      ? await prisma.youTubeVideo.findFirst({
          where: { youtubeVideoId: { in: topVideoIds } },
          select: { channelId: true },
        })
      : null;

  return {
    fetchedAt: new Date().toISOString(),
    channelDbId: match?.channelId ?? null,
    // The Analytics API reports revenue in the channel's payment currency and
    // does not name it in the response, so this stays null until a caller has a
    // reason to configure it.
    currency: null,
    /*
     * A 403 on THIS call specifically means the monetary scope was declined or
     * the channel is not in the Partner Program. It is reported as "no revenue
     * data" rather than an empty list, which would read as "earned nothing".
     */
    revenueByMonth:
      'forbidden' in revenueRaw
        ? null
        : (revenueRaw.rows ?? []).map((r) => ({
            month: String(r[0]),
            revenue: Number(r[1]) || 0,
          })),
    daily: rows(dailyRaw).map((r) => ({
      date: String(r[0]),
      views: Number(r[1]) || 0,
      minutesWatched: Number(r[2]) || 0,
    })),
    traffic: rows(trafficRaw)
      .map((r) => ({ source: String(r[0]), views: Number(r[1]) || 0 }))
      .sort((a, b) => b.views - a.views),
    subscribers: rows(subsRaw).map((r) => ({
      date: String(r[0]),
      gained: Number(r[1]) || 0,
      lost: Number(r[2]) || 0,
    })),
  };
}

/* -------------------------------------------------------------------------- */
/* Cache                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The dashboard's entry point.
 *
 * Reads the cached report and only calls Google when it has gone stale, so
 * rendering the dashboard costs a database read rather than four slow API
 * calls. When a refresh fails but a cached report exists, the CACHED one is
 * returned marked `stale` — an old number with a date on it is far more useful
 * than an error panel.
 */
export async function getAnalytics(channelId: string): Promise<AnalyticsState> {
  if (!getYouTubeOAuthCredentials()) {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      message: 'YouTube analytics is not set up on this deployment.',
    };
  }

  /*
   * The row for this channel, or an unresolved one that might turn out to be
   * this channel's. `findUnique` first so a resolved connection is never
   * shadowed by a stray unresolved row.
   */
  const row =
    (await prisma.youTubeOAuthToken.findUnique({ where: { channelId } })) ??
    (await prisma.youTubeOAuthToken.findFirst({
      where: { channelId: null },
      orderBy: { createdAt: 'desc' },
    }));

  if (!row) {
    return {
      status: 'unavailable',
      reason: 'not-connected',
      message: 'This channel is not connected yet.',
    };
  }

  const connection = toConnection(row);
  const cached = await prisma.siteSetting.findUnique({ where: { key: cacheKey(channelId) } });
  const report = cached ? (cached.value as unknown as AnalyticsReport) : null;

  const ageMinutes = report
    ? (Date.now() - new Date(report.fetchedAt).getTime()) / 60_000
    : Infinity;

  if (report && ageMinutes < youtubeConfig.analyticsCacheMinutes) {
    return { status: 'ready', report, connectedAs: connection.email, stale: false };
  }

  try {
    const token = await getAccessToken(row.id);
    if (!token) {
      return {
        status: 'unavailable',
        reason: 'not-connected',
        message: 'This channel is not connected yet.',
      };
    }

    const fresh = await fetchReport(token);

    /*
     * Adopt an unresolved row the moment its channel is known.
     *
     * This is what carries the connection made before tokens were per-channel
     * into the new shape, without asking anyone to sign in again. If the token
     * turns out to belong to a DIFFERENT channel than the one being viewed,
     * file it correctly and report nothing here — the caller is looking at a
     * channel this credential cannot speak for.
     */
    if (row.channelId === null && fresh.channelDbId) {
      await prisma.youTubeOAuthToken.update({
        where: { id: row.id },
        data: { channelId: fresh.channelDbId },
      });
      log.info(`Adopted an unresolved analytics connection for channel ${fresh.channelDbId}`);
    }

    if (fresh.channelDbId && fresh.channelDbId !== channelId) {
      return {
        status: 'unavailable',
        reason: 'not-connected',
        message: 'This channel is not connected yet.',
      };
    }

    await prisma.siteSetting.upsert({
      where: { key: cacheKey(channelId) },
      create: { key: cacheKey(channelId), value: fresh as unknown as object },
      update: { value: fresh as unknown as object },
    });

    return { status: 'ready', report: fresh, connectedAs: connection.email, stale: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analytics request failed';
    log.error('Analytics refresh failed', message);

    if (report) {
      return { status: 'ready', report, connectedAs: connection.email, stale: true };
    }

    return { status: 'unavailable', reason: 'error', message };
  }
}
