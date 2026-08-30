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

const CACHE_KEY = 'youtube.analytics.cache';

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
  email: string;
  hasMonetaryScope: boolean;
  connectedAt: Date;
};

export async function getConnection(): Promise<Connection | null> {
  const row = await prisma.youTubeOAuthToken.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!row) return null;

  return {
    email: row.googleAccountEmail,
    hasMonetaryScope: row.scopes.includes(youtubeConfig.oauth.monetaryScope),
    connectedAt: row.createdAt,
  };
}

export async function disconnect(): Promise<void> {
  await prisma.youTubeOAuthToken.deleteMany();
  await prisma.siteSetting.deleteMany({ where: { key: CACHE_KEY } });
  log.info('YouTube analytics disconnected');
}

/**
 * A usable access token, refreshing it when the stored one has expired.
 *
 * The 60-second margin exists because a token that expires while the request is
 * in flight fails exactly like a bad credential, and that failure is
 * indistinguishable from "the user revoked access" at the call site.
 */
async function getAccessToken(): Promise<string | null> {
  const credentials = getYouTubeOAuthCredentials();
  if (!credentials) return null;

  const row = await prisma.youTubeOAuthToken.findFirst({ orderBy: { createdAt: 'desc' } });
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
  const start365 = new Date(today);
  start365.setUTCDate(start365.getUTCDate() - 365);

  const window90 = { startDate: ymd(start90), endDate: ymd(today) };

  const [dailyRaw, revenueRaw, trafficRaw, subsRaw] = await Promise.all([
    query(token, { ...window90, metrics: 'views,estimatedMinutesWatched', dimensions: 'day' }),
    query(token, {
      startDate: ymd(start365),
      endDate: ymd(today),
      metrics: 'estimatedRevenue',
      dimensions: 'month',
    }),
    query(token, { ...window90, metrics: 'views', dimensions: 'insightTrafficSourceType' }),
    query(token, { ...window90, metrics: 'subscribersGained,subscribersLost', dimensions: 'day' }),
  ]);

  const rows = (r: ReportRows | { forbidden: true }) =>
    'forbidden' in r ? [] : (r.rows ?? []);

  return {
    fetchedAt: new Date().toISOString(),
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
export async function getAnalytics(): Promise<AnalyticsState> {
  if (!getYouTubeOAuthCredentials()) {
    return {
      status: 'unavailable',
      reason: 'not-configured',
      message: 'YouTube analytics is not set up on this deployment.',
    };
  }

  const connection = await getConnection();
  if (!connection) {
    return {
      status: 'unavailable',
      reason: 'not-connected',
      message: 'Connect the Google account that owns the channels to see analytics.',
    };
  }

  const cached = await prisma.siteSetting.findUnique({ where: { key: CACHE_KEY } });
  const report = cached ? (cached.value as unknown as AnalyticsReport) : null;

  const ageMinutes = report
    ? (Date.now() - new Date(report.fetchedAt).getTime()) / 60_000
    : Infinity;

  if (report && ageMinutes < youtubeConfig.analyticsCacheMinutes) {
    return { status: 'ready', report, connectedAs: connection.email, stale: false };
  }

  try {
    const token = await getAccessToken();
    if (!token) {
      return {
        status: 'unavailable',
        reason: 'not-connected',
        message: 'Connect the Google account that owns the channels to see analytics.',
      };
    }

    const fresh = await fetchReport(token);

    await prisma.siteSetting.upsert({
      where: { key: CACHE_KEY },
      create: { key: CACHE_KEY, value: fresh as unknown as object },
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
