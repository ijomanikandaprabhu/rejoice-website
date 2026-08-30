import type { Metadata } from 'next';

import { appConfig } from '@/config/app.config';
import { seoConfig } from '@/config/seo.config';

/**
 * One metadata builder used by every page (section 32).
 *
 * Keeping it here means canonical URLs, Open Graph and Twitter tags are
 * consistent across the site and only have to be corrected in one place.
 */

export type PageSeo = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'video.other';
  publishedTime?: Date | string;
  noIndex?: boolean;
};

export function absoluteUrl(path = '/'): string {
  return new URL(path, appConfig.url).toString();
}

export function buildMetadata({
  title,
  description = seoConfig.defaultDescription,
  path = '/',
  image = seoConfig.defaultOgImage,
  type = 'website',
  publishedTime,
  noIndex = false,
}: PageSeo = {}): Metadata {
  const fullTitle = title ? seoConfig.titleTemplate.replace('%s', title) : seoConfig.defaultTitle;
  const url = absoluteUrl(path);
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);

  return {
    title: fullTitle,
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: appConfig.name,
      locale: seoConfig.locale,
      type: type === 'video.other' ? 'video.other' : type,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: fullTitle }],
      ...(publishedTime
        ? { publishedTime: new Date(publishedTime).toISOString() }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      images: [imageUrl],
      site: seoConfig.twitterHandle,
    },
  };
}

/** VideoObject structured data for a video detail page (section 32). */
export function videoJsonLd(video: {
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: Date;
  youtubeVideoId: string;
  durationSeconds: number | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: video.title,
    description: video.description.slice(0, 500),
    thumbnailUrl: [video.thumbnail],
    uploadDate: video.publishedAt.toISOString(),
    embedUrl: `https://www.youtube.com/embed/${video.youtubeVideoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${video.youtubeVideoId}`,
    ...(video.durationSeconds ? { duration: `PT${video.durationSeconds}S` } : {}),
    publisher: {
      '@type': 'Organization',
      name: appConfig.name,
      url: appConfig.url,
    },
  };
}

export function organizationJsonLd(social: string[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: appConfig.name,
    description: appConfig.description,
    url: appConfig.url,
    ...(social.length > 0 ? { sameAs: social } : {}),
  };
}
