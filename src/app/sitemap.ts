import type { MetadataRoute } from 'next';

import { publicNav } from '@/config/app.config';
import { getPublicVideoIds } from '@/features/youtube/queries';
import { absoluteUrl } from '@/lib/seo';

/**
 * Sitemap (section 33).
 *
 * Public routes come from the same nav array the header uses, so a new page can
 * never be added to the site and forgotten here. /admin and /api are never
 * included — they are not in publicNav and nothing else is appended.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = publicNav.map((item) => ({
    url: absoluteUrl(item.href),
    lastModified: now,
    changeFrequency: item.href === '/' ? 'daily' : 'weekly',
    priority: item.href === '/' ? 1 : 0.8,
  }));

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
