import 'server-only';

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
  thumbId: true,
  coverId: true,
} as const;

/** Every song, newest release first, for the admin list. */
export async function listSongsForAdmin() {
  return prisma.song.findMany({
    orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      ...songCard,
      description: true,
      links: {
        select: { id: true, url: true, platform: { select: { id: true, name: true } } },
      },
    },
  });
}

/** The public list: visible songs only. */
export async function listPublicSongs() {
  return prisma.song.findMany({
    where: { isVisible: true },
    orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
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
      description: true,
      links: { select: { id: true, url: true, platformId: true } },
    },
  });
}
