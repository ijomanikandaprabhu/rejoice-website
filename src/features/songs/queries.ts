import 'server-only';

import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/db/prisma';

/**
 * Reads for the songs section.
 *
 * Image bytes are NEVER selected here. A song row would otherwise carry its
 * cover — hundreds of kilobytes — into every list query, and the pages only
 * need the id to build a `/api/media/<id>` address.
 */

/** The address that serves a stored image. */
export function mediaUrl(id: string): string {
  return `/api/media/${id}`;
}

export type PlatformRow = {
  id: string;
  name: string;
  logoId: string;
  songCount: number;
};

/** Every registered platform, in display order. */
export async function listPlatforms(): Promise<PlatformRow[]> {
  const rows = await prisma.platform.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, logoId: true, _count: { select: { links: true } } },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    logoId: row.logoId,
    songCount: row._count.links,
  }));
}

const songCard = {
  id: true,
  slug: true,
  title: true,
  artist: true,
  releasedAt: true,
  isVisible: true,
  coverId: true,
} as const;

/**
 * Newest release first — the one order the admin table, the public listing and
 * the sitemap all use, so they cannot disagree about what "latest" means.
 *
 * `nulls: 'last'` is LOAD-BEARING and is not Postgres's default. `ORDER BY ...
 * DESC` puts NULLs FIRST, so without this every song that has no date yet would
 * sit above the newest release — the undated ones crowding out exactly what the
 * page exists to show. `createdAt` then settles ties, and orders the undated
 * ones among themselves.
 */
const newestFirst = [
  { releasedAt: { sort: 'desc', nulls: 'last' } },
  { createdAt: 'desc' },
] satisfies Prisma.SongOrderByWithRelationInput[];

/**
 * One page of songs for the admin table, plus the total.
 *
 * PAGED, emphatically. This used to return every row, which was fine for the
 * handful added so far and would have fetched thousands once the catalogue went
 * in — the page would have loaded every cover id, every link and every title on
 * every visit.
 *
 * `q` matches the title or the artist. It is a `contains` scan, as the video
 * table's search is: at a few thousand rows that is quick, and if it ever stops
 * being quick the answer is an index, not a different screen.
 */
/**
 * The admin catalogue's filter, in one place.
 *
 * Extracted so the TABLE and the BULK ACTION cannot disagree. "Select all
 * matching" posts the filter rather than a list of ids, and the action rebuilds
 * the selection server-side with this same function — if it built its own copy,
 * the two would drift and the bulk verb would reach rows the operator never
 * saw. The videos table learned this the hard way; the note in
 * `BulkVisibility.tsx` records what a single missed filter field cost there.
 *
 * ANY new filter added to the songs table has to be added here, not beside it.
 */
export function buildSongListWhere({ q }: { q?: string }): Prisma.SongWhereInput {
  const search = q?.trim();
  if (!search) return {};

  return {
    OR: [
      { title: { contains: search, mode: 'insensitive' } },
      { artist: { contains: search, mode: 'insensitive' } },
      // Searchable because it is a COLUMN IN THE TABLE. A field the operator can
      // see but cannot search for is a small trap, and this is the one function
      // the table and the bulk action both read, so they cannot disagree.
      { music: { contains: search, mode: 'insensitive' } },
    ],
  };
}

export async function listSongsForAdmin({
  q,
  skip = 0,
  take = 25,
}: {
  q?: string;
  skip?: number;
  take?: number;
}) {
  const where = buildSongListWhere({ q });

  const [rows, total] = await Promise.all([
    prisma.song.findMany({
      where,
      orderBy: newestFirst,
      skip,
      take,
      select: {
        ...songCard,
        // Drawn in the admin table. Deliberately not in `songCard` itself: the
        // public listings and the sitemap share that projection and none of
        // them show a music credit, so it would be a column fetched for nothing
        // on every visitor's page.
        music: true,
        // Only the count is drawn in the table, so the links themselves are not
        // fetched — 25 rows would otherwise pull every URL on the page.
        _count: { select: { links: true } },
      },
    }),
    prisma.song.count({ where }),
  ]);

  return { rows, total };
}

/**
 * One page of visible songs, searchable — the public counterpart to
 * `listSongsForAdmin`.
 *
 * `q` matches the title or the artist, and the count comes back with the rows
 * so the page can size its pagination from the database rather than from what
 * it happens to be holding.
 */
export async function listPublicSongsPage({
  q,
  skip = 0,
  take = 60,
}: {
  q?: string;
  skip?: number;
  take?: number;
}) {
  const search = q?.trim();

  const where = {
    isVisible: true,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { artist: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.song.findMany({
      where,
      orderBy: newestFirst,
      skip,
      take,
      select: songCard,
    }),
    prisma.song.count({ where }),
  ]);

  return { rows, total };
}

/**
 * Every visible song.
 *
 * Kept unpaged for the SITEMAP, which needs every slug rather than a page.
 * Pages use `listPublicSongsPage`.
 */
export async function listPublicSongs() {
  return prisma.song.findMany({
    where: { isVisible: true },
    orderBy: newestFirst,
    select: songCard,
  });
}

/**
 * One song by its public slug, with its links.
 *
 * Returns null for a hidden song rather than the row, so the page 404s — a
 * hidden song must not be reachable by guessing its address.
 */
export async function getPublicSong(slug: string) {
  return prisma.song.findFirst({
    where: { slug, isVisible: true },
    select: {
      ...songCard,
      music: true,
      description: true,
      links: {
        orderBy: { platform: { sortOrder: 'asc' } },
        select: {
          id: true,
          url: true,
          platform: { select: { id: true, name: true, logoId: true } },
        },
      },
    },
  });
}

export async function getSongForAdmin(id: string) {
  return prisma.song.findUnique({
    where: { id },
    select: {
      ...songCard,
      music: true,
      description: true,
      links: { select: { id: true, url: true, platformId: true } },
    },
  });
}
