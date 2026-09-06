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
    seoTitle: override(video.seoTitle) ?? searchTitle(title),
    seoDescription: override(video.seoDescription) ?? buildMetaDescription(description, title),
  };
}

/**
 * A YouTube title cut down to something a search result can show.
 *
 * YouTube titles on this catalogue are pipe-separated billing, not headlines:
 *
 *   "Sthotharipen  | Roshan shelton (Sri Lanka) | Amos | Latest Worship Song |
 *    Official Music Video | 4K"
 *
 * That is 102 characters before the site name is appended. Google shows roughly
 * 60, so every one of these was being cut mid-credit, and the part that
 * survived was the same boilerplate on every video.
 *
 * The song name is what comes before the first pipe, so that is what is kept.
 *
 * This feeds `seoTitle`, so it sets the `<title>`, the `og:title` and the
 * Twitter card title. That is the right reach: all three are short, truncated
 * displays with the same problem. The full title stays on everything that is
 * about the video rather than about a listing of it — the `<h1>`, the
 * `VideoObject` name, and the page's own copy.
 *
 * Two guards. A title with no pipe is left exactly as it is rather than being
 * chopped at an arbitrary column, because there is no telling where a safe cut
 * would be. And a first segment too short to be a name (a stray leading pipe, a
 * "4K" prefix) falls back to the whole title, on the grounds that a long
 * correct title beats a short meaningless one.
 *
 * An editor who wants something else still overrides it in Admin, and that
 * override wins here.
 */
export function searchTitle(title: string): string {
  const first = title.split('|')[0]?.replace(/\s+/g, ' ').trim() ?? '';
  return first.length >= 3 ? first : title.replace(/\s+/g, ' ').trim();
}

function truncateForMeta(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/* -------------------------------------------------------------------------- */
/* Automatic meta descriptions                                                 */
/* -------------------------------------------------------------------------- */

/**
 * A YouTube description is not a meta description.
 *
 * Rejoice descriptions are credit sheets: `Song : X`, `Album : Y`, `Sung By :
 * Z`, then a rule of dashes, streaming links, caller-tune instructions and
 * subscribe boilerplate. Truncating the raw text at 160 characters — which is
 * what this module used to publish — produced meta descriptions that were
 * largely dashes, and that is what search results showed.
 *
 * Measured over the 1,662 public videos: 1,375 open with a `Key : Value` credit
 * line, 1,371 carry `Song :`, 1,306 `Album :`. So for most of the catalogue the
 * credits ARE the useful information, and a sentence composed from them beats
 * anything extracted from the prose. Three strategies are tried in order, and
 * the first that yields something usable wins.
 */

/** `Key : Value`, where the key is a short word or two — not a sentence. */
const CREDIT_LINE = /^\s*([A-Za-z][A-Za-z0-9 &.,'/-]{0,34}?)\s*:\s*(.+)$/;

/** Three or more rule characters: the separator rows between sections. */
const SEPARATOR = /^[\s\-=_~*.·—–]{3,}$/;

/**
 * The same rule characters run INLINE, after real text on the same line —
 * "1000 praises to god ------------------". Matching only whole lines left
 * those untouched, so they went into the description verbatim.
 */
const INLINE_RULE = /[-=_~*·—–]{3,}/g;

/**
 * Lines that exist to promote rather than describe. Matched anywhere in the
 * line, because they appear both as headings and inline.
 */
const BOILERPLATE =
  /(subscribe|follow us|like and follow|stay (happily )?connected|connected with us|enjoy and stay|streaming platform|caller tune|click here|watch more|for more videos|copyright|all rights reserved|do not re-?upload)/i;

/** `Spotify -`, `Apple Music -`, `AIRTEL Subscribers -`: a name and a dangling dash. */
const DANGLING_LINK_LABEL = /^[^\s].{0,30}[-–—:]\s*$/;

/**
 * A credit written WITHOUT a colon — "Lyrics,Tune-Rev.H.Immanuel Jacob",
 * "Music Compsoed 3&4 Titus Abraham". `CREDIT_LINE` misses these because they
 * separate with a dash, and they were surfacing as descriptions.
 */
const CREDIT_PREFIX =
  /^(lyrics?|music|tune|composed?|composer|arranged?|vocals?|sung|singer|mix(ed)?|master(ed)?|camera|edit(ing|or)?|produced?|directed?|programming|keys|guitars?|bass|drums?|flute|violin|rhythm|label|channel|album|song)\b/i;

const URL_ANYWHERE = /https?:\/\/\S+|\b(?:bit\.ly|youtu\.be|www\.)\S+/gi;

/** A line carrying no letters or digits at all — emoji rows, arrows, hashtag walls. */
const NO_WORDS = /^[^\p{L}\p{N}]*$/u;

function normaliseKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Read the `Key : Value` lines into a lookup.
 *
 * Only the FIRST occurrence of a key is kept: these sheets often repeat
 * `Music:` for different sections, and the opening one is the headline credit.
 */
function parseCredits(text: string): Map<string, string> {
  const credits = new Map<string, string>();

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || SEPARATOR.test(line)) continue;

    const match = CREDIT_LINE.exec(line);
    if (!match) continue;

    const key = normaliseKey(match[1]);
    const value = match[2]
      .replace(URL_ANYWHERE, '')
      .replace(INLINE_RULE, ' ')
      .trim()
      .replace(/[.,;|-]+$/, '')
      .trim();

    if (key && value && !credits.has(key)) credits.set(key, value);
  }

  return credits;
}

function firstCredit(credits: Map<string, string>, keys: string[]): string | null {
  for (const key of keys) {
    const value = credits.get(key);
    if (value) return value;
  }
  return null;
}

/**
 * Strategy 1 — compose a sentence from the credit sheet.
 *
 * Deliberately states only what the fields say. No genre, language or praise is
 * invented: an album called "SINGLE" is not an album, so it is dropped rather
 * than published as one.
 */
function describeFromCredits(credits: Map<string, string>): string | null {
  const song = firstCredit(credits, ['song', 'songtitle', 'title', 'track']);
  if (!song) return null;

  const singer = firstCredit(credits, [
    'sungby',
    'sung',
    'singer',
    'singers',
    'vocals',
    'vocal',
    'songsungby',
    'songandsungby',
  ]);
  const albumRaw = firstCredit(credits, ['album']);
  const album = albumRaw && !/^single$/i.test(albumRaw) ? albumRaw : null;
  const music = firstCredit(credits, ['music', 'musicby', 'composer']);
  const lyrics = firstCredit(credits, [
    'lyrics',
    'lyricstune',
    'lyricsandtune',
    'lyricstunecomposed',
    'lyricsandtunecomposed',
    'lyricsby',
    'lyric',
  ]);

  let sentence = song;
  if (singer) sentence += `, sung by ${singer}`;
  if (album) sentence += `, from the album ${album}`;
  sentence += '.';

  // Only worth adding when the first sentence left room for it.
  const extra: string[] = [];
  if (music) extra.push(`Music by ${music}`);
  if (lyrics && lyrics !== music) extra.push(`lyrics by ${lyrics}`);
  if (extra.length && sentence.length + extra.join(', ').length + 2 <= 160) {
    sentence += ` ${extra.join(', ')}.`;
  }

  return truncateForMeta(sentence);
}

/**
 * Strategy 2 — the first line that is actually describing the video.
 *
 * Credit lines, separators, links, promotional lines and symbol-only rows are
 * all rejected, so what survives is prose someone wrote about the video.
 */
function describeFromProse(text: string): string | null {
  const sentences: string[] = [];

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(URL_ANYWHERE, '').replace(INLINE_RULE, ' ').replace(/\s+/g, ' ').trim();

    if (!line) continue;
    if (SEPARATOR.test(line)) continue;
    if (NO_WORDS.test(line)) continue;
    if (BOILERPLATE.test(line)) continue;
    if (DANGLING_LINK_LABEL.test(line)) continue;
    if (CREDIT_LINE.test(line)) continue;
    if (CREDIT_PREFIX.test(line)) continue;
    // A bare hashtag row carries no meaning for a reader.
    if (/^#/.test(line) && !/\s[^#\s]/.test(line)) continue;
    // Too short to be a sentence on its own.
    if (line.replace(/[^\p{L}\p{N}]/gu, '').length < 25) continue;

    sentences.push(line);
    // Two lines is plenty; 160 characters will not fit more.
    if (sentences.join(' ').length >= 160) break;
  }

  if (sentences.length === 0) return null;
  return truncateForMeta(sentences.join(' '));
}

/**
 * The published meta description for a video.
 *
 * Never returns an empty string: an absent description is better filled by the
 * title than left for a search engine to invent one from the page.
 */
export function buildMetaDescription(description: string, title: string): string {
  const text = description ?? '';

  /*
   * Credits win outright when they name the song, even when the sentence comes
   * out short. "Neerea. Music by Reegan." is worth more than the longest line
   * the prose scavenger can find, which in these sheets is usually a fragment
   * of somebody's thanks.
   */
  const fromCredits = describeFromCredits(parseCredits(text));
  if (fromCredits) return fromCredits;

  const fromProse = describeFromProse(text);
  if (fromProse) return fromProse;

  /*
   * The title is the last resort, minus its hashtags: "#Shorts" is a YouTube
   * filing device, not something a search result should read out.
   */
  return truncateForMeta(title.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim()) || truncateForMeta(title);
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
