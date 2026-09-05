import type { MetadataRoute } from 'next';

import { publicNav } from '@/config/app.config';
import { listPublicSongs } from '@/features/songs/queries';
import { getPublicVideoIds } from '@/features/youtube/queries';
import { absoluteUrl } from '@/lib/seo';

/**
 * Sitemap (section 33).
 *
 * Public routes come from the same nav array the header uses, so a new page can
 * never be added to the site and forgotten here. /admin and /api are never
 * included — they are not in publicNav and nothing else is appended.
 */

/**
 * LOAD-BEARING. Without it this file has no caching directive and uses no
 * dynamic API, so Next.js generates it ONCE at build time and serves that copy
 * indefinitely — the sitemap then only ever describes the catalogue as it stood
 * at the last deployment.
 *
 * That is not theoretical: three channels were connected on 30 August and none
 * of their videos reached the sitemap. It was serving a copy 5.2 days old and
 * missing 378 public videos, and it re-broke silently on every publish.
 *
 * 300 seconds matches every public page rather than inventing a second
 * interval. `dynamic = 'force-dynamic'` would also work but would query the
 * database on every crawler request, for content that changes at most daily.
 *
 * Worth knowing when testing: a build-time sitemap and a revalidating one are
 * identical on a freshly built site. The only check that distinguishes them is
 * changing data WITHOUT deploying and seeing whether the sitemap follows.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = publicNav.map((item) => ({
    url: absoluteUrl(item.href),
    lastModified: now,
    changeFrequency: item.href === '/' ? 'daily' : 'weekly',
    priority: item.href === '/' ? 1 : 0.8,
  }));

  /*
   * `/shorts` is a real, indexable page but is not in `publicNav` — the nav
   * drives the header and footer, and the shorts feed is reached from the
   * video pages rather than the menu. It therefore has to be added by hand,
   * which is exactly why it was missing.
   *
   * Individual Shorts are NOT listed: `/videos/<id>` 404s for a Short, so each
   * one would be a dead URL. The feed page is the only public address they have.
   */
  pages.push({
    url: absoluteUrl('/shorts'),
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  });

  /*
   * The legal pages are deliberately absent from `publicNav` — they belong in
   * the footer, not the navigation — so like /shorts they have to be listed
   * here by hand. Low priority and rarely changing, but they must be
   * indexable: Google's OAuth review fetches them.
   */
  for (const path of ['/privacy', '/terms']) {
    pages.push({
      url: absoluteUrl(path),
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    });
  }

  /*
   * Songs. Each has its own page with its cover art and streaming links, so
   * they are pages worth indexing in their own right — and the same trap as
   * /shorts applies: /songs is in `publicNav` but the songs beneath it are not,
   * so they only appear here because they are added deliberately.
   */
  const songs = await listPublicSongs();

  for (const song of songs) {
    pages.push({
      url: absoluteUrl(`/songs/${song.slug}`),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    });
  }

  // Only videos the administrator has made visible are listed.
  const videos = await getPublicVideoIds();

  const videoEntries: MetadataRoute.Sitemap = videos.map((video) => ({
    // The YouTube id is the public address and, unlike a database id, survives a
    // channel being disconnected and reconnected.
    url: absoluteUrl(`/videos/${video.youtubeVideoId}`),
    lastModified: video.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...pages, ...videoEntries];
}
