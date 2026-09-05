/**
 * YouTube integration configuration.
 *
 * The API key is read on the server only and is never exposed to the browser
 * (section 37).
 */

export const youtubeConfig = {
  apiBaseUrl: 'https://www.googleapis.com/youtube/v3',

  /**
   * Maximum playlist pages fetched per channel per sync. Each page is 50 videos.
   * Keeps us well inside the daily YouTube quota (section 36).
   *
   * The scheduled run only needs to catch what was published since the last one.
   * At one run per day, 6 pages covers 300 uploads in 24 hours — far more than
   * any real channel produces, with margin if a day's run is missed.
   */
  maxPagesPerSync: 6,

  /**
   * A deep import (the first sync after connecting a channel, and a manual
   * "Sync Now") is NOT bounded by a page count. It walks the uploads playlist
   * until YouTube stops offering another page, so a channel of any size is
   * imported in full without a number here having to be guessed and maintained.
   *
   * A fixed 40-page cap used to stand here, silently truncating any channel
   * past 2,000 videos: the import reported success, the missing videos never
   * appeared anywhere, and pressing "Sync Now" walked the same 2,000 again.
   *
   * The two values below are what replaced it.
   */

  /**
   * How long one sync run may spend fetching before it stops and saves its
   * place. The real constraint is the serverless function ceiling — the sync
   * route sets `maxDuration = 60`, and a run killed at that limit loses the
   * page it was mid-way through with nothing recorded.
   *
   * This is the budget for a WHOLE run, shared by every channel in it — the
   * scheduled sync walks all five inside one invocation.
   *
   * It is deliberately only half of the invocation, because the statistics
   * upkeep runs in the same 60 seconds afterwards. Before the import became
   * time-bounded a sync was a handful of fast pages and statistics had the
   * function almost to itself; a backfill can now fill whatever it is given,
   * so the two are budgeted separately rather than competing.
   *
   * When the budget runs out the run is NOT a failure: it stores the next page
   * token on each channel and the following run continues from there, so a
   * very large back catalogue completes over a few runs unattended.
   */
  syncTimeBudgetMs: 30_000,

  /**
   * The point in a scheduled run by which ALL fetching must stop — syncing and
   * the statistics refresh that follows it. Below the route's `maxDuration =
   * 60` so the last database writes and the response still fit inside.
   */
  runTimeBudgetMs: 50_000,

  /**
   * Runaway guard, not a limit anyone is expected to reach. 500 pages is
   * 25,000 videos — far past any real channel. It exists so a bug on YouTube's
   * side handing back the same `nextPageToken` forever cannot spin until the
   * function is killed. (A token repeating itself is caught directly as well.)
   */
  maxPagesPerRun: 500,

  itemsPerPage: 50,

  /** Transient-failure retry policy. */
  retry: { attempts: 3, baseDelayMs: 400 },

  /**
   * How often the scheduled backup sync runs (section 12). Must mirror vercel.json.
   *
   * IMPORTANT: cron schedules run in UTC, not local time. Rejoice wants 6:00 pm
   * India time, and IST is UTC+5:30, so that is 12:30 UTC.
   *
   *   30 12 * * *   =  12:30 UTC  =  18:00 IST
   *
   * India does not observe daylight saving, so this stays correct year-round.
   * If the schedule ever moves, change it here and in vercel.json together.
   */
  scheduleCron: '30 12 * * *',

  /** Human-readable form of the above, shown in the admin portal. */
  scheduleLabel: 'Once daily at 6:00 pm IST',

  /**
   * YouTube Analytics API — revenue, watch time, subscriber movement, traffic
   * sources. A DIFFERENT API from the Data API above, with different auth:
   * the API key cannot read any of it, only OAuth as the channel owner can.
   */
  analyticsBaseUrl: 'https://youtubeanalytics.googleapis.com/v2',

  oauth: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    /** Path Google redirects back to. Must be registered on the OAuth client. */
    callbackPath: '/api/youtube/oauth/callback',
    /*
     * Cookie carrying the CSRF `state` nonce between the authorise redirect and
     * the callback. It lives here rather than being exported from the route,
     * because a Next.js route file may only export handlers and route config —
     * exporting anything else fails the build's generated type check.
     */
    stateCookie: 'youtube_oauth_state',
    /*
     * `email` identifies the connection in the UI ("Connected as ...").
     * `yt-analytics.readonly` covers views and watch time.
     * `yt-analytics-monetary.readonly` is the ONLY way to read revenue, and is
     * requested separately so a declined monetary consent still leaves the
     * rest of the analytics working.
     */
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/yt-analytics.readonly',
      'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
    ],
    monetaryScope: 'https://www.googleapis.com/auth/yt-analytics-monetary.readonly',
  },

  /**
   * How long a cached analytics report is served before it is fetched again.
   *
   * The Analytics API is slow and quota-limited, and its numbers move once a
   * day at best — revenue lags two to three days. Serving a cached report keeps
   * the dashboard from blocking on a network call it does not need to make.
   */
  analyticsCacheMinutes: 180,

  /** WebSub hub used for push notifications (section 12). */
  websubHubUrl: 'https://pubsubhubbub.appspot.com/subscribe',
  websubTopicUrl: (channelId: string) =>
    `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
} as const;

export function getYouTubeApiKey(): string | null {
  const key = process.env.YOUTUBE_API_KEY;
  return key && key.trim().length > 0 ? key : null;
}

export function isYouTubeConfigured(): boolean {
  return getYouTubeApiKey() !== null;
}

export type YouTubeOAuthCredentials = { clientId: string; clientSecret: string };

/**
 * The OAuth client Rejoice registered in Google Cloud Console.
 *
 * Separate from the API key on purpose: the key reads public data and is
 * enough for the whole public website, while these authorise reading a
 * channel's private earnings. A deployment may reasonably have one and not the
 * other, so nothing here falls back to the key.
 */
export function getYouTubeOAuthCredentials(): YouTubeOAuthCredentials | null {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;

  if (!clientId?.trim() || !clientSecret?.trim()) return null;
  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}

export function isYouTubeAnalyticsConfigured(): boolean {
  return getYouTubeOAuthCredentials() !== null;
}
