/**
 * The single place where "what the website shows" is decided (section 18).
 *
 *     Use the website value if the administrator set one.
 *     Otherwise fall back to the imported YouTube value.
 *
 * Every public surface must render videos through `resolveVideoDisplay` — no
 * component should read `youtubeTitle` / `displayTitle` directly. Keeping the
 * rule here means changing it changes it everywhere (DRY, section 3.2).
 */

/** The subset of YouTubeVideo fields needed to render one. */
export type DisplayableVideo = {
  id: string;
  youtubeVideoId: string;
  youtubeTitle: string;
  youtubeDescription: string;
  youtubeThumbnail: string | null;
  youtubePublishedAt: Date;
  youtubeUrl: string;
  displayTitle: string | null;
  displayDescription: string | null;
  displayThumbnail: string | null;
  showChannelName: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type ResolvedVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: Date;
  youtubeUrl: string;
  showChannelName: boolean;
  seoTitle: string;
  seoDescription: string;
};

/** Treat empty/whitespace-only overrides as "not set". */
function override(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function fallbackThumbnailUrl(youtubeVideoId: string): string {
  return `https://i.ytimg.com/vi/${youtubeVideoId}/hqdefault.jpg`;
}

export function watchUrl(youtubeVideoId: string): string {
  return `https://www.youtube.com/watch?v=${youtubeVideoId}`;
}

/** The privacy-preserving embed host, kept in one place. */
export const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * A player URL. Defaults reproduce the original one-argument behaviour
 * (`autoplay=1&rel=0`), so the click-to-play callers are unaffected.
 *
 * The options exist for the Shorts feed, which needs a muted, looping,
 * inline-playing player it can talk to. Built here rather than by appending
 * query strings at the call site: this is the one place that knows the embed
 * host and the house `rel=0`.
 */
export function embedUrl(
  youtubeVideoId: string,
  options: {
    autoplay?: boolean;
    mute?: boolean;
    /** Loops the single video. Requires `playlist` set to the same id. */
    loop?: boolean;
    playsinline?: boolean;
    /** Needed before the player will accept `postMessage` commands. */
    enablejsapi?: boolean;
    /**
     * The embedding page's origin. YouTube requires this alongside
     * `enablejsapi` before it will act on posted commands, and without it the
     * player also declines to autoplay.
     */
    origin?: string;
  } = {},
): string {
  const {
    autoplay = true,
    mute = false,
    loop = false,
    playsinline = false,
    enablejsapi = false,
    origin,
  } = options;

  const params = new URLSearchParams({ rel: '0' });
  if (autoplay) params.set('autoplay', '1');
  if (mute) params.set('mute', '1');
  if (playsinline) params.set('playsinline', '1');
  if (enablejsapi) params.set('enablejsapi', '1');
  if (origin) params.set('origin', origin);
  if (loop) {
    // A single video loops only when it is also named as the playlist; `loop=1`
    // alone is silently ignored.
    params.set('loop', '1');
    params.set('playlist', youtubeVideoId);
  }

  return `${EMBED_ORIGIN}/embed/${youtubeVideoId}?${params.toString()}`;
}

export function resolveVideoDisplay(video: DisplayableVideo): ResolvedVideo {
  const title = override(video.displayTitle) ?? video.youtubeTitle;
  const description = override(video.displayDescription) ?? video.youtubeDescription;

  return {
    id: video.id,
    youtubeVideoId: video.youtubeVideoId,
    title,
    description,
    thumbnail:
      override(video.displayThumbnail) ??
      override(video.youtubeThumbnail) ??
      fallbackThumbnailUrl(video.youtubeVideoId),
    publishedAt: video.youtubePublishedAt,
    youtubeUrl: override(video.youtubeUrl) ?? watchUrl(video.youtubeVideoId),
    showChannelName: video.showChannelName,
    seoTitle: override(video.seoTitle) ?? title,
    seoDescription: override(video.seoDescription) ?? truncateForMeta(description),
  };
}

function truncateForMeta(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * The fields cleared by "Reset to YouTube Details" (section 19).
 *
 * Note this only removes the website overrides — it never touches YouTube, and
 * it deliberately leaves visibility alone, since that is a publishing decision
 * rather than display text.
 */
export const VIDEO_OVERRIDE_FIELDS = [
  'displayTitle',
  'displayDescription',
  'displayThumbnail',
  'seoTitle',
  'seoDescription',
] as const;

/**
 * Has the administrator hand-edited any of this video's website text?
 *
 * Kept beside `VIDEO_OVERRIDE_FIELDS` so the content list and the editor cannot
 * drift: the list used to test `displayTitle` alone, so a video with a custom
 * description, thumbnail and SEO copy showed no "edited" marker while the
 * editor's own badge said it was customised.
 */
export function hasVideoOverrides(video: Partial<Record<(typeof VIDEO_OVERRIDE_FIELDS)[number], unknown>>): boolean {
  return VIDEO_OVERRIDE_FIELDS.some((field) => video[field] != null);
}

export function clearedOverrides(): Record<(typeof VIDEO_OVERRIDE_FIELDS)[number], null> {
  return Object.fromEntries(VIDEO_OVERRIDE_FIELDS.map((f) => [f, null])) as Record<
    (typeof VIDEO_OVERRIDE_FIELDS)[number],
    null
  >;
}
