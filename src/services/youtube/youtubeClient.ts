import 'server-only';

import { getYouTubeApiKey, youtubeConfig } from '@/config/youtube.config';
import { createLogger } from '@/lib/logger';

/**
 * Thin typed wrapper over YouTube Data API v3.
 *
 * This is the ONLY module in the codebase that talks to YouTube over the network,
 * and it is server-only — the API key never reaches the browser (section 37).
 * React components must not import it (section 26).
 */

const log = createLogger('youtubeClient');

export class YouTubeNotConfiguredError extends Error {
  constructor() {
    super('YOUTUBE_API_KEY is not set. Add it to your environment to enable synchronization.');
    this.name = 'YouTubeNotConfiguredError';
  }
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'YouTubeApiError';
  }
}

export type YouTubeChannelInfo = {
  channelId: string;
  title: string;
  handle: string | null;
  description: string;
  thumbnail: string | null;
  uploadsPlaylistId: string;
  url: string;
  /** See `parseCount`: null means not learned, not zero. */
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
};

export type YouTubeVideoInfo = {
  videoId: string;
  channelId: string;
  title: string;
  description: string;
  thumbnail: string | null;
  publishedAt: Date;
  url: string;
  durationSeconds: number | null;
  /**
   * Vertical, i.e. a Short — see `isVertical` for how this is determined.
   *
   * `null` means NOT LEARNED: the detail lookup
   * did not return this video — which is different from "known to be
   * landscape". The sync relies on that distinction to avoid overwriting a good
   * classification with a guess.
   */
  isShort: boolean | null;
  /** See `parseCount`: null means not learned, not zero. */
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

type ThumbnailSet = Record<string, { url: string } | undefined>;

/** Prefer the largest thumbnail YouTube offers. */
function bestThumbnail(thumbs: ThumbnailSet | undefined): string | null {
  if (!thumbs) return null;
  for (const key of ['maxres', 'standard', 'high', 'medium', 'default']) {
    const t = thumbs[key];
    if (t?.url) return t.url;
  }
  return null;
}

/**
 * Width used purely to make YouTube report the embed dimensions. The number
 * itself is irrelevant — only the ratio of what comes back is read — but it has
 * to be sent for the fields to be populated.
 */
const EMBED_PROBE_WIDTH = 480;

type PlayerInfo = { embedWidth?: string; embedHeight?: string } | undefined;


/**
 * Is this video taller than it is wide — i.e. a Short?
 *
 * The Data API exposes no aspect-ratio field, but it does report the dimensions
 * it would embed the player at, and those follow the source video. They are only
 * populated when the request carries a `maxWidth`/`maxHeight`, which is why
 * every caller below sets `maxWidth`. Without it these come back undefined and
 * everything would silently classify as landscape.
 *
 * Duration is deliberately NOT part of this test. Measured against the Rejoice
 * catalogue, real Shorts run past a minute (`Ex_xepjJpqI` is 1m 6s), so a
 * "under 60 seconds" rule misfiles them. Shape is the signal; length is not.
 *
 * Both values arrive as strings, hence the explicit `Number` — comparing them
 * as strings would give the right answer for "853" > "480" and the wrong one
 * elsewhere, which is the worst kind of bug to be handed.
 */
export function isVertical(player: PlayerInfo): boolean {
  const w = Number(player?.embedWidth);
  const h = Number(player?.embedHeight);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return false;
  return h > w;
}

/** ISO-8601 duration (PT4M13S) -> seconds. */
export function parseIsoDuration(iso: string | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)W)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(iso);
  if (!m) return null;

  const [, w, d, h, min, s] = m;
  const seconds =
    Number(w ?? 0) * 604800 +
    Number(d ?? 0) * 86400 +
    Number(h ?? 0) * 3600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0);

  /*
   * Zero means "no duration reported", not "a video of length zero".
   *
   * A live broadcast or an upcoming premiere comes back as `P0D`, which parsed
   * to 0 — and because 0 is not null, the sync happily wrote it over whatever
   * real duration was already stored. Returning null keeps it in the same
   * "unknown, leave the stored value alone" lane as a missing duration.
   */
  return seconds > 0 ? Math.round(seconds) : null;
}

/**
 * YouTube returns every count as a STRING, and omits the property entirely when
 * the owner has hidden that statistic (likes and comments are both commonly
 * hidden; `viewCount` occasionally is too).
 *
 * `null` therefore means NOT LEARNED, exactly as it does for `isShort` — it is
 * NOT a count of zero, and the sync must never write it over a good stored
 * value. A real zero from YouTube ("0") still parses to 0 and is kept.
 */
function parseCount(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T>(endpoint: string, params: Record<string, string>): Promise<T> {
  const key = getYouTubeApiKey();
  if (!key) throw new YouTubeNotConfiguredError();

  const url = new URL(`${youtubeConfig.apiBaseUrl}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);

  const { attempts, baseDelayMs } = youtubeConfig.retry;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { cache: 'no-store' });

      if (res.ok) return (await res.json()) as T;

      const body = await res.text();
      // 5xx and 429 are worth retrying; 4xx (bad key, quota exceeded, not found) are not.
      const retryable = res.status >= 500 || res.status === 429;
      const err = new YouTubeApiError(
        `YouTube API ${endpoint} failed (${res.status}): ${body.slice(0, 300)}`,
        res.status,
        retryable,
      );
      if (!retryable) throw err;
      lastError = err;
    } catch (error) {
      if (error instanceof YouTubeApiError && !error.retryable) throw error;
      if (error instanceof YouTubeNotConfiguredError) throw error;
      lastError = error;
    }

    if (attempt < attempts) {
      const delay = baseDelayMs * 2 ** (attempt - 1);
      log.warn(`${endpoint} attempt ${attempt} failed, retrying in ${delay}ms`);
      await sleep(delay);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`YouTube API ${endpoint} failed`);
}

/**
 * Extract whatever identifies a channel from a pasted URL (section 9).
 * Accepts: /channel/UC..., /@handle, /c/name, /user/name, a bare UC... id, or @handle.
 */
export function parseChannelUrl(
  input: string,
): { type: 'id' | 'handle' | 'legacy'; value: string } | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^UC[\w-]{20,}$/.test(raw)) return { type: 'id', value: raw };
  if (raw.startsWith('@')) return { type: 'handle', value: raw.slice(1) };

  let path: string;
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (!/(^|\.)youtube\.com$/.test(url.hostname) && url.hostname !== 'youtu.be') return null;
    path = url.pathname;
  } catch {
    return null;
  }

  const channelMatch = /^\/channel\/(UC[\w-]+)/.exec(path);
  if (channelMatch) return { type: 'id', value: channelMatch[1] };

  const handleMatch = /^\/@([\w.-]+)/.exec(path);
  if (handleMatch) return { type: 'handle', value: handleMatch[1] };

  const legacyMatch = /^\/(?:c|user)\/([\w.-]+)/.exec(path);
  if (legacyMatch) return { type: 'legacy', value: legacyMatch[1] };

  return null;
}

type ChannelListResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: ThumbnailSet;
    };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
    statistics?: {
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
    };
  }>;
};

function toChannelInfo(item: NonNullable<ChannelListResponse['items']>[number]): YouTubeChannelInfo {
  const uploads = item.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`Channel ${item.id} has no uploads playlist`);

  const handle = item.snippet?.customUrl?.replace(/^@/, '') ?? null;

  return {
    channelId: item.id,
    title: item.snippet?.title ?? 'Untitled channel',
    handle,
    description: item.snippet?.description ?? '',
    thumbnail: bestThumbnail(item.snippet?.thumbnails),
    uploadsPlaylistId: uploads,
    subscriberCount: parseCount(item.statistics?.subscriberCount),
    viewCount: parseCount(item.statistics?.viewCount),
    videoCount: parseCount(item.statistics?.videoCount),
    url: handle
      ? `https://www.youtube.com/@${handle}`
      : `https://www.youtube.com/channel/${item.id}`,
  };
}

/**
 * Resolve a pasted channel URL to its permanent channel ID and uploads playlist
 * (section 9). The permanent ID is what we store — handles can change.
 */
export async function resolveChannel(input: string): Promise<YouTubeChannelInfo> {
  const parsed = parseChannelUrl(input);
  if (!parsed) {
    throw new Error('Could not read a YouTube channel from that URL.');
  }

  const parts = 'snippet,contentDetails,statistics';

  if (parsed.type === 'id') {
    const data = await request<ChannelListResponse>('channels', { part: parts, id: parsed.value });
    const item = data.items?.[0];
    if (!item) throw new Error('No YouTube channel found for that ID.');
    return toChannelInfo(item);
  }

  if (parsed.type === 'handle') {
    const data = await request<ChannelListResponse>('channels', {
      part: parts,
      forHandle: `@${parsed.value}`,
    });
    const item = data.items?.[0];
    if (item) return toChannelInfo(item);
  }

  // Legacy /c/ and /user/ URLs, and handles the forHandle lookup missed: fall back to search.
  const search = await request<{ items?: Array<{ id?: { channelId?: string } }> }>('search', {
    part: 'snippet',
    type: 'channel',
    maxResults: '1',
    q: parsed.value,
  });
  const foundId = search.items?.[0]?.id?.channelId;
  if (!foundId) throw new Error('No YouTube channel found for that URL.');

  const data = await request<ChannelListResponse>('channels', { part: parts, id: foundId });
  const item = data.items?.[0];
  if (!item) throw new Error('No YouTube channel found for that URL.');
  return toChannelInfo(item);
}

/** Refresh stored channel metadata (name, logo) for an already-connected channel. */
export async function fetchChannelById(channelId: string): Promise<YouTubeChannelInfo> {
  const data = await request<ChannelListResponse>('channels', {
    part: 'snippet,contentDetails,statistics',
    id: channelId,
  });
  const item = data.items?.[0];
  if (!item) throw new Error(`YouTube channel ${channelId} no longer exists.`);
  return toChannelInfo(item);
}

type PlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      channelId?: string;
      thumbnails?: ThumbnailSet;
      resourceId?: { videoId?: string };
    };
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
  }>;
};

export type UploadsPage = {
  videos: YouTubeVideoInfo[];
  /**
   * Where the next page starts, or `undefined` when this was the last page of
   * the playlist — which is the ONLY signal that a channel has been imported
   * in full. The caller stores it so a run that stops early can resume.
   */
  nextPageToken?: string;
};

/**
 * One page of a channel's uploads, newest first.
 *
 * Deliberately one page per call rather than a loop that returns everything:
 * the caller persists each page as it arrives and records where it got to, so
 * an import interrupted by the serverless time limit keeps what it fetched
 * instead of discarding the lot. See `syncChannel`.
 */
export async function fetchUploadsPage(
  uploadsPlaylistId: string,
  pageToken?: string,
): Promise<UploadsPage> {
  const videos: YouTubeVideoInfo[] = [];

  const params: Record<string, string> = {
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: String(youtubeConfig.itemsPerPage),
  };
  if (pageToken) params.pageToken = pageToken;

  const data = await request<PlaylistItemsResponse>('playlistItems', params);

  for (const item of data.items ?? []) {
    const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
    if (!videoId) continue;

    // Deleted or private videos still appear in the playlist; skip them.
    const title = item.snippet?.title ?? '';
    if (title === 'Private video' || title === 'Deleted video') continue;

    const publishedRaw =
      item.contentDetails?.videoPublishedAt ??
      item.snippet?.publishedAt ??
      new Date().toISOString();

    videos.push({
      videoId,
      channelId: item.snippet?.channelId ?? '',
      title,
      description: item.snippet?.description ?? '',
      thumbnail: bestThumbnail(item.snippet?.thumbnails),
      publishedAt: new Date(publishedRaw),
      url: `https://www.youtube.com/watch?v=${videoId}`,
      // Filled in by the hydration pass below — `playlistItems` reports
      // neither of these.
      durationSeconds: null,
      isShort: null,
      viewCount: null,
      likeCount: null,
      commentCount: null,
    });
  }

  /*
   * `playlistItems` carries no duration and no dimensions, so a second pass
   * over the `videos` endpoint fills both in. Before this existed every synced
   * video was stored with a null duration, which is why the duration badges on
   * the public cards never had anything to show.
   *
   * It costs one extra request per 50 videos — the same batching
   * `fetchVideosByIds` already does, which is why that is reused rather than a
   * second batching loop written here.
   */
  const details = await fetchVideosByIds(videos.map((v) => v.videoId));
  const byId = new Map(details.map((d) => [d.videoId, d]));

  const hydrated = videos.map((video) => {
    const detail = byId.get(video.videoId);
    if (!detail) return video;
    return {
      ...video,
      durationSeconds: detail.durationSeconds,
      isShort: detail.isShort,
      viewCount: detail.viewCount,
      likeCount: detail.likeCount,
      commentCount: detail.commentCount,
    };
  });

  return { videos: hydrated, nextPageToken: data.nextPageToken };
}

type VideosResponse = {
  items?: Array<{
    id: string;
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      channelId?: string;
      thumbnails?: ThumbnailSet;
    };
    contentDetails?: { duration?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
    player?: { embedWidth?: string; embedHeight?: string };
  }>;
};

/** Full details for specific video IDs. Used by the WebSub webhook (section 12). */
export async function fetchVideosByIds(videoIds: string[]): Promise<YouTubeVideoInfo[]> {
  if (videoIds.length === 0) return [];

  const out: YouTubeVideoInfo[] = [];

  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const data = await request<VideosResponse>('videos', {
      /*
       * `statistics` rides along free: videos.list costs 1 quota unit per
       * request no matter how many parts are asked for, so every existing
       * sync now returns view/like/comment counts at no extra cost.
       */
      part: 'snippet,contentDetails,statistics,player',
      id: batch.join(','),
      // Required for player.embedWidth/embedHeight to be returned at all.
      maxWidth: String(EMBED_PROBE_WIDTH),
    });

    for (const item of data.items ?? []) {
      out.push({
        videoId: item.id,
        channelId: item.snippet?.channelId ?? '',
        title: item.snippet?.title ?? '',
        description: item.snippet?.description ?? '',
        thumbnail: bestThumbnail(item.snippet?.thumbnails),
        publishedAt: new Date(item.snippet?.publishedAt ?? Date.now()),
        url: `https://www.youtube.com/watch?v=${item.id}`,
        durationSeconds: parseIsoDuration(item.contentDetails?.duration),
        isShort: isVertical(item.player),
        viewCount: parseCount(item.statistics?.viewCount),
        likeCount: parseCount(item.statistics?.likeCount),
        commentCount: parseCount(item.statistics?.commentCount),
      });
    }
  }

  return out;
}
