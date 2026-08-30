import { Prisma } from '@prisma/client';

import { pageSizes } from '@/config/app.config';
import { getCarouselSettings } from '@/features/settings/queries';
import { prisma } from '@/lib/db/prisma';
import { resolveVideoDisplay, type ResolvedVideo } from '@/lib/utils/videoDisplay';

/**
 * Read queries for videos.
 *
 * Everything the public site shows comes from the Rejoice database — never from
 * the YouTube API on a visitor request (section 35).
 */

/** The columns needed to render a video card. Selected once, reused everywhere. */
const videoCardSelect = {
  id: true,
  youtubeVideoId: true,
  youtubeTitle: true,
  youtubeDescription: true,
  youtubeThumbnail: true,
  youtubePublishedAt: true,
  youtubeUrl: true,
  displayTitle: true,
  displayDescription: true,
  displayThumbnail: true,
  showChannelName: true,
  seoTitle: true,
  seoDescription: true,
  durationSeconds: true,
  // `handle` is the channel's public URL segment — needed so a video page can
  // link back to the channel it belongs to.
  channel: { select: { id: true, handle: true, name: true, url: true, thumbnail: true } },
} satisfies Prisma.YouTubeVideoSelect;

type VideoRow = Prisma.YouTubeVideoGetPayload<{ select: typeof videoCardSelect }>;

export type VideoCardData = ResolvedVideo & {
  durationSeconds: number | null;
  channel: { id: string; handle: string | null; name: string; url: string; thumbnail: string | null };
};

function toCard(row: VideoRow): VideoCardData {
  return {
    ...resolveVideoDisplay(row),
    durationSeconds: row.durationSeconds,
    channel: row.channel,
  };
}

/** Only videos the administrator has switched on may ever be returned publicly. */
export const publiclyVisible: Prisma.YouTubeVideoWhereInput = {
  isVisible: true,
  channel: { isActive: true },
};

/**
 * The same rule, minus vertical videos.
 *
 * Shorts belong to exactly two surfaces — the homepage rail and `/shorts` — and
 * are kept out of every other listing: the channel rails, the channel pages,
 * the Channels carousel, the "more from this channel" grid and the footer
 * sphere. Without this they leak everywhere, since 22 of the 57 visible videos
 * are vertical.
 *
 * DERIVED from `publiclyVisible` rather than restated, so it cannot drift from
 * the single definition of what may be shown at all. `publiclyVisible` itself
 * stays as it is: it is the visibility rule, not an orientation rule, and the
 * two Shorts surfaces need it unfiltered.
 */
export const publiclyVisibleLandscape: Prisma.YouTubeVideoWhereInput = {
  ...publiclyVisible,
  isShort: false,
};

/**
 * Visible Shorts, newest first, for the homepage rail.
 *
 * `isShort` is a MIRROR of YouTube set during sync from the player's aspect
 * ratio, not an administrator flag — so this asks "is the video vertical",
 * which is exactly what a portrait rail needs. Until now nothing public read
 * it: the column was only ever used by the admin content filters, while every
 * card on the site rendered 16:9. That put 22 of the 57 visible videos in a
 * landscape frame with bars either side.
 *
 * `publiclyVisible` is spread rather than restated, so this cannot drift from
 * the one definition of what may be shown.
 */
export async function getShortsVideos(limit = 12): Promise<VideoCardData[]> {
  const rows = await prisma.youTubeVideo.findMany({
    where: { ...publiclyVisible, isShort: true },
    orderBy: { youtubePublishedAt: 'desc' },
    take: limit,
    select: videoCardSelect,
  });
  return rows.map(toCard);
}

/**
 * Visible Shorts in a RANDOM order, reshuffled on every call.
 *
 * `ORDER BY random()` has to come from raw SQL — Prisma cannot express it — so
 * the ids are drawn first and the rows then loaded through `videoCardSelect`
 * like every other card. Selecting the columns raw instead would bypass
 * `resolveVideoDisplay` and silently ignore the administrator's title and
 * thumbnail overrides.
 *
 * `findMany` returns rows in the DATABASE's order, not the order of the id
 * array, so the random order is re-applied afterwards — otherwise the shuffle
 * would be undone by the very query meant to honour it.
 *
 * The sort covers the whole matching set, which is fine at this scale (~600
 * rows) but is not the query to reach for on a large table.
 *
 * NOTE: the page calling this must opt out of caching, or the "random" order is
 * simply frozen for the life of the cached page.
 */
export async function getRandomShorts(limit = 60): Promise<VideoCardData[]> {
  const picked = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT v."id"
    FROM "YouTubeVideo" v
    JOIN "YouTubeChannel" c ON c."id" = v."channelId"
    WHERE v."isVisible" = true AND c."isActive" = true AND v."isShort" = true
    ORDER BY random()
    LIMIT ${limit}
  `;

  if (picked.length === 0) return [];

  const rows = await prisma.youTubeVideo.findMany({
    where: { id: { in: picked.map((row) => row.id) } },
    select: videoCardSelect,
  });

  const order = new Map(picked.map((row, index) => [row.id, index]));
  return rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)).map(toCard);
}

export async function getLatestVideos(limit = 8): Promise<VideoCardData[]> {
  const rows = await prisma.youTubeVideo.findMany({
    where: publiclyVisibleLandscape,
    orderBy: { youtubePublishedAt: 'desc' },
    take: limit,
    select: videoCardSelect,
  });
  return rows.map(toCard);
}

/**
 * Videos for the Channels page coverflow carousel, in the administrator's order.
 *
 * The chosen ids live in the `carousel` site setting (Admin → Settings), which
 * keeps them ORDERED — the whole reason they are not a boolean column.
 *
 * Two things worth knowing:
 *
 *   - `findMany` with `id: { in: [...] }` returns rows in the DATABASE's order,
 *     not the order of the array. The result is re-sorted by the id's position
 *     afterwards, or the slots would appear shuffled.
 *   - Ids whose video has since been deleted or hidden simply drop out, rather
 *     than leaving a gap. A partly filled set is expected and fine.
 *
 * The fallback to newest-first applies only when NOTHING has been chosen, so a
 * fresh install never shows an empty shelf. Once any slot is filled, only
 * chosen videos appear.
 */
export async function getCarouselVideos(limit = 10): Promise<VideoCardData[]> {
  const { videoIds } = await getCarouselSettings();
  const ids = videoIds.filter(Boolean).slice(0, limit);

  if (ids.length === 0) return getLatestVideos(limit);

  const rows = await prisma.youTubeVideo.findMany({
    where: { ...publiclyVisibleLandscape, id: { in: ids } },
    select: videoCardSelect,
  });

  const order = new Map(ids.map((id, index) => [id, index]));
  return rows
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(toCard);
}

export type MusicPageParams = {
  channel?: string;
  /**
   * Title search, applied on the SERVER.
   *
   * The channel page used to ship an index of videos and filter it in the
   * browser, which capped search at whatever was affordable to send — 500 rows,
   * on a channel with 1,053. Filtering here removes both the cap and the
   * payload.
   */
  q?: string;
  page?: number;
  /** Rows per page. Defaults to the Music page size; the channel page asks for 30. */
  perPage?: number;
  /**
   * Narrow the listing to vertical videos. With no `channel` alongside it, this
   * is what makes `/shorts` common to every channel.
   */
  shortsOnly?: boolean;
};

/** Paginated Music page listing (section 5). */
export async function getMusicVideos({
  channel,
  q,
  page = 1,
  perPage,
  shortsOnly = false,
}: MusicPageParams) {
  const take = perPage ?? pageSizes.music;
  const skip = (Math.max(page, 1) - 1) * take;

  const where: Prisma.YouTubeVideoWhereInput = {
    // `/shorts` runs on this same function, so the landscape rule applies only
    // when Shorts are NOT what was asked for.
    ...(shortsOnly ? publiclyVisible : publiclyVisibleLandscape),
    ...(channel ? { channel: { id: channel, isActive: true } } : {}),
    ...(shortsOnly ? { isShort: true } : {}),
    /*
     * BOTH title columns, matching `searchAdminVideosAction`. The browser only
     * ever saw the resolved title, so a video renamed in the admin could no
     * longer be found by the name YouTube knows it by; searching both restores
     * that.
     */
    ...(q?.trim()
      ? {
          OR: [
            { youtubeTitle: { contains: q.trim(), mode: 'insensitive' as const } },
            { displayTitle: { contains: q.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.youTubeVideo.findMany({
      where,
      orderBy: { youtubePublishedAt: 'desc' },
      skip,
      take,
      select: videoCardSelect,
    }),
    prisma.youTubeVideo.count({ where }),
  ]);

  return {
    videos: rows.map(toCard),
    total,
    page: Math.max(page, 1),
    pageCount: Math.max(Math.ceil(total / take), 1),
  };
}

/**
 * Just the names of the live channels, for the footer's marquee.
 *
 * One column and a handful of rows — deliberately its own query rather than
 * reusing `getChannelsWithVideos`, which would pull three videos and a count
 * per channel to render a strip of text. This runs in the public layout, so it
 * is on the path of every public page.
 *
 * Same `isActive` filter and `createdAt` order as the channels page: a channel
 * the administrator has switched off should not be advertised here either.
 */
export async function getActiveChannelNames(): Promise<string[]> {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { name: true },
  });

  return channels.map((channel) => channel.name);
}

/** Channels page: each channel with a handful of its visible videos (section 5). */
export async function getChannelsWithVideos(videosPerChannel = 3) {
  const channels = await prisma.youTubeChannel.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      videos: {
        where: { isVisible: true, isShort: false },
        orderBy: { youtubePublishedAt: 'desc' },
        take: videosPerChannel,
        select: videoCardSelect,
      },
    },
  });

  return channels.map((channel) => ({
    id: channel.id,
    // The public URL segment. Falls back to the id for a channel that arrived
    // without a handle, which the channel route accepts too.
    slug: channel.handle ?? channel.id,
    name: channel.name,
    url: channel.url,
    thumbnail: channel.thumbnail,
    description: channel.description,
    videos: channel.videos.map(toCard),
  }));
}

/**
 * One channel for its own page. Null when the id is unknown or the channel has
 * been deactivated, so a stale link 404s instead of rendering an empty shell.
 */
/**
 * Look a channel up by its public URL segment.
 *
 * Accepts the `handle` (the canonical form, /creations/rejoicegospelmusic1) or a
 * database id. Ids are accepted only so old links keep working — the page
 * redirects them to the handle rather than serving two URLs for one channel.
 *
 * Database ids are NOT stable: disconnecting a channel cascade-deletes its
 * videos, so reconnecting re-imports everything with fresh ids. A handle
 * survives that, which is why it addresses the page.
 */
export async function getPublicChannelBySlug(slug: string) {
  const channel = await prisma.youTubeChannel.findFirst({
    where: { isActive: true, OR: [{ handle: slug }, { id: slug }] },
    select: {
      id: true,
      handle: true,
      name: true,
      url: true,
      thumbnail: true,
      description: true,
    },
  });
  return channel;
}


/**
 * Public video detail, addressed by its YouTube id (/videos/rR6JGNfGPUY).
 *
 * A database id is accepted too, so links shared before the move still resolve;
 * the page redirects those to the canonical YouTube-id URL. See the note on
 * `getPublicChannelBySlug` for why database ids cannot be the public address.
 *
 * LANDSCAPE only, so a Short 404s here (the route calls `notFound()` on null).
 * This page's player is `aspect-video`, which left a vertical video
 * letterboxed; Shorts are watched in the feed instead, and neither the rail nor
 * the feed links here any more.
 */
export async function getPublicVideoBySlug(slug: string): Promise<VideoCardData | null> {
  const row = await prisma.youTubeVideo.findFirst({
    where: { ...publiclyVisibleLandscape, OR: [{ youtubeVideoId: slug }, { id: slug }] },
    select: videoCardSelect,
  });
  return row ? toCard(row) : null;
}

export async function getPublicVideoIds(): Promise<
  Array<{ youtubeVideoId: string; updatedAt: Date }>
> {
  return prisma.youTubeVideo.findMany({
    // Landscape only, matching the detail page: a Short 404s there now, so
    // listing one here would point search engines at a dead URL.
    where: publiclyVisibleLandscape,
    // The sitemap must carry the PUBLIC address, which is the YouTube id.
    select: { youtubeVideoId: true, updatedAt: true },
    orderBy: { youtubePublishedAt: 'desc' },
    take: 1000,
  });
}
